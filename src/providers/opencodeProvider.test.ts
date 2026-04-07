import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { OpencodeApiProvider } from './opencodeProvider'

describe('OpencodeApiProvider', () => {
  const baseURL = 'https://example.com/v1'

  beforeAll(() => {
    // Global fetch mock
    ;(globalThis as any).fetch = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ data: [] }),
        text: async () => '{}',
        headers: {
          get: (_name: string) => 'application/json',
        },
      } as any
    })
  })

  afterAll(() => {
    delete (globalThis as any).fetch
  })

  it('should perform a GET request and return parsed JSON', async () => {
    const provider = new OpencodeApiProvider({ baseURL })
    const res = await provider.get<any>('/items', { page: 1 })
    expect((globalThis as any).fetch).toHaveBeenCalled()
    expect(res).toEqual({ data: [] })
  })

  it('should call chat endpoint with default endpoint when not provided', async () => {
    const provider = new OpencodeApiProvider({ baseURL })
    // Call chat with a payload
    const payload = { model: 'gpt-5.4', messages: [{ role: 'user', content: 'hi' }] }
    const res = await provider.chat<any>(payload)
    expect((globalThis as any).fetch).toHaveBeenCalled()
    expect(res).toEqual({ data: [] })
  })
})
