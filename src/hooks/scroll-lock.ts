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
    // `innerWidth` 含滚动条，`clientWidth` 不含，差值就是滚动条宽度（无滚动条时为 0）
    const scrollbarWidth = window.innerWidth - root.clientWidth

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
