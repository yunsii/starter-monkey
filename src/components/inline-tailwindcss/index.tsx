import { useEffect } from 'react'

import { SHORT_NAMESPACE } from '@/helpers/namespace'
import { acquireDocumentStyle } from '@/helpers/ui/document-styles'
import { splitShadowRootCss } from '@/helpers/ui/split-shadow-root-css'

import inlineTailwindCSSRaw from './tailwind-config.css?inline'

// Tailwind v4 硬编码了一批 `--tw-*` 内部变量，官方没有重命名它们的开关：
// `@import 'tailwindcss' prefix(...)` 只改类名和 `@theme` 变量，改不到这些内部变量。
// 而下面的 `@property` 又必须注册在 document 作用域才生效，也就是说这些变量名一定会
// 泄漏到宿主页面上——宿主自己在用 Tailwind v4 时（尤其是版本不同）就会互相污染。
//
// 在这里一次性改写，`@property` 注册和所有 `var(--tw-*)` 引用会一起改掉，样式内部保持自洽，
// 泄漏到页面上的也只剩自带命名空间的变量。
const namespacedCss = inlineTailwindCSSRaw.replaceAll('--tw-', `--${SHORT_NAMESPACE}-tw-`)

// ref: https://github.com/tailwindlabs/tailwindcss/issues/15005#issuecomment-2621978261
//
// 复用 UI 模块拆分 document 级规则的逻辑，而不是在这里手写一遍 `slice(indexOf('@property'))`：
// 那份实现依赖「`@property` 之后再无其他规则」这个 Tailwind 产物的巧合，一旦产物结构变了会静默出错。
const { shadowCss, documentCss } = splitShadowRootCss(namespacedCss)

export default function InlineTailwindCSS() {
  // 引用计数由 `acquireDocumentStyle` 负责：多个 shadow UI 同时挂载时共用一个 `<style>`，
  // 且只有最后一个卸载时才移除。
  useEffect(() => acquireDocumentStyle(documentCss), [])

  return <style>{shadowCss}</style>
}
