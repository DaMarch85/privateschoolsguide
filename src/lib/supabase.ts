import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rmxsymdoprmgjgmwwaop.supabase.co'
const supabaseAnonKey = 'sb_publishable_5E2f_ZiLhWjxShJbpNyWyQ_YRF_sjI_'

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const RETRY_DELAYS_MS = [400, 1200, 2500]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRequestLabel(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return 'supabase-request'
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const retryableInput = input instanceof Request ? input.clone() : input
      const response = await fetch(retryableInput, init)

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === RETRY_DELAYS_MS.length) {
        return response
      }

      const delay = RETRY_DELAYS_MS[attempt]
      console.warn(`[supabase] ${response.status} from ${getRequestLabel(input)} — retrying in ${delay}ms`)
      await sleep(delay)
    } catch (error) {
      lastError = error

      if (attempt === RETRY_DELAYS_MS.length) {
        throw error
      }

      const delay = RETRY_DELAYS_MS[attempt]
      console.warn(`[supabase] network error for ${getRequestLabel(input)} — retrying in ${delay}ms`)
      await sleep(delay)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Supabase request failed')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithRetry
  }
})
