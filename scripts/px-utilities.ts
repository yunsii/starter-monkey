import type { Plugin } from 'vite'

import { NAMESPACE } from '../src/helpers/namespace.ts'

/**
 * Tailwind 的 `rem` 基准，也是浏览器默认的根字号。
 *
 * 取 16 还有个附带好处：乘 2 的幂在浮点里是精确的，换算不会冒出
 * `0.8000000000000001` 这种尾巴。
 */
const ROOT_FONT_SIZE = 16

/**
 * 把生成的 CSS 里的 `rem` 换算成 `px`。
 *
 * 起因是**宿主页会改根字号**。实测飞书登录页（`accounts.feishu.cn/open-apis/authen/v1/authorize`）
 * 用的是 rem 缩放方案，`html { font-size: 70px }`。Tailwind 的间距与字号都是 rem，于是注进去的
 * UI 整体被放大 4.4 倍 —— `text-sm` 算出来 61.25px（应为 14px）、`p-4` 是 70px（应为 16px）。
 *
 * **shadow root 挡不住这件事**：`rem` 永远相对**文档根元素**解析，与 shadow 边界无关
 * （同一页面里，shadow 内的 `text-sm` 实测同样是 61.25px）。所以样式隔离不能解决它，
 * 只能不用 rem。
 *
 * 换算发生在构建期、且对两类样式表都生效（`?inline` 给 shadow 的那份、以及注进 document 的
 * 普通 `.css` import），因此不需要在源码里逐个类名改写，也不需要维护一份 `@theme` token
 * 覆盖清单 —— Tailwind v4 的字号、圆角、容器宽度分散在几十个 token 里，漏一个就是漏一个。
 *
 * 媒体查询里的 `rem` 换与不换都对：媒体查询里的相对单位本来就按**初始**字号（16px）解析，
 * 不受 `html` 上的设置影响。所以 `@media (min-width:40rem)` 会被换掉（冒号是分隔符），
 * 而 Tailwind v4 现在输出的范围写法 `@media (width>=40rem)` 换不到 —— 两者都不影响正确性。
 * 特意**没有**把 `=` 收进分隔符：属性选择器（`data-[size=1rem]:` 生成的 `[data-size=1rem]`）
 * 的属性值不转义，把它一起换掉会静默改坏选择器，而收益仅是媒体查询写法上的统一。
 *
 * 管不到的部分：antd 通过 cssinjs 在运行时生成的样式不经过构建，这里换不到。目前无碍 ——
 * antd 的 design token 本身就是 px（`fontSize: 14`）。
 *
 * ⚠️ 必须排在 `tailwindcss()` **之后**：两者都是 `enforce: 'post'`，同相位内按数组顺序执行，
 * 排前面就会拿到 Tailwind 生成之前的源码（只有 `@import 'tailwindcss'` 一行，没有任何 rem
 * 可换），且不报错。
 */
export function pxUtilities(): Plugin {
  return {
    name: `${NAMESPACE}:px-utilities`,
    // post：要拿到 Tailwind 生成之后的最终 CSS
    enforce: 'post',
    transform(code, id) {
      if (!id.includes('.css')) {
        return
      }
      const next = remToPx(code)
      return next === code ? undefined : { code: next, map: null }
    },
  }
}

/**
 * 只换数值紧跟 `rem` 且其后不是标识符字符的那些。
 *
 * 前面必须是分隔符（空格 / 冒号 / 括号 / 逗号 / 运算符），避免动到
 * `--my-1rem-thing` 这种自定义属性名里的片段。
 */
export function remToPx(css: string): string {
  return css.replace(
    /(^|[\s:(,+\-*/])(\d+(?:\.\d+)?|\.\d+)rem(?![\w-])/g,
    (_match, prefix: string, value: string) => `${prefix}${Number(value) * ROOT_FONT_SIZE}px`,
  )
}
