import { matchPattern } from 'browser-extension-url-match'

import { interopDefault } from './modules'

export function detectIsUserscriptWithIncludes(userscript: Userscript): userscript is UserscriptWithIncludes {
  return 'includes' in userscript
}

export interface MatchedUserscript {
  key: string
  script: Userscript
  /**
   * 当前页面是否命中这个脚本。
   *
   * 显式标注类型，是因为这里出过一次静默的错：`includes` 分支曾经返回 `boolean[]`
   * 而不是 `boolean`，而调用方是 `filter((item) => item.matched)` —— 空数组在 JS 里
   * 也是真值，于是基于 `includes` 的脚本在运行时过滤这一关永远为真，会在别的脚本
   * 匹配到的页面上一起执行。标注之后同类错误变成编译错误。
   */
  matched: boolean
}

export async function getUserscripts(): Promise<MatchedUserscript[]> {
  const modules = import.meta.glob<Userscript>('../scripts/*/*/index.tsx')
  const userscripts = await Promise.all(Object.values(modules).map((item) => item()))
  return userscripts.map((UserscriptItem, index) => {
    const userscript = interopDefault(UserscriptItem)
    const isUserscriptWithIncludes = detectIsUserscriptWithIncludes(userscript)
    if (isUserscriptWithIncludes) {
      return {
        key: Object.keys(modules)[index],
        script: userscript,
        matched: userscript.includes.some((item) => {
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
