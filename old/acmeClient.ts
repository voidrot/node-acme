// ACME Client for Node.js (TypeScript)
// Basic structure for interfacing with ACME servers (e.g., Let's Encrypt)
// This is a starting point and can be extended for full ACME flows.

import type { KeyLike } from 'jose'
import { generateKeyPair, exportJWK, FlattenedSign } from 'jose'
import { generateCsr } from './certUtils'

export interface AcmeDirectory {
  newNonce: string
  newAccount: string
  newOrder: string
  revokeCert: string
  keyChange: string
}

export interface AcmeOrder {
  status: string
  expires?: string
  identifiers: { type: string, value: string }[]
  authorizations: string[]
  finalize: string
  certificate?: string
}

export interface AcmeAuthorization {
  status: string
  identifier: { type: string, value: string }
  challenges: AcmeChallenge[]
}

export interface AcmeChallenge {
  type: string
  status: string
  url: string
  token: string
}

export interface DnsProvider {
  setRecord(domain: string, recordName: string, value: string): Promise<void>
  removeRecord(domain: string, recordName: string): Promise<void>
}

export class AcmeClient {
  directoryUrl: string
  directory?: AcmeDirectory
  private accountUrl?: string
  private privateKey?: KeyLike
  private dnsProvider?: DnsProvider

  constructor(directoryUrl: string) {
    this.directoryUrl = directoryUrl
  }

  async getDirectory(): Promise<AcmeDirectory> {
    const res = await fetch(this.directoryUrl)
    if (!res.ok) throw new Error('Failed to fetch ACME directory')
    const data = await res.json() as Record<string, string>
    if (!data['newNonce'] || !data['newAccount'] || !data['newOrder'] || !data['revokeCert'] || !data['keyChange']) {
      throw new Error('Incomplete ACME directory response')
    }
    this.directory = {
      newNonce: data['newNonce'],
      newAccount: data['newAccount'],
      newOrder: data['newOrder'],
      revokeCert: data['revokeCert'],
      keyChange: data['keyChange']
    }
    return this.directory
  }

