/// <reference types="node" />
// 这个文件由 `node --test` 直接执行，而 `tsconfig.json` 是面向浏览器的（lib 只有 DOM/ESNext）。
// TypeScript 7 不再隐式带上 `@types/node`，所以要显式声明。

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compileIncludePattern, matchesInclude } from './include-pattern.ts'

// 用带锚点的真实形状，而不是简化的假模式：这个 bug 的要害正是 `^` 与定界符，
// 简化掉任意一个都测不出来。
const ANCHORED_LITERAL = /^https:\/\/.*\.example\.com\//
const ANCHORED_STRING = '/^https?:\\/\\/([^/]*\\.)?localhost[:/]/'

describe('compileIncludePattern', () => {
  it('RegExp 字面量原样返回', () => {
    assert.equal(compileIncludePattern(ANCHORED_LITERAL), ANCHORED_LITERAL)
  })

  it('剥掉 /.../ 定界符，否则 ^ 永远断言失败', () => {
    const re = compileIncludePattern(ANCHORED_STRING)
    assert.equal(re.source, '^https?:\\/\\/([^/]*\\.)?localhost[:/]')
    assert.ok(re.test('http://api.example.localhost:3000/'))
  })

  it('保留 flags', () => {
    assert.equal(compileIncludePattern('/abc/i').flags, 'i')
  })

  it('剥掉 g / y —— 它们会让同一个实例第二次 test 就不命中', () => {
    assert.equal(compileIncludePattern(/abc/g).flags, '')
    assert.equal(compileIncludePattern(/abc/giy).flags, 'i')
    assert.equal(compileIncludePattern('/abc/gi').flags, 'i')
  })

  it('不带定界符直接报错，不按裸正则编译', () => {
    // 通配符形式当正则读会过度匹配（`.` 是任意字符、`/*` 是零或多个斜杠），
    // 静默按正则编译等于让脚本可能在 Tampermonkey 本不会注入的宿主上执行
    assert.throws(() => compileIncludePattern('https://example.com/*'), /必须写成带定界符/)
    assert.throws(() => compileIncludePattern('*://example.com/*'), /必须写成带定界符/)
    assert.throws(() => compileIncludePattern('^https://example\\.com/'), /必须写成带定界符/)
  })
})

describe('matchesInclude', () => {
  it('锚定模式对着裸 href 测——包一层斜杠就永远不命中', () => {
    assert.ok(matchesInclude([ANCHORED_LITERAL], 'https://foo.example.com/a/b'))
    assert.ok(matchesInclude([ANCHORED_STRING], 'https://app.localhost/'))
  })

  it('不命中的照样不命中', () => {
    assert.equal(matchesInclude([ANCHORED_LITERAL], 'https://example.org/'), false)
    // `.localhost` 是 RFC 6761 保留 TLD，`localhost.evil.com` 不该被带进来
    assert.equal(matchesInclude([ANCHORED_STRING], 'https://localhost.evil.com/'), false)
  })

  it('空列表不命中——修复前这里返回空数组，被当成真值', () => {
    assert.equal(matchesInclude([], 'https://foo.example.com/'), false)
  })

  it('同一条字面量反复匹配，结果稳定', () => {
    // getUserscripts() 会被调用多次（main.ts 一次，之后每次打开设置面板再一次），
    // 共享的 RegExp 实例带 `g` 时结果会隔次翻转：脚本执行了，面板却显示未生效
    const stateful = /example\.com/g
    const results = [1, 2, 3, 4].map(() => matchesInclude([stateful], 'https://example.com/a'))
    assert.deepEqual(results, [true, true, true, true])
  })

  it('模式非法时抛出，由调用方决定怎么降级', () => {
    // flags 写错的形式过得了定界符检查，只有真正编译时才暴露
    assert.throws(() => matchesInclude(['/foo/bar'], 'https://example.com/'), /Invalid flags/)
  })
})
