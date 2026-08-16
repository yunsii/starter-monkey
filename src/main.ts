import { logger } from '@/helpers/logger'

import { getUserscripts } from './helpers/scripts'
import { mountSettingsEntry } from './helpers/settings/entry'
import { isFeatureEnabled } from './helpers/settings/feature-toggle'
import { registerSettingsMenu } from './helpers/settings/menu'

getUserscripts().then((userscripts) => {
  // 命中当前页面、且没有被用户在功能列表里关掉的，才执行。
  // 开关在这里统一处理，功能自己不需要再判断一次
  const activeUserscripts = userscripts.filter(
    (item) => item.matched && isFeatureEnabled(item.script.id),
  )

  // 生成脚本列表
  const scriptLines = userscripts.map((item) => {
    const status = item.matched
      ? (isFeatureEnabled(item.script.id) ? '🟢' : '⚪️')
      : '🔴'
    const name = item.script.displayName
    return `${status} ${name}`
  })

  // 组合所有行
  const printInfo = [
    '',
    ...scriptLines,
  ].join('\n')

  logger.debug(printInfo)

  // 配置入口在功能之前注册：功能执行时可能立刻要用 openSettings，而菜单项本身
  // 对页面零侵入，早注册没有代价
  registerSettingsMenu(userscripts)
  void mountSettingsEntry()

  // 执行匹配的脚本
  activeUserscripts.forEach((item) => {
    item.script()
  })
})
