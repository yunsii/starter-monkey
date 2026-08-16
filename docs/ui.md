# UI 挂载与样式隔离

## 何时读

改 `src/helpers/ui/`、`src/helpers/react/shadow-root-helpers.tsx`、`src/hooks/ui.tsx`、
`src/components/inline-tailwindcss/` 时，或者要在页面上放一个新的 UI 时。

实现基于 [wxt 的 content-script-ui](https://github.com/wxt-dev/wxt/blob/main/packages/wxt/src/utils/content-script-ui/shared.ts) 整理而来，`detached` 是本仓库额外加的。

两种挂载方式：

- `createShadowRootUi`（`shadow-root.ts`）：DOM + CSS 双向隔离，日常首选
- `createIntegratedUi`（`integrated.ts`）：直接注入页面 DOM，需要和宿主样式互相影响时才用

## 定位方式

| `position` | 宿主元素                         | 内容定位            | 典型场景                     |
| ---------- | -------------------------------- | ------------------- | ---------------------------- |
| `inline`   | 不做任何处理，跟随 `anchor` 排版 | 由页面流决定        | 在列表项后插一个按钮         |
| `overlay`  | `relative`，0×0                  | `absolute` + 对齐角 | 贴着某个元素浮一层           |
| `modal`    | `fixed`，铺满视口                | `fixed; inset: 0`   | 一次性的全屏遮罩             |
| `detached` | `fixed`，0×0，`overflow: hidden` | 完全由内容自己决定  | 常驻的悬浮按钮 / 抽屉 / 弹窗 |

`overlay` / `modal` / `detached` 的宿主默认带 `z-index: 2147483647`，可以通过 `zIndex` 覆盖。

> 这个默认值不是保险起见：宿主是 `position: fixed`，本身就会创建层叠上下文，写在内容上的
> `z-index` 无法跨出去。真正决定「会不会被页面盖住」的只有宿主这一层。

## detached

`detached` 是相对上游 wxt 增加的定位方式，用来解决 `modal` 的一个结构性问题：`modal` 会把宿主
撑成 `fixed; inset: 0`，常驻挂载时会吞掉整页点击，于是只能靠反复 `mount()` / `remove()` 来开合 ——
而 `remove()` 并不会 unmount React root，开合一次泄漏一棵 React 树。

`detached` 的宿主是 0×0，不遮挡页面，可以挂上去就不再摘下来，开合交给内部的 React 状态。
`hooks/ui.tsx` 里的 `useShadowModal` 就是这么实现的，可以直接参考。

用它有两条硬约束：

1. **内容必须用 `position: fixed` 定位。** 宿主是 0×0 且 `overflow: hidden`，同时是绝对定位后代的
   包含块 —— `absolute inset-0` 会先塌成 0×0，再被裁剪掉，页面上什么都看不到。`fixed` 后代的包含块
   是视口，不受这两者影响。
2. **`anchor` 尽量保持 `body` / `documentElement`。** `fixed` 只在宿主的祖先链上没有
   `transform` / `filter` / `backdrop-filter` / `will-change` / `contain` 时才相对视口定位；
   挂到页面深处的容器里，随时可能被某个祖先的 `transform` 劫持成相对定位。

## document 级样式

`@property` / `@font-face` 在 shadow root 内不生效，必须注册在 document 作用域。
`split-shadow-root-css.ts` 负责把它们从传入的 `css` 里拆出来，`document-styles.ts` 负责按引用计数
注入 `<head>` —— 相同内容只会存在一个 `<style>`，且只有最后一个使用者卸载时才移除。

`components/inline-tailwindcss` 走的是同一套机制。注意它会把 Tailwind 内部的 `--tw-*` 变量整体
重命名成 `--sm-tw-*`（前缀取自 `helpers/namespace.ts`），避免和宿主页面自己的 Tailwind 撞车。

## 弹层组件

组件库的弹层（Popover / Tooltip / Select）默认 portal 到 `document.body`，出了 shadow root 就拿不到
样式。`reactRenderInShadowRoot` 会在 React 树旁边准备一个空容器，通过 `useMountContext().popupContainer`
取用，传给组件库对应的参数即可（antd `getPopupContainer`、Radix / shadcn 的 `container`……）。

## 怎么验证

这一层的问题（被页面盖住、被裁剪掉、样式没进 shadow root）`pnpm build` 一个都发现不了，
必须在真实页面上看。用 [verify-loop.md](verify-loop.md) 的浏览器循环断言，例如：

```bash
pnpm verify eval "v2ex.com" "getComputedStyle(document.querySelector('v2ex-demo-editor')).zIndex"
```
