import InlineUnoCss from '@/components/inline-uno-css'
import React from 'react'
import { createPortal } from 'react-dom'
import ReactDOM from 'react-dom/client'

export function reactRenderInShadowRoot(container: HTMLElement, shadowRoot: ShadowRoot, dynamicApp: () => Promise<{ default: React.ComponentType }>) {
  const DynamicApp = React.lazy(dynamicApp)
  const rootContext = document.createElement('div')
  rootContext.id = 'starter-monkey-root'
  container.appendChild(rootContext)
  const root = ReactDOM.createRoot(rootContext)

  const targetHead = shadowRoot.querySelector('head')

  if (!targetHead) {
    console.error('No head element found in shadow root')
    return
  }

  const portal = createPortal(<InlineUnoCss />, targetHead)

  root.render(
    <React.StrictMode>
      {portal}
      <DynamicApp />
    </React.StrictMode>,
  )
  return root
}
