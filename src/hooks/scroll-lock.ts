import { useEffect } from 'react'

import { acquireDocumentStyle } from '@/helpers/ui/document-styles'

/**
 * 打开期间锁住宿主页面的滚动。
 *
 * antd 的 Drawer 自带滚动锁，但它只在 portal 容器**就是 `document.body`** 时才启用
 * （`@rc-component/portal` 的 `Portal.js`：
 * `useScrollLocker(autoLock && open && (mergedContainer === defaultContainer || mergedContainer === document.body))`）。
 * 我们的抽屉 portal 在 shadow root 里，那个条件不成立，表现就是抽屉开着、背后的页面还能滚。
 *
 * 形式上照 antd 来：往宿主页 `<head>` 注一段样式，而不是改 `html` / `body` 的内联样式。
 * 内联样式要自己快照与还原，而宿主页在抽屉开着期间也可能改自己的内联 `overflow`，
 * 还原时就会把人家的改动一起抹掉；样式表只要移除就干净了。
 *
 * `html` 和 `body` 都锁：绝大多数页面滚的是 `html`（根元素的 overflow 会传播到视口），
 * 但也有站点写成 `html { overflow: hidden }` + `body { overflow: auto }`，这时只锁 `html`
 * 挡不住。带 `!important`：这是注进任意宿主页的用户脚本，站点自己的
 * `html { overflow-y: scroll }` 之类随时可能在特异性或先后顺序上赢过我们 ——
 * 而锁没锁上的后果不只是页面能滚，还会让下面的补偿补在错误的前提上。
 *
 * 补偿用 `scrollbar-gutter: stable` 而不是 antd 的 `width: calc(100% - Npx)`（也不是
 * 早先这里的 `padding-right`）。后两者都只救得回**文档流**里的内容：滚动条消失后视口确实变宽，
 * 而 `position: fixed` 的包含块就是视口，于是宿主站点的固定顶栏、以及我们自己的悬浮入口
 * 都会向右扩一条滚动条的宽度。gutter 让槽位常驻，视口可用宽度根本不变，两类元素一起不动。
 *
 * v2ex 实测（1902px 视口、DPR 1.25、真实滚动条宽 15.2px）：
 *
 * | 做法                                    | fixed 可用宽    | 流内容左       |
 * | --------------------------------------- | --------------- | -------------- |
 * | 未锁                                    | 1886.4          | 393.2          |
 * | 只 `overflow: hidden`                   | 1901.6          | 400.8          |
 * | + `padding-right`（旧）                 | 1901.6          | 392.8          |
 * | + `width: calc(100% - N)`（antd 原样）  | 1901.6          | 393.2          |
 * | + `scrollbar-gutter: stable`（现在）    | **1886.4**      | **393.2**      |
 *
 * 旧做法那 0.4px 的偏移是另一个坑：`window.innerWidth` 与 `clientWidth` 都是整数，
 * 分数缩放下算出来是 16px 而真实是 15.2px，过补的 0.8px 在居中布局上表现为左移 0.4px。
 * gutter 方案不需要量宽度，这个精度问题一并消失。
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return
    }
    return lockDocumentScroll()
  }, [locked])
}

/** 当前持有锁的使用者数量，以及第一个使用者拿到的样式释放函数。 */
let activeLocks = 0
let releaseLockStyle: (() => void) | null = null

/**
 * 引用计数放在这一层，而不是直接交给 `acquireDocumentStyle`。
 *
 * 后者以 CSS 文本为 key，而我们的 CSS 文本取决于**上锁之前**的量测：第二个锁如果自己再量一次，
 * 量到的是「滚动条已经没了、gutter 已经是 stable」，于是拼出另一段 CSS、拿到另一个 `<style>`。
 * 等第一个锁释放，带走的是含 gutter 那一份，而 `overflow: hidden` 仍被第二份按着 ——
 * 页面正好在这一刻向右跳一条滚动条，也就是这次要消除的那个现象。
 *
 * 所以只有第一个锁量测并注入，后来的锁复用它；全部释放后才移除。
 */
