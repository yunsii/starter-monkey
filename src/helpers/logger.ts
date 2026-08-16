/// <reference types="vite/client" />
/* eslint-disable no-console */

import { NAMESPACE } from './namespace'

/**
 * `debug` / `log` 在生产构建里静默，`warn` / `error` 永远输出。
 *
 * 一刀切地在生产里静默全部级别，代价是错误被**无声吞掉**：框架层的 `.catch(logger.error)`
 * 看起来做了错误处理，实际什么都不会出现在控制台，排查时只能看到"功能没生效"。
 * 这次就是这么吃了亏 —— 一个挂载失败被静默，多花了很多轮次才定位。
 *
 * 而噪音顾虑只针对高频的 debug / log；warn 和 error 本就该是罕见事件，出现了就是需要被看见。
 */
function print(method: (...args: any[]) => void, silentInProduction: boolean, ...args: any[]) {
  if (silentInProduction && import.meta.env.MODE === 'production') {
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
  debug: (...args: any[]) => print(console.debug, true, ...args),
  log: (...args: any[]) => print(console.log, true, ...args),
  warn: (...args: any[]) => print(console.warn, false, ...args),
  error: (...args: any[]) => print(console.error, false, ...args),
}
