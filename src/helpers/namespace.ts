/**
 * 全局命名前缀。
 *
 * 之前 DOM 属性、元素 id、日志前缀各写各的（`data-monkey-shadow-root` / `data-starter-monkey`
 * / `starter-monkey-root`），fork 本模板的人要改名得全仓 grep。集中到这里之后只需改这一处。
 */
export const NAMESPACE = 'starter-monkey'

/**
 * 短前缀，用于 CSS 变量这类既要短又必须全局唯一的场景（见 `components/inline-tailwindcss`
 * 对 Tailwind 内部 `--tw-*` 变量的重命名）。
 */
export const SHORT_NAMESPACE = 'sm'
