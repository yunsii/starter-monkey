/**
 * 一组快捷键。`key` 取 `KeyboardEvent.key` 并转小写。
 *
 * 存成结构而不是 `"Ctrl+Shift+K"` 这样的字符串：匹配时要逐个比对修饰键，
 * 字符串还得先解析回来，而解析是会出错的一环。
 */
export interface HotkeyCombo {
  key: string
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

/**
 * 只按下修饰键不算一组快捷键 —— 录制时用户总要先按住 Ctrl 再按字母，
 * 中途的这些事件必须忽略，否则会录成「Ctrl」本身。
 */
const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift'])

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key)
}

/** 从键盘事件取出一组快捷键；只按了修饰键则返回 `null`。 */
export function comboFromEvent(event: KeyboardEvent): HotkeyCombo | null {
  if (isModifierKey(event.key)) {
    return null
  }
  return {
    key: event.key.toLowerCase(),
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
  }
}

/**
 * 事件是否命中这组快捷键。
 *
 * 修饰键要**全等**比对，而不是「按下的包含配置的」：后者会让 `Ctrl+K` 被 `Ctrl+Shift+K`
 * 一并触发，用户以为自己按的是另一个快捷键。
 */
export function matchesHotkey(event: KeyboardEvent, combo: HotkeyCombo | null): boolean {
  if (!combo) {
    return false
  }
  return event.key.toLowerCase() === combo.key
    && event.ctrlKey === combo.ctrl
    && event.metaKey === combo.meta
    && event.altKey === combo.alt
    && event.shiftKey === combo.shift
}

/** 至少要有一个修饰键：单个字母做全局快捷键，在任何输入场景下都会误触。 */
export function isUsableHotkey(combo: HotkeyCombo | null): boolean {
  return Boolean(combo && (combo.ctrl || combo.meta || combo.alt))
}

const KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  'arrowup': '↑',
  'arrowdown': '↓',
  'arrowleft': '←',
  'arrowright': '→',
  'escape': 'Esc',
  'enter': 'Enter',
  'tab': 'Tab',
}

/** 给人看的写法，例如 `Ctrl + Shift + K`。 */
export function formatHotkey(combo: HotkeyCombo | null): string {
  if (!combo) {
    return ''
  }
  const parts: string[] = []
  if (combo.ctrl) {
    parts.push('Ctrl')
  }
  if (combo.meta) {
    parts.push('Meta')
  }
  if (combo.alt) {
    parts.push('Alt')
  }
  if (combo.shift) {
    parts.push('Shift')
  }
  parts.push(KEY_LABELS[combo.key] ?? combo.key.toUpperCase())
  return parts.join(' + ')
}

/**
 * 焦点是否落在可输入的地方。
 *
 * 全局快捷键必须在这些地方让路，否则用户在宿主页面的输入框里打字会被劫持 ——
 * 这是最容易让人认定「这脚本有毒」的一类问题。
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}
