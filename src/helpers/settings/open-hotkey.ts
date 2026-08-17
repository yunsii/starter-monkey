import { unsafeWindow } from '$'

import { commonSettingsStore, OPEN_HOTKEY_FIELD } from './common'
import { isEditableTarget, matchesHotkey } from './hotkey'
import { openSettings } from './open'
import { subscribeSettingsRevision } from './revision'

import type { HotkeyCombo } from './hotkey'

let listening = false

function readCombo(): HotkeyCombo | null {
  return commonSettingsStore.get<HotkeyCombo | null>(OPEN_HOTKEY_FIELD, null)
}

function onKeyDown(event: KeyboardEvent) {
  // 输入法组字期间的按键不算数：中文输入时按下的每个键都会走到这里
  if (event.isComposing) {
    return
  }
  // 焦点在输入框里就让路 —— 劫持宿主页面的打字是最容易让人认定「这脚本有毒」的事
  if (isEditableTarget(event.target)) {
    return
  }
  if (!matchesHotkey(event, readCombo())) {
    return
  }

  // 只在真正命中之后才拦截：无差别 preventDefault 会吃掉页面自己的快捷键
  event.preventDefault()
  event.stopPropagation()
  void openSettings()
}

/**
 * 注册「打开配置」的全局快捷键。
 *
 * 默认不绑定任何快捷键：模板里预设一个，迟早会和某个站点的快捷键撞上，而挨骂的是
 * 用了这个模板的人。用户在通用配置里自己录一个即可。
 *
 * 未绑定时**完全不注册监听器** —— 和悬浮入口一样，不开启就不该在页面上留下任何东西。
 *
 * 挂在 `unsafeWindow` 的捕获阶段：油猴沙箱里的 `window` 和页面的不是同一个，挂错了
 * 收不到事件；而捕获阶段能赶在页面自己的处理器之前拿到按键。
 */
export function registerOpenHotkey(): void {
  const sync = () => {
    const shouldListen = readCombo() !== null
    if (shouldListen === listening) {
      return
    }
    listening = shouldListen
    if (shouldListen) {
      unsafeWindow.addEventListener('keydown', onKeyDown, true)
    } else {
      unsafeWindow.removeEventListener('keydown', onKeyDown, true)
    }
  }

  commonSettingsStore.subscribe(OPEN_HOTKEY_FIELD, sync)
  subscribeSettingsRevision(sync)
  sync()
}
