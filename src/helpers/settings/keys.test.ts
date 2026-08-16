/// <reference types="node" />
// 这个文件由 `node --test` 直接执行，而 `tsconfig.json` 是面向浏览器的（lib 只有 DOM/ESNext）。
// TypeScript 7 不再隐式带上 `@types/node`，所以要显式声明。

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assertIdentifier,
  listStoredFields,
  parseKey,
  settingKey,
} from './keys.ts'

describe('键构造', () => {
  it('命名空间是功能 id，键里不含站点信息', () => {
    assert.equal(settingKey('v2ex-demo', 'apiBase'), 'starter-monkey:v2ex-demo.apiBase')
    assert.equal(settingKey('common', 'showFloatingEntry'), 'starter-monkey:common.showFloatingEntry')
  })

  it('同一个功能在不同站点用同一个键，因此天然共用配置', () => {
    // GM 存储是脚本级的，跨站共享；一个功能匹配多个站点时不应各存一份
    assert.equal(settingKey('v2ex-demo', 'f'), settingKey('v2ex-demo', 'f'))
  })
})

describe('反解', () => {
  it('拆出命名空间与字段名', () => {
    assert.deepEqual(parseKey('starter-monkey:ns.field'), { namespace: 'ns', field: 'field' })
    assert.deepEqual(parseKey(settingKey('coco-i18n-inspect', 'env')), {
      namespace: 'coco-i18n-inspect',
      field: 'env',
    })
  })

  it('不是本模板的键返回 null', () => {
    // GM 存储是整个脚本共用的，将来放别的东西时不能误判成配置项
    assert.equal(parseKey('someone-else:ns.field'), null)
    assert.equal(parseKey('starter-monkey:nodot'), null)
    assert.equal(parseKey('starter-monkey:.field'), null)
    assert.equal(parseKey('starter-monkey:ns.'), null)
  })
})

describe('按命名空间归集', () => {
  const keys = [
    settingKey('a', 'x'),
    settingKey('a', 'y'),
    settingKey('b', 'x'),
    'unrelated-key',
  ]

  it('只返回该命名空间下的字段', () => {
    assert.deepEqual(listStoredFields(keys, 'a').sort(), ['x', 'y'])
    assert.deepEqual(listStoredFields(keys, 'b'), ['x'])
  })

  it('没有存过值时返回空数组', () => {
    assert.deepEqual(listStoredFields(keys, 'c'), [])
  })
})

describe('标识符校验', () => {
  it('放行常见的 id 与字段名', () => {
    assert.doesNotThrow(() => assertIdentifier('coco-i18n-inspect', 'Script.id'))
    assert.doesNotThrow(() => assertIdentifier('custom_url2', '字段名'))
  })

  it('拦下会破坏键结构的字符', () => {
    // 含 `.` 的字段名会生成永远反解不回来的键，表现为「配置改了不生效」
    for (const bad of ['has.dot', 'has space', 'has@at', '']) {
      assert.throws(() => assertIdentifier(bad, '字段名'), /只能包含/)
    }
  })
})
