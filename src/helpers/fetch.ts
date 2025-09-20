import { GM_xmlhttpRequest } from '$'

import { isMonkeyEnv } from './env'

export function gmFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const _gmHeaders = (() => {
      const h = init?.headers
      if (!h) {
        return undefined
      }
      if (typeof Headers !== 'undefined' && h instanceof Headers) {
        const out: Record<string, string> = {}
        h.forEach((value, key) => {
          out[key] = value
        })
        return out
      }
      if (Array.isArray(h)) {
        const out: Record<string, string> = {}
        for (const [key, value] of h) {
          out[key] = value
        }
        return out
      }
      return h as Record<string, string>
    })()

    const _url = (() => {
      if (typeof input === 'string') {
        return input
      }
      if (input instanceof URL) {
        return input.href
      }
      if (typeof (input as Request).url === 'string') {
        return (input as Request).url
      }
      return String(input)
    })()

    GM_xmlhttpRequest({
      method: init?.method || 'GET',
      url: _url,
      headers: _gmHeaders,
      data: init?.body || undefined,
      onload: (response) => {
        const headers = new Headers()
        response.responseHeaders
          .split('\n')
          .filter((header) => header.trim() !== '')
          .forEach((header) => {
            const colonIndex = header.indexOf(': ')
            if (colonIndex > 0) {
              const key = header.substring(0, colonIndex).trim()
              const value = header.substring(colonIndex + 2).trim()
              // Validate header name - must contain only valid HTTP header characters
              if (key && value && /^[!#$&'*+\-.^`|~\w]+$/.test(key)) {
                try {
                  headers.append(key, value)
                } catch (e) {
                  // Skip invalid headers silently
                  console.warn(`Invalid header skipped: ${key}: ${value}`)
                }
              }
            }
          })

        const res = new Response(response.responseText, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
        resolve(res)
      },
      onerror: (error) => {
        reject(new Error(`Network error: ${error}`))
      },
    })
  })
}

export async function monkeyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isMonkeyEnv()) {
    return gmFetch(input, init)
  } else {
    return monkeyFetch(input, init)
  }
}
