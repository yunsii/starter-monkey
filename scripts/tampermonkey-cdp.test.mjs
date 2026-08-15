import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { rewriteUserscriptMeta } from './tampermonkey-cdp.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// 用数组而不是模板字符串：元数据全靠行首锚点匹配，而 `unicorn/template-indent`
// 的自动修复会给模板字符串统一加缩进，把夹具悄悄改坏。
const SAMPLE = [
  '// ==UserScript==',
  '// @name               Starter Monkey',
  '// @name:en            Starter Monkey',
  '// @name:zh-CN         起始猴',
  '// @namespace          yuns',
  '// @version            0.1.1',
  '// @downloadURL        https://example.com/x.user.js',
  '// @updateURL          https://example.com/x.meta.js',
  '// @match              https://www.v2ex.com/',
  '// ==/UserScript==',
  `console.log('body untouched')`,
  '',
].join('\n')

describe('rewriteUserscriptMeta', () => {
  it('用产物里的 @name 而不是包名作为基名', () => {
    const { baseName, localName } = rewriteUserscriptMeta(SAMPLE)
    assert.equal(baseName, 'Starter Monkey')
    assert.equal(localName, 'Starter Monkey (local build)')
  })

  it('改掉所有 @name 本地化变体', () => {
    // 只改 `@name` 的话，Tampermonkey 面板显示的是本地化名（这里是「起始猴」），
    // 于是看起来像没装上——实际是装了一个重名副本，两份一起注入。
    const { source } = rewriteUserscriptMeta(SAMPLE)
    const names = [...source.matchAll(/^\/\/ @name(?::[\w-]+)?[ \t]+(?<value>[^\n]*)/gm)]
      .map((match) => match.groups.value.trim())
    assert.equal(names.length, 3)
    assert.deepEqual(new Set(names), new Set(['Starter Monkey (local build)']))
  })

  it('删掉更新地址，避免被自动更新换回线上版', () => {
    const { source } = rewriteUserscriptMeta(SAMPLE)
    assert.ok(!source.includes('@downloadURL'))
    assert.ok(!source.includes('@updateURL'))
  })

  it('换掉 @namespace，让本地构建与已发布版并存而不是覆盖', () => {
    const { source } = rewriteUserscriptMeta(SAMPLE)
    assert.match(source, /^\/\/ @namespace\s+user\/starter-monkey-local-build$/m)
    assert.ok(!/^\/\/ @namespace\s+yuns$/m.test(source))
  })

  it('不碰元数据块之外的脚本正文', () => {
    const { source } = rewriteUserscriptMeta(SAMPLE)
    assert.ok(source.includes(`console.log('body untouched')`))
  })

  it('没有 @name 时退回一个占位名而不是抛错', () => {
    const { baseName } = rewriteUserscriptMeta('// ==UserScript==\n// ==/UserScript==\n')
    assert.equal(baseName, 'userscript')
  })
})

describe('真实构建产物', () => {
  const bundle = join(ROOT, 'dist', 'starter-monkey.user.js')

  it('改写后仍是合法的 userscript 元数据块', { skip: !existsSync(bundle) && '还没构建，先跑 pnpm build' }, () => {
    const { source, localName } = rewriteUserscriptMeta(readFileSync(bundle, 'utf8'))
    assert.match(source, /^\/\/ ==UserScript==$/m)
    assert.match(source, /^\/\/ ==\/UserScript==$/m)
    assert.ok(source.includes(localName))
    // 改写不应动到 @match：本地构建要落在和已发布版相同的页面上才有验证意义
    const matches = [...source.matchAll(/^\/\/ @match[ \t]+(?<value>[^\n]*)/gm)].map((m) => m.groups.value.trim())
    assert.ok(matches.length > 0, '产物里应当有 @match')
  })
})
