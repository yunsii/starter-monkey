/// <reference types="node" />
// 这个文件由 `node --test` 直接执行，而 `tsconfig.json` 是面向浏览器的（lib 只有 DOM/ESNext）。
// TypeScript 7 不再隐式带上 `@types/node`，所以要显式声明。

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  detectHasPanelContent,
  getFeatureActions,
  getFeatureActionsRevision,
  registerFeatureActions,
  subscribeFeatureActions,
} from './actions.ts'

import type { FeatureAction, FeatureToggleAction } from './actions.ts'

function trigger(id: string): FeatureAction {
  return { type: 'trigger', id, label: id, onTrigger: () => {} }
}

function toggle(id: string, checked: boolean): FeatureAction {
  return { type: 'toggle', id, label: id, checked, onChange: () => {} }
}

describe('getFeatureActions', () => {
  it('未注册时返回同一个引用', () => {
    // useSyncExternalStore 要求快照引用稳定，每次返回新的 `[]` 会无限重渲染 ——
    // 而「没有动作」是最常见的情况，这个坑一旦踩中会以「打开面板就卡死」出现
    assert.equal(getFeatureActions('never-registered'), getFeatureActions('never-registered'))
  })

  it('按功能隔离', () => {
    const a = [trigger('a')]
    const unregister = registerFeatureActions('script-a', a)
    assert.deepEqual(getFeatureActions('script-a'), a)
    assert.deepEqual(getFeatureActions('script-b'), [])
    unregister()
  })
})

describe('registerFeatureActions', () => {
  it('整体替换而不是追加', () => {
    // 动作会随功能状态变化（审查模式开着时是「退出」、关着时是「进入」），
    // 增量维护必然漏删
    const first = registerFeatureActions('script', [trigger('one')])
    registerFeatureActions('script', [trigger('two')])
    assert.deepEqual(getFeatureActions('script').map((item) => item.id), ['two'])
    first()
    // 旧 effect 的清理不该带走新的注册
    assert.deepEqual(getFeatureActions('script').map((item) => item.id), ['two'])
    registerFeatureActions('script', [])()
  })

  it('两种类型都能注册，读回来还是原样', () => {
    const actions = [toggle('t', false), trigger('r')]
    const unregister = registerFeatureActions('script', actions)
    assert.deepEqual(getFeatureActions('script').map((item) => item.type), ['toggle', 'trigger'])
    unregister()
  })

  it('toggle 的 checked 靠重新注册推动', () => {
    // 这是 `FeatureToggleAction.checked` 的可执行版说明：它是注册时的快照，不是活引用。
    // 调用方漏了把状态写进 effect 依赖时，面板上的开关就会停在旧值、点了不动
    const first = registerFeatureActions('script', [toggle('t', false)])
    assert.equal((getFeatureActions('script')[0] as FeatureToggleAction).checked, false)

    registerFeatureActions('script', [toggle('t', true)])
    assert.equal((getFeatureActions('script')[0] as FeatureToggleAction).checked, true)

    first()
    registerFeatureActions('script', [])()
  })

  it('注销后回到空', () => {
    const unregister = registerFeatureActions('script', [trigger('one')])
    unregister()
    assert.deepEqual(getFeatureActions('script'), [])
  })

  it('通知订阅者，取消订阅后不再通知', () => {
    let calls = 0
    const unsubscribe = subscribeFeatureActions(() => {
      calls += 1
    })

    const unregister = registerFeatureActions('script', [trigger('one')])
    assert.equal(calls, 1)
    unregister()
    assert.equal(calls, 2)

    unsubscribe()
    registerFeatureActions('script', [trigger('one')])()
    assert.equal(calls, 2)
  })
})

describe('detectHasPanelContent', () => {
  it('没有配置项但注册了动作，也算有内容', () => {
    // 只注册动作、不声明 settings 的功能必须能出现在面板里，否则动作没有落脚的地方
    assert.equal(detectHasPanelContent('action-only', false), false)
    const unregister = registerFeatureActions('action-only', [trigger('one')])
    assert.equal(detectHasPanelContent('action-only', false), true)
    unregister()
    assert.equal(detectHasPanelContent('action-only', false), false)
  })

  it('有配置项时与动作无关', () => {
    assert.equal(detectHasPanelContent('never-registered', true), true)
  })
})

describe('getFeatureActionsRevision', () => {
  it('每次注册与注销都递增', () => {
    // 面板判断「这个功能该不该出现」跨所有功能，没法用单个数组的引用当快照
    const before = getFeatureActionsRevision()
    const unregister = registerFeatureActions('script', [trigger('one')])
    assert.equal(getFeatureActionsRevision(), before + 1)
    unregister()
    assert.equal(getFeatureActionsRevision(), before + 2)
  })
})
