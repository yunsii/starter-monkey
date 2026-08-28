/// <reference types="node" />
// 这个文件由 `node --test` 直接执行，被测模块只碰字符串，不依赖浏览器 / GM API。

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { remToPx } from './px-utilities.ts'

describe('remToPx', () => {
  it('换算声明里的数值', () => {
    assert.equal(remToPx('.p-4{padding:1rem}'), '.p-4{padding:16px}')
    assert.equal(remToPx('--spacing:0.25rem'), '--spacing:4px')
    assert.equal(remToPx('margin:1.5rem .5rem'), 'margin:24px 8px')
  })

  it('负值跟着符号一起换', () => {
    // `-1rem` 里的 `-` 本身就是分隔符，换完仍是 `-16px`
    assert.equal(remToPx('margin-top:-1rem'), 'margin-top:-16px')
    assert.equal(remToPx('translate:-.5rem'), 'translate:-8px')
  })

  it('不动类名里的 rem —— 那是作者写的字面量，改了就选不中了', () => {
    // `min-w-[1.5rem]` 这种任意值写法，类名必须原样保留，只换声明里的值
    assert.equal(
      remToPx('.min-w-\\[1\\.5rem\\]{min-width:1.5rem}'),
      '.min-w-\\[1\\.5rem\\]{min-width:24px}',
    )
  })

  it('不动自定义属性名里碰巧出现的片段', () => {
    assert.equal(remToPx('--my-1rem-token:2rem'), '--my-1rem-token:32px')
  })

  it('calc 里的也换', () => {
    assert.equal(remToPx('width:calc(100% - 2rem)'), 'width:calc(100% - 32px)')
  })

  it('媒体查询换掉是等价的（媒体查询里的相对单位按初始字号解析）', () => {
    assert.equal(remToPx('@media (min-width:40rem){a{b:c}}'), '@media (min-width:640px){a{b:c}}')
  })

  it('范围写法的媒体查询换不到，也不需要换', () => {
    // Tailwind v4 输出的是 `width>=40rem`，`=` 不在分隔符里。媒体查询按初始字号解析，
    // 留着 rem 一样对；而把 `=` 收进分隔符会连带改坏 `[data-size=1rem]` 这类属性选择器
    assert.equal(remToPx('@media (width>=40rem){a{b:c}}'), '@media (width>=40rem){a{b:c}}')
  })

  it('不留浮点尾巴', () => {
    // 乘 16 是乘 2 的幂，浮点上精确；换成非 2 的幂的基准就会冒出 0.8000000000000001 这种值
    assert.equal(remToPx('letter-spacing:0.05rem'), 'letter-spacing:0.8px')
  })

  it('没有 rem 的 CSS 原样返回（插件靠这个跳过无关文件）', () => {
    const css = '.a{color:red;width:10px}'
    assert.equal(remToPx(css), css)
  })
})
