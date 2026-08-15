import { NAMESPACE } from '@/helpers/namespace'

const DOCUMENT_STYLE_ATTR = `data-${NAMESPACE}-document-styles`

interface DocumentStyleEntry {
  style: HTMLStyleElement
  count: number
}

const entries = new Map<string, DocumentStyleEntry>()
let seq = 0

/**
 * 把必须落在 document 作用域的 CSS（`@property`、`@font-face`）注入 `<head>`，按引用计数管理。
 *
 * 用引用计数而不是「存在就跳过」：后者会在第一个使用者卸载时把 `<style>` 拆掉，仍然存活的
 * 第二个 UI 会静默丢掉 `@property` 注册 —— 表现为 transform / gradient / shadow 这类
 * Tailwind 工具类突然不生效，且没有任何报错。
 *
 * 以 CSS 文本本身作为 key，相同内容只存在一个 `<style>`，同一个 UI 挂载多个实例时也不会
 * 在 `<head>` 里堆出一串重复标签。
 *
 * @returns 释放函数，幂等；最后一个使用者释放时才真正移除 `<style>`
 */
export function acquireDocumentStyle(css: string): () => void {
  const key = css.trim()

  if (!key) {
    return () => {}
  }

  let entry = entries.get(key)

  if (!entry) {
    const style = document.createElement('style')
    style.textContent = key
    style.setAttribute(DOCUMENT_STYLE_ATTR, String(seq++))
    // userscript 可能在 `document-start` 执行，此时 `document.head` 还不存在
    ;(document.head ?? document.documentElement).append(style)
    entry = { style, count: 0 }
    entries.set(key, entry)
  }

  entry.count += 1

  const acquired = entry
  let released = false

  return () => {
    if (released) {
      return
    }
    released = true
    acquired.count -= 1
    if (acquired.count <= 0) {
      acquired.style.remove()
      entries.delete(key)
    }
  }
}
