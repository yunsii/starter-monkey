/// <reference types="node" />
// 这个文件由 `node --test` 直接执行，而 `tsconfig.json` 是面向浏览器的（lib 只有 DOM/ESNext）。
// TypeScript 7 不再隐式带上 `@types/node`，所以要显式声明。

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getFeatureActions,
  registerFeatureActions,
  subscribeFeatureActions,
} from './actions.ts'

import type { FeatureAction } from './actions.ts'

function trigger(id: string): FeatureAction {
  return { type: 'trigger', id, label: id, onTrigger: () => {} }
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
