import { GM_registerMenuCommand } from '$'

import { logger } from '@/helpers/logger'

import { openSettings } from './open'

import type { MatchedUserscript } from '../scripts'

/**
 * 把配置入口注册到用户脚本管理器的菜单里。
 *
 * 这是唯一**对页面零侵入**的入口：不加 DOM、不加 CSS、不加事件监听。页面样式再敌对、
 * 脚本 UI 再挂，菜单项照样在。
 *
 * 覆盖面：Tampermonkey / Violentmonkey / ScriptCat 都支持，Greasemonkey 4.11+ 支持。
 * 更老的 GM 没有这个 API，所以要特性检测后静默降级 —— 那些用户仍可通过功能自身的
 * 入口或悬浮入口打开配置。
 */
export function registerSettingsMenu(scripts: MatchedUserscript[]): void {
  if (typeof GM_registerMenuCommand !== 'function') {
    logger.debug('当前用户脚本管理器不支持菜单项，跳过注册配置入口')
    return
  }

  // 单独入口只给「当前页面活跃、且自己声明了配置」的功能：菜单是按标签页呈现的，
  // 列出在这个页面上根本不跑的功能只会制造困惑。不活跃的功能在聚合面板里仍然可见可配。
  for (const item of scripts.filter((script) => script.settings && script.matched)) {
    GM_registerMenuCommand(
      `⚙ ${item.settings?.title ?? item.script.displayName}`,
      () => {
        void openSettings(item.script.id)
      },
      { id: `settings-${item.script.id}` },
    )
  }

  // 「全部配置」无条件注册，不能因为「没有任何功能声明 settings」就跳过：面板里除了各功能
  // 自己的配置，还有框架级的「通用」分组（悬浮入口、快捷键、入口配色…）和列出全部功能的
  // 启用开关，一个 schema 都没有时这些依然要进得去。何况菜单是唯一对页面零侵入的入口，
  // 恰恰是这种「功能还没长出配置」的早期阶段最需要它。
  GM_registerMenuCommand(
    '⚙ 全部配置',
    () => {
      void openSettings()
    },
    { id: 'settings-all' },
  )
}