function lockDocumentScroll(): () => void {
  activeLocks += 1
  if (activeLocks === 1) {
    releaseLockStyle = acquireDocumentStyle(buildLockCss())
  }

  let released = false

  return () => {
    if (released) {
      return
    }
    released = true
    activeLocks -= 1
    if (activeLocks <= 0) {
      activeLocks = 0
      releaseLockStyle?.()
      releaseLockStyle = null
    }
  }
}

/**
 * 拼出锁定用的 CSS。**必须在上锁之前调用**，它读的是页面当前的滚动条状态。
 *
 * gutter 只加在**本来就有滚动条**的那个元素上。它是「槽位常驻」而不是「保持现状」：
 * 加在没有滚动条的滚动容器上会凭空占走一条，反方向抖一下 —— 实测把页面变矮（无滚动条）
 * 后加 gutter，fixed 可用宽 1901.6 → 1886.4。
 *
 * 而 `body` 尤其要小心：我们自己把它设成 `overflow: hidden` 就已经让它变成滚动容器了，
 * 无条件给它加 gutter 等于在页面内部凭空挖掉一条。
 */
function buildLockCss(): string {
  const root = document.documentElement
  const { body } = document
  const bodyStyle = getComputedStyle(body)

  // 根元素的 `clientWidth` 返回的是视口宽度（不含滚动条），所以这个差值就是视口滚动条的宽度；
  // 无滚动条、或系统用覆盖式滚动条（不占位、也就不会有抖动）时为 0
  const viewportScrollbar = window.innerWidth - root.clientWidth

  // body 自己的滚动条要减掉左右边框：`offsetWidth` 是边框盒、`clientWidth` 是内边距盒减滚动条，
  // 差值里含边框。实测给 body 加 1px 边框，未减边框时差值就是 1 —— 足以误判成「body 有滚动条」，
  // 于是在页面内部凭空挖走一条 gutter，正是上面要避免的那种反向抖动
  const bodyBorders = (Number.parseFloat(bodyStyle.borderLeftWidth) || 0)
    + (Number.parseFloat(bodyStyle.borderRightWidth) || 0)
  const bodyScrollbar = body.offsetWidth - body.clientWidth - bodyBorders

  // 支持性判断必须排在读 `scrollbarGutter` **之前**：不支持这个属性的引擎上
  // `getComputedStyle(el).scrollbarGutter` 是 `undefined`，`.includes()` 直接抛 TypeError
  // （实测确认过），抛在 effect 里就是一点都没锁上，而且下面这段兜底永远走不到。
  // TypeScript 挡不住它 —— `lib.dom` 把 `scrollbarGutter` 声明成 `string`
  if (!CSS.supports('scrollbar-gutter', 'stable')) {
    // 兜底：`scrollbar-gutter` 是 Chrome 94+ / Firefox 97+ / Safari 18.2+，用户脚本引擎
    // 所在的浏览器基本都有，这条几乎跑不到。退化成 antd 那套宽度补偿（只稳住流内容，
    // fixed 元素仍会跳）。取两处滚动条里实际存在的那个：站点滚 body 时视口那边量出来是 0
    const scrollbar = viewportScrollbar > 0 ? viewportScrollbar : Math.max(bodyScrollbar, 0)
    const compensation = scrollbar > 0
      ? `width:calc(100% - ${scrollbar}px)!important;`
      : ''
    return [
      'html{overflow:hidden!important;}',
      `body{overflow:hidden!important;${compensation}}`,
    ].join('\n')
  }

  // 站点自己开了 `scrollbar-gutter: stable` 时槽位已经常驻，`overflow: hidden` 之后
  // 它不会消失，此时不需要我们再加
  const hasStableGutter = (element: Element) =>
    getComputedStyle(element).scrollbarGutter.includes('stable')

  const rootGutter = viewportScrollbar > 0 && !hasStableGutter(root)
    ? 'scrollbar-gutter:stable!important;'
    : ''
  const bodyGutter = bodyScrollbar > 0 && !hasStableGutter(body)
    ? 'scrollbar-gutter:stable!important;'
    : ''

  return [
    `html{overflow:hidden!important;${rootGutter}}`,
    `body{overflow:hidden!important;${bodyGutter}}`,
  ].join('\n')
}