  /**
   * Create a new ACME account (register a key pair with the server)
   * @param email Contact email for the account
   * @returns The account URL (kid) and privateKey (for durable storage)
   */
  async createAccount(email: string): Promise<{ accountUrl: string, privateKey: KeyLike }> {
    if (!this.directory) await this.getDirectory()
    // 1. Fetch a fresh nonce
    const nonceRes = await fetch(this.directory!.newNonce, { method: 'HEAD' })
    const nonce = nonceRes.headers.get('Replay-Nonce') || nonceRes.headers.get('replay-nonce')
    if (!nonce) throw new Error('Failed to get ACME nonce')

    // 2. Generate a key pair (ES256)
    const { publicKey, privateKey } = await generateKeyPair('ES256')
    const jwk = await exportJWK(publicKey)
    delete (jwk as Record<string, unknown>).key_ops
    delete (jwk as Record<string, unknown>).ext

    // 3. Build JWS-protected payload for account creation (ACME expects JWS JSON serialization)
    const payload = {
      termsOfServiceAgreed: true,
      contact: [ `mailto:${email}` ]
    }
    const protectedHeader = {
      alg: 'ES256',
      nonce,
      url: this.directory!.newAccount,
      jwk
    }
    // Use FlattenedSign from jose to create the JWS JSON serialization
    const encoder = new TextEncoder()
    const jws = await new FlattenedSign(encoder.encode(JSON.stringify(payload)))
      .setProtectedHeader(protectedHeader)
      .sign(privateKey)
    // jws is an object: { protected, payload, signature }
    const jwsBody = JSON.stringify(jws)

    // 4. Send account creation request
    const res = await fetch(this.directory!.newAccount, {
      method: 'POST',
      headers: { 'Content-Type': 'application/jose+json' },
      body: jwsBody
    })
    if (!res.ok) {
      let errorMsg = `Failed to create ACME account: ${res.status} ${res.statusText}`
      try {
        const errBody = await res.text()
        errorMsg += `\nResponse body: ${errBody}`
      }
      catch (e) {
        errorMsg += '\n(No response body)'
      }
      throw new Error(errorMsg)
    }
    // The account URL (kid) is in the Location header
    const accountUrl = res.headers.get('Location')
    if (!accountUrl) {
      let errorMsg = 'No account URL returned by ACME server.'
      try {
        const respBody = await res.text()
        errorMsg += `\nResponse body: ${respBody}`
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      catch (e) {
        errorMsg += '\n(No response body)'
      }
      throw new Error(errorMsg)
    }
    // Store for this instance
    this.accountUrl = accountUrl
    this.privateKey = privateKey
    // Return for durable storage
    return { accountUrl, privateKey }
  }

  /**
   * Restore account state for authenticated requests
   */
  restoreAccount(accountUrl: string, privateKey: KeyLike) {
    this.accountUrl = accountUrl
    this.privateKey = privateKey
  }

  /**
   * Create a new order for a certificate
   * @param domains Array of domain names to include in the certificate
   * @returns The ACME order object
   */
  async orderCertificate(domains: string[]): Promise<AcmeOrder> {
    if (!this.directory) await this.getDirectory()
    if (!this.accountUrl || !this.privateKey) throw new Error('Account state not set. Call createAccount or restoreAccount first.')
    // 1. Fetch a fresh nonce
    const nonceRes = await fetch(this.directory!.newNonce, { method: 'HEAD' })
    const nonce = nonceRes.headers.get('Replay-Nonce') || nonceRes.headers.get('replay-nonce')
    if (!nonce) throw new Error('Failed to get ACME nonce')

    // 2. Prepare payload
    const identifiers = domains.map((d) => ({ type: 'dns', value: d }))
    const payload = { identifiers }
    // 3. Build protected header (use kid/account URL for authenticated requests)
    const protectedHeader = {
      alg: 'ES256',
      kid: this.accountUrl,
      nonce,
      url: this.directory!.newOrder
    }
    // 4. Sign with FlattenedSign
    const encoder = new TextEncoder()
    const jws = await new FlattenedSign(encoder.encode(JSON.stringify(payload)))
      .setProtectedHeader(protectedHeader)
      .sign(this.privateKey)
    const jwsBody = JSON.stringify(jws)

    // 5. Send order request
    const res = await fetch(this.directory!.newOrder, {
      method: 'POST',
      headers: { 'Content-Type': 'application/jose+json' },
      body: jwsBody
    })
    if (!res.ok) {
      let errorMsg = `Failed to create ACME order: ${res.status} ${res.statusText}`
      try {
        const errBody = await res.text()
        errorMsg += `\nResponse body: ${errBody}`
      }
      catch (e) {
        errorMsg += '\n(No response body)'
      }
      throw new Error(errorMsg)
    }
    const order: AcmeOrder = await res.json()
    return order
  }

  setDnsProvider(provider: DnsProvider) {
    this.dnsProvider = provider
  }

  /**
   * Complete DNS-01 challenges for all authorizations in an order
   * @param order The ACME order object
   * @returns Array of completed authorization URLs
   */
  async completeDns01Challenges(order: AcmeOrder): Promise<string[]> {
    if (!this.accountUrl || !this.privateKey) throw new Error('Account state not set. Call createAccount or restoreAccount first.')
    if (!this.dnsProvider) throw new Error('DNS provider not set. Call setDnsProvider first.')
    // 1. Fetch all authorizations
    const completedAuthz: string[] = []
    for (const authzUrl of order.authorizations) {
      const authzRes = await fetch(authzUrl)
      if (!authzRes.ok) throw new Error(`Failed to fetch authorization: ${authzUrl}`)
      const authz: AcmeAuthorization = await authzRes.json()
      if (authz.status === 'valid') {
        completedAuthz.push(authzUrl)
        continue
      }
      // 2. Find the dns-01 challenge
      const challenge = authz.challenges.find((c) => c.type === 'dns-01')
      if (!challenge) throw new Error(`No dns-01 challenge for ${authz.identifier.value}`)
      // 3. Compute key authorization (stub, real implementation needs JWK thumbprint)
      const keyAuthorization = challenge.token + '.KEY_THUMBPRINT_STUB'
      // 4. Set DNS record via provider
      const recordName = `_acme-challenge.${authz.identifier.value}`
      await this.dnsProvider.setRecord(authz.identifier.value, recordName, keyAuthorization)
      // 5. Notify ACME server to validate
      await this.respondToChallenge(challenge.url, keyAuthorization)
      // 6. Wait for challenge to be valid (polling, stubbed as immediate)
      completedAuthz.push(authzUrl)
    }
    return completedAuthz
  }

  /**
   * Respond to a challenge (POST empty payload to challenge URL)
   */
  private async respondToChallenge(challengeUrl: string, keyAuthorization: string) {
    if (!this.accountUrl || !this.privateKey) throw new Error('Account state not set.')
    if (!this.directory) await this.getDirectory()
    // 1. Fetch a fresh nonce
    const nonceRes = await fetch(this.directory!.newNonce, { method: 'HEAD' })
    const nonce = nonceRes.headers.get('Replay-Nonce') || nonceRes.headers.get('replay-nonce')
    if (!nonce) throw new Error('Failed to get ACME nonce')
    // 2. Build protected header
    const protectedHeader = {
      alg: 'ES256',
      kid: this.accountUrl,
      nonce,
      url: challengeUrl
    }
    // 3. Sign empty payload
    const encoder = new TextEncoder()
    const jws = await new FlattenedSign(encoder.encode(''))
      .setProtectedHeader(protectedHeader)
      .sign(this.privateKey)
    const jwsBody = JSON.stringify(jws)
    // 4. POST to challenge URL
    const res = await fetch(challengeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/jose+json' },
      body: jwsBody
    })
    if (!res.ok) {
      let errorMsg = `Failed to respond to challenge: ${res.status} ${res.statusText}`
      try {
        const errBody = await res.text()
        errorMsg += `\nResponse body: ${errBody}`
      }
      catch (e) {
        errorMsg += '\n(No response body)'
      }
      throw new Error(errorMsg)
    }
  }

