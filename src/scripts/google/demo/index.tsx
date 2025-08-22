import { reactRenderInShadowRoot } from '@/helpers/react/shadow-root-helpers'
import { createShadowRootUi } from '@/helpers/ui/shadow-root'

const Script: Userscript = async () => {
  const ui = await createShadowRootUi(
    {
      name: 'google-demo',
      position: 'inline',
      anchor: 'body',
      onMount: (container, shadowRoot) => {
        return reactRenderInShadowRoot(container, shadowRoot, () => import('./App'))
      },
    },
  )

  ui.mount()
}

Script.displayName = 'google-demo'
Script.matches = ['https://www.google.com/']

export default Script
