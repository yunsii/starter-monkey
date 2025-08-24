import React from 'react'
import { createPortal } from 'react-dom'
import ReactDOM from 'react-dom/client'

import InlineTailwindCSS from '@/components/inline-tailwindcss'
import { MountContextProvider } from '@/contexts/mount-context'
import type { ShadowRootContentScriptUiOptions } from '@/helpers/ui/shadow-root'

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
  rootContext.id = 'starter-monkey-root'
  uiContainer.appendChild(rootContext)
  const root = ReactDOM.createRoot(rootContext)

  const targetHead = shadow.querySelector('head')

  if (!targetHead) {
    console.error('No head element found in shadow root')
    return
  }

  const portal = createPortal(<InlineTailwindCSS />, targetHead)

  root.render(
    <React.StrictMode>
      {portal}
      <MountContextProvider {...mountContext}>
        {_app}
      </MountContextProvider>
    </React.StrictMode>,
  )

  return root
}
