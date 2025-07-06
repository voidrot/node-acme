import { generateKeyPair, exportJWK, FlattenedSign, CryptoKey } from 'jose'

export interface AcmeDirectory {
  newNonce: string
  newAccount: string
  newOrder: string
  revokeCert: string
  keyChange: string
  meta: {
    termsOfService?: string
    website?: string
    caaIdentities?: string[]
    externalAccountRequired?: boolean
  }
}

export class AcmeClient {
  directoryUrl: string
  directory?: AcmeDirectory
  accountUrl?: string
  privateKey?: CryptoKey

  constructor(directoryUrl: string) {
    this.directoryUrl = directoryUrl
  }

  async init(): Promise<void> {
    await this.getDirectory()
  }

  private async getDirectory(): Promise<void> {
    const response = await fetch(this.directoryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ACME directory: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as AcmeDirectory

    if (!data['newNonce'] || !data['newAccount'] || !data['newOrder'] || !data['revokeCert'] || !data['keyChange'] || !data['meta']) {
      throw new Error('Incomplete ACME directory response')
    }

    this.directory = {
      newNonce: data['newNonce'],
      newAccount: data['newAccount'],
      newOrder: data['newOrder'],
      revokeCert: data['revokeCert'],
      keyChange: data['keyChange'],
      meta: {
        termsOfService: data['meta']['termsOfService'],
        website: data['meta']?.website,
        caaIdentities: data['meta']?.caaIdentities || [],
        externalAccountRequired: data['meta']?.externalAccountRequired || false
      }
    }
  }

  private async getNonce(): Promise<string> {
    const nonceRes = await fetch(this.directory!.newNonce, { method: 'HEAD' })
    const nonce = nonceRes.headers.get('Replay-Nonce') || nonceRes.headers.get('replay-nonce')
    if (!nonce) throw new Error('Failed to get ACME nonce')
    return nonce
  }

  async setAccount(accountUrl: string, privateKey: CryptoKey): Promise<void> {
    this.accountUrl = accountUrl
    this.privateKey = privateKey
  }

  async createAccount(email: string): Promise<{ accountUrl: string, privateKey: CryptoKey }> {
    // Ensure directory is initialized incase `init()` was not called
    if (!this.directory) await this.getDirectory()

    const { publicKey, privateKey } = await generateKeyPair('ES256')
    const jwk = await exportJWK(publicKey)
    delete (jwk as Record<string, unknown>)['key_ops']
    delete (jwk as Record<string, unknown>)['ext']

    const payload = {
      termsOfServiceAgreed: true,
      contact: [ `mailto:${email}` ]
    }
    const protectedHeader = {
      alg: 'ES256',
      nonce: await this.getNonce(),
      url: this.directory!.newAccount,
      jwk
    }
    const encoder = new TextEncoder()
    const jws = await new FlattenedSign(encoder.encode(JSON.stringify(payload)))
      .setProtectedHeader(protectedHeader)
      .sign(privateKey)
    const jwsBody = JSON.stringify(jws)
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
      catch (e: unknown) {
        errorMsg += '\n(No response body)'
        console.error('Error reading response body:', e)
      }
      throw new Error(errorMsg)
    }
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

    return { accountUrl, privateKey }
  }
}
