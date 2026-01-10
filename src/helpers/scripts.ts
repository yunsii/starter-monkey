import { matchPattern } from 'browser-extension-url-match'

import { interopDefault } from './modules'

export function detectIsUserscriptWithIncludes(userscript: Userscript): userscript is UserscriptWithIncludes {
  return 'includes' in userscript
}

export async function getUserscripts() {
  const modules = import.meta.glob<Userscript>('../scripts/*/*/index.tsx')
  const userscripts = await Promise.all(Object.values(modules).map((item) => item()))
  return userscripts.map((UserscriptItem, index) => {
    const userscript = interopDefault(UserscriptItem)
    const isUserscriptWithIncludes = detectIsUserscriptWithIncludes(userscript)
    if (isUserscriptWithIncludes) {
      return {
        key: Object.keys(modules)[index],
        script: userscript,
        matched: userscript.includes.map((item) => {
          return (new RegExp(item)).test(`/${window.location.href}/`)
        }),
      }
    } else {
      return {
        key: Object.keys(modules)[index],
        script: userscript,
        matched: userscript.matches.map((item) => {
          return matchPattern(item).assertValid()
        }).some((item) => {
          return item.match(window.location.href)
        }),
      }
    }
  })
}
