import { describe, it, expect, inject } from 'vitest'
import AcmeClient from '../src'

describe('retry logic', () => {
  const retryConfig = { maxDelay: 100, initialDelay: 100, maxRetries: 50 }
  describe('config', () => {
    it('should have defaults set correctly', () => {
      const client = new AcmeClient(inject('ACME_API_RETRY'))
      expect(client.retryConfig.maxRetries).toBe(5)
      expect(client.retryConfig.initialDelay).toBe(1000)
      expect(client.retryConfig.maxDelay).toBe(30000)
    })
    it('should allow custom retry configuration', () => {
      const customConfig = {
        initialDelay: 500,
        maxRetries: 3,
        maxDelay: 10000,
        backoffFactor: 1.5
      }
      const client = new AcmeClient(inject('ACME_API_RETRY'), customConfig)
      expect(client.retryConfig.initialDelay).toBe(500)
      expect(client.retryConfig.maxRetries).toBe(3)
      expect(client.retryConfig.maxDelay).toBe(10000)
      expect(client.retryConfig.backoffFactor).toBe(1.5)
    })
  })
  describe('createAccount', () => {
    it('should retry on network errors', async () => {
      const client = new AcmeClient(inject('ACME_API_RETRY'), retryConfig)
      client.init()
      const { accountUrl, privateKey } = await client.createAccount('retry@voidrot.dev')
      expect(typeof accountUrl).toBe('string')
      expect(accountUrl.startsWith('https://')).toBe(true)
      expect(privateKey).toBeDefined()
    }, { timeout: 60000 }) // Increased timeout for retries
  })
})