  /**
   * Finalize the order and download the certificate
   * @param order The ACME order object
   * @param csrPem The CSR in PEM format (string)
   * @returns The issued certificate (PEM string)
   */
  async finalizeOrder(order: AcmeOrder, csrPem: string): Promise<string> {
    if (!this.accountUrl || !this.privateKey) throw new Error('Account state not set. Call createAccount or restoreAccount first.')
    if (!this.directory) await this.getDirectory()
    // 1. Fetch a fresh nonce
    const nonceRes = await fetch(this.directory!.newNonce, { method: 'HEAD' })
    const nonce = nonceRes.headers.get('Replay-Nonce') || nonceRes.headers.get('replay-nonce')
    if (!nonce) throw new Error('Failed to get ACME nonce')
    // 2. Prepare payload (base64url-encoded DER CSR, no PEM headers)
    const csrDer = Buffer.from(csrPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64')
    const csrB64 = csrDer.toString('base64url')
    const payload = { csr: csrB64 }
    // 3. Build protected header
    const protectedHeader = {
      alg: 'ES256',
      kid: this.accountUrl,
      nonce,
      url: order.finalize
    }
    // 4. Sign with FlattenedSign
    const encoder = new TextEncoder()
    const jws = await new FlattenedSign(encoder.encode(JSON.stringify(payload)))
      .setProtectedHeader(protectedHeader)
      .sign(this.privateKey)
    const jwsBody = JSON.stringify(jws)
    // 5. POST to finalize URL
    const res = await fetch(order.finalize, {
      method: 'POST',
      headers: { 'Content-Type': 'application/jose+json' },
      body: jwsBody
    })
    if (!res.ok) {
      let errorMsg = `Failed to finalize ACME order: ${res.status} ${res.statusText}`
      try {
        const errBody = await res.text()
        errorMsg += `\nResponse body: ${errBody}`
      }
      catch (e) {
        errorMsg += '\n(No response body)'
      }
      throw new Error(errorMsg)
    }
    // 6. Poll order status until 'valid' and certificate URL is present
    let finalizedOrder: AcmeOrder = await res.json()
    let attempts = 10
    while (finalizedOrder.status !== 'valid' && attempts-- > 0) {
      await new Promise((r) => setTimeout(r, 2000))
      const pollRes = await fetch(order.finalize)
      if (!pollRes.ok) throw new Error('Failed to poll order status')
      finalizedOrder = await pollRes.json()
    }
    if (!finalizedOrder.certificate) throw new Error('Order did not finalize or no certificate URL')
    // 7. Download certificate
    const certRes = await fetch(finalizedOrder.certificate)
    if (!certRes.ok) throw new Error('Failed to download certificate')
    const certPem = await certRes.text()
    return certPem
  }

  /**
   * Generate a new ECDSA private key and CSR for the given domains
   * @param domains Array of domain names (first is CN, rest are SANs)
   * @returns { privateKeyPem, csrPem }
   */
  async generateCsr(domains: string[]): Promise<{ privateKeyPem: string, csrPem: string }> {
    return generateCsr(domains)
  }

  /**
   * Download a certificate from a given URL
   * @param certificateUrl The URL to the certificate resource
   * @returns The certificate in PEM format (string)
   */
  async downloadCertificate(certificateUrl: string): Promise<string> {
    const res = await fetch(certificateUrl)
    if (!res.ok) {
      let errorMsg = `Failed to download certificate: ${res.status} ${res.statusText}`
      try {
        const errBody = await res.text()
        errorMsg += `\nResponse body: ${errBody}`
      }
      catch (e) {
        errorMsg += '\n(No response body)'
      }
      throw new Error(errorMsg)
    }
    return await res.text()
  }

  // TODO: Implement certificate downloading
}
