import { useElementsMutationObserver } from 'react-dx'

import { useMountContext } from '@/contexts/mount-context'

export interface UseSyncDocumentHeadElementsOptions {
  selectors: string
}

export function useSyncDocumentHeadElements(options: UseSyncDocumentHeadElementsOptions) {
  const { selectors } = options
  const { shadow } = useMountContext()

  useElementsMutationObserver(selectors, {
    rootElement: document.head,
    onMount: (element) => {
      const shadowHead = shadow.querySelector('head')

      if (!shadowHead) {
        return
      }

      const copiedElement = element.cloneNode(true)
      shadowHead.appendChild(copiedElement)

      return () => {
        shadowHead.removeChild(copiedElement)
      }
    },
  })
}
