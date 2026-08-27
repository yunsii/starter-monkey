/**
 * 自定义元素名的合法形状：小写字母开头，且**必须含至少一个连字符**。
 *
 * HTML 规范对 custom element name 的要求，`customElements.define` 不满足就抛
 * `SyntaxError`。实测：`mydemo`（没有连字符）和 `MyDemo`（有大写）都抛，`my-demo` 才行。
 *
 * 导出出去是因为有两个地方要用同一条规则：下面的 `NAMESPACE` 自校验，以及构建期对
 * `Script.id` 的校验（`scripts/script-infos.ts`）—— 那个 id 会被直接当元素名使用。
 */
export const CUSTOM_ELEMENT_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/

/**
 * 全局命名前缀。
 *
 * 之前 DOM 属性、元素 id、日志前缀各写各的（`data-monkey-shadow-root` / `data-starter-monkey`
 * / 元素 id 后缀 `-root`），fork 本模板的人要改名得全仓 grep。集中到这里之后只需改这一处。
 *
 * **只能是小写字母、数字和连字符。** 它不只是个前缀：`helpers/settings/open.tsx` 和
 * `entry.tsx` 拿它拼出**自定义元素名**（后面接 `-settings` 之类），一旦含大写或下划线，
 * `customElements.define` 会抛 `SyntaxError`，症状是整个配置 UI 直接没有 —— 而不是
 * 「名字不好看」。所以下面 import 即校验，写错在最早的时刻就炸。
 */
export const NAMESPACE = 'starter-monkey'

// 拼接时会补上连字符，所以这里只要求「本身是合法元素名的前半段」：全小写、数字、连字符。
if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(NAMESPACE)) {
  throw new Error(
    `NAMESPACE 只能是小写字母、数字和连字符，收到：${JSON.stringify(NAMESPACE)}\n`
    + '提示：它会被拼成自定义元素名（后面接 -settings 之类），含大写或下划线时 '
    + 'customElements.define 会抛 SyntaxError，表现为配置 UI 整个不出现。',
  )
}

/**
 * 短前缀，用于 CSS 变量这类既要短又必须全局唯一的场景（见 `components/inline-tailwindcss`
 * 对 Tailwind 内部 `--tw-*` 变量的重命名）。
 */
export const SHORT_NAMESPACE = 'sm'
