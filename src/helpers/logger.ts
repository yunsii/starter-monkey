/// <reference types="vite/client" />
/* eslint-disable no-console */

import { NAMESPACE } from './namespace'

function print(method: (...args: any[]) => void, ...args: any[]) {
  if (import.meta.env.MODE === 'production') {
    return
  }

  if (typeof args[0] === 'string') {
    const message = args.shift()
    method(`[${NAMESPACE}] ${message}`, ...args)
  } else {
    method(`[${NAMESPACE}]`, ...args)
  }
}

/**
 * Wrapper around `console` with a `[NAMESPACE]` prefix
 */
export const logger = {
  debug: (...args: any[]) => print(console.debug, ...args),
  log: (...args: any[]) => print(console.log, ...args),
  warn: (...args: any[]) => print(console.warn, ...args),
  error: (...args: any[]) => print(console.error, ...args),
}
