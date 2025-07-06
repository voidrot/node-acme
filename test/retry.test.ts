import { describe, it, expect, vi } from 'vitest'
import { AcmeClient } from '../src/client'

describe('retry functionality', () => {
  describe('retry configuration', () => {
    it('should use default retry config when none provided', () => {
      const client = new AcmeClient('https://example.com')
      expect(client.retryConfig.maxRetries).toBe(3)
      expect(client.retryConfig.initialDelay).toBe(1000)
      expect(client.retryConfig.maxDelay).toBe(10000)
      expect(client.retryConfig.backoffFactor).toBe(2)
    })

    it('should use custom retry config when provided', () => {
      const client = new AcmeClient('https://example.com', {
        maxRetries: 5,
        initialDelay: 500,
        maxDelay: 5000,
        backoffFactor: 1.5
      })
      expect(client.retryConfig.maxRetries).toBe(5)
      expect(client.retryConfig.initialDelay).toBe(500)
      expect(client.retryConfig.maxDelay).toBe(5000)
      expect(client.retryConfig.backoffFactor).toBe(1.5)
    })

    it('should merge custom config with defaults', () => {
      const client = new AcmeClient('https://example.com', {
        maxRetries: 2
      })
      expect(client.retryConfig.maxRetries).toBe(2)
      expect(client.retryConfig.initialDelay).toBe(1000) // default
      expect(client.retryConfig.maxDelay).toBe(10000) // default
      expect(client.retryConfig.backoffFactor).toBe(2) // default
    })
  })

  describe('retry logic', () => {
    it('should identify retryable errors correctly', () => {
      const client = new AcmeClient('https://example.com')

      // Test with rate limiting error (HTTP 429)
      const rateLimitResponse = { status: 429 } as Response
      expect((client as unknown as { isRetryableError: (error: Error, response?: Response) => boolean }).isRetryableError(new Error('Rate limited'), rateLimitResponse)).toBe(true)

      // Test with server error (HTTP 500)
      const serverErrorResponse = { status: 500 } as Response
      expect((client as unknown as { isRetryableError: (error: Error, response?: Response) => boolean }).isRetryableError(new Error('Server error'), serverErrorResponse)).toBe(true)

      // Test with bad nonce error (HTTP 400)
      const badNonceResponse = { status: 400 } as Response
      expect((client as unknown as { isRetryableError: (error: Error, response?: Response) => boolean }).isRetryableError(new Error('Bad nonce'), badNonceResponse)).toBe(true)

      // Test with network error (no response)
      expect((client as unknown as { isRetryableError: (error: Error, response?: Response) => boolean }).isRetryableError(new Error('Network error'), undefined)).toBe(true)

      // Test with non-retryable error (HTTP 401)
      const unauthorizedResponse = { status: 401 } as Response
      expect((client as unknown as { isRetryableError: (error: Error, response?: Response) => boolean }).isRetryableError(new Error('Unauthorized'), unauthorizedResponse)).toBe(false)

      // Test with client error (HTTP 404)
      const notFoundResponse = { status: 404 } as Response
      expect((client as unknown as { isRetryableError: (error: Error, response?: Response) => boolean }).isRetryableError(new Error('Not found'), notFoundResponse)).toBe(false)
    })

    it('should calculate delay correctly with backoff', async () => {
      const client = new AcmeClient('https://example.com', {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2
      })

      const sleepSpy = vi.spyOn(client as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      sleepSpy.mockImplementation(async () => {
        // Mock sleep implementation
      })

      let attempts = 0
      const mockOperation = vi.fn().mockImplementation(async () => {
        attempts++
        if (attempts <= 2) {
          const error = new Error('Retryable error')
          ;(error as Error & { response?: Response }).response = { status: 500 } as Response
          throw error
        }
        return 'success'
      })

      const result = await (client as unknown as { retryWithBackoff: <T>(op: () => Promise<T>, name: string) => Promise<T> })['retryWithBackoff'](mockOperation, 'test')
      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(3)
      expect(sleepSpy).toHaveBeenCalledTimes(2)
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 100) // First retry delay
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 200) // Second retry delay (100 * 2)

      sleepSpy.mockRestore()
    })

    it('should not retry non-retryable errors', async () => {
      const client = new AcmeClient('https://example.com')

      const mockOperation = vi.fn().mockImplementation(async () => {
        const error = new Error('Not retryable')
        ;(error as Error & { response?: Response }).response = { status: 401 } as Response
        throw error
      })

      await expect((client as unknown as { retryWithBackoff: <T>(op: () => Promise<T>, name: string) => Promise<T> })['retryWithBackoff'](mockOperation, 'test')).rejects.toThrow('Not retryable')
      expect(mockOperation).toHaveBeenCalledTimes(1) // Should not retry
    })

    it('should throw error after max retries exceeded', async () => {
      const client = new AcmeClient('https://example.com', {
        maxRetries: 1,
        initialDelay: 10
      })

      const sleepSpy = vi.spyOn(client as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      sleepSpy.mockImplementation(async () => {
        // Mock sleep implementation
      })

      const mockOperation = vi.fn().mockImplementation(async () => {
        const error = new Error('Always fails')
        ;(error as Error & { response?: Response }).response = { status: 500 } as Response
        throw error
      })

      await expect((client as unknown as { retryWithBackoff: <T>(op: () => Promise<T>, name: string) => Promise<T> })['retryWithBackoff'](mockOperation, 'test')).rejects.toThrow('Always fails')
      expect(mockOperation).toHaveBeenCalledTimes(2) // Initial + 1 retry

      sleepSpy.mockRestore()
    })
  })
})
