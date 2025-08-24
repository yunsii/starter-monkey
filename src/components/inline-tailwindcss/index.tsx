import { useEffect } from 'react'

import inlineTailwindCSS from './tailwind-config.css?inline'

export default function InlineTailwindCSS() {
  // ref: https://github.com/tailwindlabs/tailwindcss/issues/15005#issuecomment-2621978261
  useEffect(() => {
    if (document.querySelector('style[data-tailwind-at-properties]')) {
      return
    }

    const atProperties = inlineTailwindCSS.slice(inlineTailwindCSS.indexOf('@property'))
    const style = document.createElement('style')
    style.textContent = atProperties
    style.setAttribute('data-tailwind-at-properties', '')
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])
  return <style>{inlineTailwindCSS}</style>
}
