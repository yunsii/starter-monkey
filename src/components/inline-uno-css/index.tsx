import { useEffect } from 'react'
import inlineUnoCss from 'virtual:uno.css?inline'

export default function InlineUnoCss() {
  // ref: https://github.com/tailwindlabs/tailwindcss/issues/15005#issuecomment-2621978261
  useEffect(() => {
    const atProperties = inlineUnoCss.split('\n').filter((item) => {
      return item.startsWith('@property')
    }).join('\n')

    const style = document.createElement('style')
    style.textContent = atProperties
    style.setAttribute('data-uno-at-properties', '')
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])
  return <style>{inlineUnoCss}</style>
}
