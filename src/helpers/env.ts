import { GM_info, GM_xmlhttpRequest } from '$'

export function detectIsMonkeyEnv() {
  return typeof GM_info !== 'undefined'
}

export function detectGmXHR() {
  return detectIsMonkeyEnv() && typeof GM_xmlhttpRequest !== 'undefined'
}
