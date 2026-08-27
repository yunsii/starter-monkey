import { matchPattern } from 'browser-extension-url-match'

import { matchesInclude } from './include-pattern'
import { interopDefault } from './modules'

import type { SettingsSchema } from './settings/types'

export function detectIsUserscriptWithIncludes(userscript: Userscript): userscript is UserscriptWithIncludes {
  return 'includes' in userscript
}

/**
 * 一个功能模块的形状：默认导出是功能本体，`settings` 是可选的配置声明。
 *
 * 配置走**具名导出**而不是挂在 `Script` 上或运行时注册，是因为配置面板要列出**所有**
 * 功能，包括当前页面不匹配、因而不会执行的那些。`import.meta.glob` 已经把每个模块都
 * 加载了（只是不执行不匹配的功能），所以具名导出天然可用。
 */
interface UserscriptModule {
  default: Userscript
  settings?: SettingsSchema
}

export interface MatchedUserscript {
  key: string
  script: Userscript
  /** 该功能声明的配置 schema，未声明则为 `undefined` */
  settings?: SettingsSchema
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
  const modules = import.meta.glob<UserscriptModule>('../scripts/*/*/index.tsx')
  const loaded = await Promise.all(Object.values(modules).map((item) => item()))
  return loaded.map((module, index) => {
    const userscript = interopDefault<Userscript>(module as never)
    const isUserscriptWithIncludes = detectIsUserscriptWithIncludes(userscript)
    const common = {
      key: Object.keys(modules)[index],
      script: userscript,
      settings: module.settings,
    }
    if (isUserscriptWithIncludes) {
      return {
        ...common,
        matched: matchesInclude(userscript.includes, window.location.href),
      }
    } else {
      return {
        ...common,
        matched: userscript.matches.map((item) => {
          return matchPattern(item).assertValid()
        }).some((item) => {
          return item.match(window.location.href)
        }),
      }
    }
  })
}
