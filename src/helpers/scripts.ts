import { matchPattern } from 'browser-extension-url-match'
import { uniq } from 'es-toolkit'

import { interopDefault } from './modules'

export async function getUserscripts() {
  const modules = import.meta.glob<Userscript>('../scripts/*/*/index.tsx')
  const userscripts = await Promise.all(Object.values(modules).map((item) => item()))
  return userscripts.map((UserscriptItem, index) => {
    const userscript = interopDefault(UserscriptItem)
    return {
      key: Object.keys(modules)[index],
      script: userscript,
      matched: userscript.matches.map((item) => {
        return matchPattern(item).assertValid()
      }).some((item) => {
        return item.match(window.location.href)
      }),
    }
  })
}

export async function getAllMatches() {
  const userscripts = await getUserscripts()
  return uniq(userscripts.flatMap((item) => item.script.matches))
}
