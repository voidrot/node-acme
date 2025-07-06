import { describe, it, expect, inject } from 'vitest'
import AcmeClient from '../src'

describe('environment', () => {
  it('api should be defined', () => {
    expect(inject('ACME_API')).toBe('https://localhost:14000/dir')
  })
  it('mgmt api should be defined', () => {
    expect(inject('ACME_MGMT_API')).toBe('https://localhost:15000')
  })
  it('challenge api should be defined', () => {
    expect(inject('ACME_CHALLENGE_API')).toBe('http://localhost:8055')
  })
  it('should have a valid NODE_EXTRA_CA_CERTS', () => {
    expect(process.env['NODE_EXTRA_CA_CERTS']).toBeDefined()
    expect(process.env['NODE_EXTRA_CA_CERTS']).toContain('test/certs/')
  })
  it('should have NODE_TLS_REJECT_UNAUTHORIZED set to 0', () => {
    expect(process.env['NODE_TLS_REJECT_UNAUTHORIZED']).toBe('0')
  })
  it('ACME API should be reachable', async () => {
    const response = await fetch(inject('ACME_API'))
    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toHaveProperty('newNonce')
  })
  it('ACME Management API should be reachable', async () => {
    const response = await fetch(`${inject('ACME_MGMT_API')}/root-keys/0`)
    expect(response.ok).toBe(true)
  })
  it('ACME Challenge API should be reachable', async () => {
    const response = await fetch(`${inject('ACME_CHALLENGE_API')}/http-request-history`, { body: JSON.stringify({ host: 'example.com' }), method: 'POST' })
    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toStrictEqual([]) // Assuming no requests have been made yet
  })
})

describe('node-acme', () => {
  describe('client setup', () => {
    it('should construct ACME directory', async () => {
      const client = new AcmeClient(inject('ACME_API'))
      await client.init()
      expect(client.directoryUrl).toBe(inject('ACME_API'))
      expect(client.directory).toBeDefined()
      expect(client.directory).toHaveProperty('newNonce')
      expect(client.directory).toHaveProperty('newAccount')
      expect(client.directory).toHaveProperty('newOrder')
      expect(client.directory).toHaveProperty('revokeCert')
      expect(client.directory).toHaveProperty('keyChange')
    })
  })

  describe('account management', () => {
    it('should create a new account', async () => {
      const client = new AcmeClient(inject('ACME_API'))
      await client.init()
      const { accountUrl, privateKey } = await client.createAccount('test@voidrot.dev')
      expect(typeof accountUrl).toBe('string')
      expect(accountUrl.startsWith('https://')).toBe(true)
      expect(privateKey).toBeDefined()
    })
  })
})
