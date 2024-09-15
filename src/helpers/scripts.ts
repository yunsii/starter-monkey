import { matchPattern } from 'browser-extension-url-match'
import _ from 'lodash'

import { interopDefault } from './modules'

export async function getReactUserscripts() {
  const modules = import.meta.glob<ReactUserscript>('../scripts/*/index.tsx')
  const reactUserscripts = await Promise.all(Object.values(modules).map((item) => item()))
  return reactUserscripts.map((ReactUserscriptItem, index) => {
    const ReactUserscript = interopDefault(ReactUserscriptItem)
    return {
      key: Object.keys(modules)[index],
      Script: ReactUserscript,
    }
  })
}

export async function getAllMatches() {
  const reactUserscripts = await getReactUserscripts()
  return _.uniq(reactUserscripts.flatMap((item) => item.Script.matches))
}

export async function getUserscripts() {
  const reactUserscripts = await getReactUserscripts()

  const userscripts = reactUserscripts.map((reactUserscriptItem, index) => {
    return {
      key: reactUserscriptItem.key,
      ReactUserscript: reactUserscriptItem.Script,
      matched: reactUserscriptItem.Script.matches.map((item) => {
        return matchPattern(item).assertValid()
      }).some((item) => {
        return item.match(window.location.href)
      }),
    }
  })

  return userscripts
}
