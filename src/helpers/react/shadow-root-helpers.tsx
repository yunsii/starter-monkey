import { StyleProvider } from '@ant-design/cssinjs'
import { ConfigProvider } from 'antd'
import React from 'react'
import { createPortal } from 'react-dom'
import ReactDOM from 'react-dom/client'

import InlineTailwindCSS from '@/components/inline-tailwindcss'
import { MountContextProvider } from '@/contexts/mount-context'
import { NAMESPACE } from '@/helpers/namespace'
import type { ShadowRootContentScriptUiOptions } from '@/helpers/ui/shadow-root'
import { MAX_Z_INDEX } from '@/helpers/ui/shared'

// Extract the onMount function type from the existing shadow-root options type.
type OnMountFunction = ShadowRootContentScriptUiOptions<unknown>['onMount']

// Derive a mountContext type from the parameters of onMount. Fallback to DOM types.
type MountContextFromOnMount = OnMountFunction extends (...args: any[]) => any
  ? Parameters<OnMountFunction> extends [infer A, infer B, infer C]
    ? ({ uiContainer: A, shadow: B, shadowHost: C })
    : never
  : never

export function reactRenderInShadowRoot(
  mountContext: MountContextFromOnMount,
  app: (() => Promise<{ default: React.ComponentType }>) | React.ReactNode,
) {
  const { uiContainer, shadow } = mountContext

  const _app = typeof app === 'function' ? React.createElement(React.lazy(app)) : app

  const rootContext = document.createElement('div')
  rootContext.id = `${NAMESPACE}-root`
  // React 树和弹层容器分开：组件库的弹层需要一个不受 React diff 影响的挂载点，
  // 详见 `MountContext.popupContainer`
  const reactRootContainer = document.createElement('div')
  reactRootContainer.id = `${NAMESPACE}-react-root`
  const popupContainer = document.createElement('div')
  popupContainer.id = `${NAMESPACE}-popup-root`
  // `position: fixed` 而不是默认的 static：`detached` 的宿主是 0×0 且 `overflow: hidden`，
  // 而组件库的弹层是绝对定位的 —— 容器不定位的话，弹层的包含块就是宿主，像素会被整个裁掉
  // （布局矩形照样正常，所以只看 getBoundingClientRect 是发现不了的，要用命中测试）。
  // 定成 fixed 之后容器自己脱离了宿主的裁剪，且它固定在 (0,0)、尺寸为 0，
  // 弹层相对它的绝对坐标恰好就是视口坐标，和弹层库算出来的值一致。
  //
  // 但 `position: fixed` 同时会创建层叠上下文，于是这个容器成了一道墙：里面的弹层写多大的
  // `z-index` 都只在墙内有效，整棵子树以容器自己的 `z-index` 参与外层排序。容器不写
  // `z-index` 就是 `auto`，页面上任何 `z-index > 0` 的元素都能盖住它 —— 实测一个
  // `sticky top-0 z-30` 的页面头部，能压住容器里 `z-index: 2147483000` 的模态遮罩。
  // 宿主是 `inline` 时尤其要紧：那种宿主留在文档流里、不带 z-index，指望不上它兜底。
  popupContainer.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;z-index:${MAX_Z_INDEX}`
  rootContext.append(reactRootContainer, popupContainer)
  uiContainer.appendChild(rootContext)
  const root = ReactDOM.createRoot(reactRootContainer)

  const targetHead = shadow.querySelector('head')

  if (!targetHead) {
    console.error('No head element found in shadow root')
    return
  }

  const portal = createPortal(<InlineTailwindCSS />, targetHead)

  root.render(
    <React.StrictMode>
      {portal}
      <MountContextProvider {...mountContext} popupContainer={popupContainer}>
        {/*
          antd 的样式注入到 shadow root 内，而不是 document —— 否则 shadow root 里
          什么都拿不到。`layer` 把 antd 的样式装进 `@layer antd`，但**只开这里的 `layer`
          是不够的** —— 它不声明 antd 相对 Tailwind 各层的先后。顺序由
          `components/inline-tailwindcss/tailwind-config.css` 顶部那行声明钉住，
          两者缺一不可，Tailwind 的工具类才能覆盖 antd 默认样式，不用靠 `!important` 打架。
        */}
        <StyleProvider container={shadow} layer>
          <ConfigProvider
            // 弹层（Popover / Select / Tooltip）默认 portal 到 `document.body`，
            // 出了 shadow root 就丢样式，必须指回 shadow 内的真实元素
            getPopupContainer={() => popupContainer}
            getTargetContainer={() => uiContainer}
            // 只决定弹层容器**内部**的先后：容器自己已经顶到 z-index 上限，页面层级不靠这个值。
            // 留在上限附近是为了压过渲染在 React 树里的抽屉，让色板这类弹层浮在抽屉之上。
            theme={{ token: { zIndexPopupBase: 2147483000 } }}
          >
            {_app}
          </ConfigProvider>
        </StyleProvider>
      </MountContextProvider>
    </React.StrictMode>,
  )

  return root
}
