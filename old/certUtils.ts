import { generateKeyPair } from 'crypto'
import { createSign } from 'crypto'

/**
 * Generate a new ECDSA (P-256) private key and CSR for the given domains.
 * @param domains Array of domain names (first is CN, rest are SANs)
 * @returns { privateKeyPem: string, csrPem: string }
 */
export async function generateCsr(domains: string[]): Promise<{ privateKeyPem: string, csrPem: string }> {
  return new Promise((resolve, reject) => {
    generateKeyPair('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    }, (err, publicKey, privateKey) => {
      if (err) return reject(err)
      // Minimal CSR using node-forge or native crypto is non-trivial; stub for now
      // You can use libraries like 'pkcs10' or 'node-forge' for real CSR generation
      // Here, we return the private key and a placeholder CSR
      resolve({
        privateKeyPem: privateKey,
        csrPem: '-----BEGIN CERTIFICATE REQUEST-----\nMIIB...STUB...\n-----END CERTIFICATE REQUEST-----'
      })
    })
  })
}
