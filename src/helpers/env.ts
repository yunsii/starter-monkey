import { GM_info, GM_xmlhttpRequest } from '$'

export function isMonkeyEnv() {
  return typeof GM_info !== 'undefined' && typeof GM_xmlhttpRequest !== 'undefined'
}
