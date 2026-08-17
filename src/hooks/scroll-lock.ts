import { useEffect } from 'react'

/**
 * 打开期间锁住宿主页面的滚动。
 *
 * antd 的 Drawer 自带滚动锁，但它锁的是自己所在的容器；我们的抽屉渲染在 shadow root 内，
 * 锁不到宿主页面上，表现就是抽屉开着、背后的页面还能滚。
 *
 * `html` 和 `body` 都锁：绝大多数页面滚的是 `html`（根元素的 overflow 会传播到视口），
 * 但也有站点写成 `html { overflow: hidden }` + `body { overflow: auto }`，这时只锁 `html`
 * 挡不住。两个都锁没有副作用，而漏掉一个就等于没锁。
 *
 * 顺手补上滚动条宽度：直接 `overflow: hidden` 会让滚动条消失、页面内容横向跳一下。
 * 关闭时精确还原原值，而不是清空 —— 宿主页面自己可能本来就设了这些属性。
 *
 * 已知盲区：`html` 的 padding 影响不了 `position: fixed` 的元素 —— 它们的包含块是视口，
 * 而视口在滚动条消失后确实变宽了，所以站点的固定顶栏仍会向右扩一个滚动条的宽度。
 * 这是 padding 补偿方案的固有局限（antd、Bootstrap、body-scroll-lock 都一样），
 * 要修就得去改宿主页面的布局样式，对一个用户脚本来说侵入太深，不做。
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return
    }

    const root = document.documentElement
    const { body } = document
    const previous = {
      rootOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
      rootPaddingRight: root.style.paddingRight,
    }
    // `innerWidth` 含滚动条，`clientWidth` 不含，差值就是滚动条宽度（无滚动条时为 0）。
    // 但站点自己开了 `scrollbar-gutter: stable` 时槽位是常驻的，`overflow: hidden`
    // 之后它不会消失，此时再补就是多补一次、往反方向跳。
    const gutterStable = getComputedStyle(root).scrollbarGutter.includes('stable')
    const scrollbarWidth = gutterStable ? 0 : window.innerWidth - root.clientWidth

    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(getComputedStyle(root).paddingRight) || 0
      root.style.paddingRight = `${currentPadding + scrollbarWidth}px`
    }

    return () => {
      root.style.overflow = previous.rootOverflow
      body.style.overflow = previous.bodyOverflow
      root.style.paddingRight = previous.rootPaddingRight
    }
  }, [locked])
}
