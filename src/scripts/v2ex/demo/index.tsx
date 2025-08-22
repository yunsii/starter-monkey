import { reactRenderInShadowRoot } from '@/helpers/react/shadow-root-helpers'
import { createShadowRootUi } from '@/helpers/ui/shadow-root'

const Script: Userscript = async () => {
  const ui = await createShadowRootUi(
    {
      name: 'v2ex-demo',
      position: 'inline',
      anchor: '#Rightbar table td:nth-child(3) span a',
      onMount: (container, shadowRoot) => {
        return reactRenderInShadowRoot(container, shadowRoot, () => import('./App'))
      },
    },
  )

  ui.mount()
}

Script.displayName = 'v2ex-demo'
Script.matches = ['https://www.v2ex.com/']

export default Script
