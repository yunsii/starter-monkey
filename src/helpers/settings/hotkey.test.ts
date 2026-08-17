/// <reference types="node" />
// 由 `node --test` 直接执行，而 `tsconfig.json` 面向浏览器（lib 只有 DOM/ESNext），
// TypeScript 7 不再隐式带上 `@types/node`，所以显式声明。

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  comboFromEvent,
  formatHotkey,
  isModifierKey,
  isUsableHotkey,
  matchesHotkey,
} from './hotkey.ts'

import type { HotkeyCombo } from './hotkey.ts'

/** 键盘事件在 Node 里不存在，用最小替身：这些函数只读这几个属性 */
function event(key: string, modifiers: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  } as KeyboardEvent
}

const CTRL_K: HotkeyCombo = { key: 'k', ctrl: true, meta: false, alt: false, shift: false }

describe('从事件取快捷键', () => {
  it('只按修饰键时返回 null', () => {
    // 录制时用户总要先按住 Ctrl 再按字母，中途这些事件不能被录成快捷键本身
    for (const key of ['Control', 'Meta', 'Alt', 'Shift']) {
      assert.ok(isModifierKey(key))
      assert.equal(comboFromEvent(event(key, { ctrlKey: true })), null)
    }
  })

  it('键名统一转小写，修饰键如实记录', () => {
    assert.deepEqual(comboFromEvent(event('K', { ctrlKey: true, shiftKey: true })), {
      key: 'k',
      ctrl: true,
      meta: false,
      alt: false,
      shift: true,
    })
  })
})

describe('匹配', () => {
  it('命中完全一致的组合', () => {
    assert.ok(matchesHotkey(event('k', { ctrlKey: true }), CTRL_K))
    assert.ok(matchesHotkey(event('K', { ctrlKey: true }), CTRL_K))
  })

  it('修饰键必须全等，多按一个不算命中', () => {
    // 否则 Ctrl+K 会被 Ctrl+Shift+K 一并触发，用户以为自己按的是另一个快捷键
    assert.equal(matchesHotkey(event('k', { ctrlKey: true, shiftKey: true }), CTRL_K), false)
    assert.equal(matchesHotkey(event('k', { ctrlKey: true, altKey: true }), CTRL_K), false)
    assert.equal(matchesHotkey(event('k', {}), CTRL_K), false)
  })

  it('未绑定时永远不命中', () => {
    assert.equal(matchesHotkey(event('k', { ctrlKey: true }), null), false)
  })
})

describe('可用性', () => {
  it('至少要有一个非 Shift 的修饰键', () => {
    // 单个字母做全局快捷键，在任何输入场景下都会误触
    assert.equal(isUsableHotkey({ key: 'k', ctrl: false, meta: false, alt: false, shift: false }), false)
    assert.equal(isUsableHotkey({ key: 'k', ctrl: false, meta: false, alt: false, shift: true }), false)
    assert.ok(isUsableHotkey(CTRL_K))
    assert.ok(isUsableHotkey({ key: 'k', ctrl: false, meta: true, alt: false, shift: false }))
    assert.ok(isUsableHotkey({ key: 'k', ctrl: false, meta: false, alt: true, shift: false }))
  })

  it('未绑定不可用', () => {
    assert.equal(isUsableHotkey(null), false)
  })
})

describe('显示', () => {
  it('按固定顺序拼接，未绑定为空串', () => {
    assert.equal(formatHotkey(CTRL_K), 'Ctrl + K')
    assert.equal(formatHotkey({ key: 'k', ctrl: true, meta: true, alt: true, shift: true }), 'Ctrl + Meta + Alt + Shift + K')
    assert.equal(formatHotkey(null), '')
  })

  it('特殊键用可读名字', () => {
    assert.equal(formatHotkey({ key: ' ', ctrl: true, meta: false, alt: false, shift: false }), 'Ctrl + Space')
    assert.equal(formatHotkey({ key: 'arrowup', ctrl: false, meta: false, alt: true, shift: false }), 'Alt + ↑')
  })
})
