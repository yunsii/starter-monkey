import { useEffect, useRef } from 'react'
import { useElementsMutationObserver } from 'react-dx'

interface UiLike { mount: () => void, remove: () => void }

export function useCreateUis(
  selectors: string,
  createFn: (element: Element) => Promise<UiLike>,
) {
  const uiMap = useRef<WeakMap<Element, UiLike>>(new WeakMap())
  const versionMap = useRef(new WeakMap<Element, number>())

  useElementsMutationObserver<Element>(selectors, {
    onMount: (element) => {
      // helpers with clearer names
      const removeUiSafe = (ui?: UiLike) => {
        if (!ui) {
          return
        }
        try {
          ui.remove()
        } catch (e) {
          /* ignore */
        }
      }
      const mountUiSafe = (ui?: UiLike) => {
        if (!ui) {
          return
        }
        try {
          ui.mount()
        } catch (e) {
          /* ignore */
        }
      }

      // 1) increment version for this element
      const prevVersion = versionMap.current.get(element) ?? 0
      const currentVersion = prevVersion + 1
      versionMap.current.set(element, currentVersion)

      // 2) start creation (allow concurrent creates). When done, only the latest version is kept
      createFn(element).then((createdUi) => {
        const latestVersion = versionMap.current.get(element) ?? 0
        if (latestVersion !== currentVersion) {
          // stale ui instance, remove and exit
          removeUiSafe(createdUi)
          return
        }

        // 3) we're the latest: replace previous instance and mount
        const previousUi = uiMap.current.get(element)
        if (previousUi && previousUi !== createdUi) {
          removeUiSafe(previousUi)
        }

        uiMap.current.set(element, createdUi)
        mountUiSafe(createdUi)
      })
    },
  })

  return {
    // convenient helper to get the current mounted ui for an element
    getUiForElement: (el: Element) => uiMap.current.get(el),
  }
}

export default useCreateUis

export interface UseShadowModalOptions {
  name: string
  /** default 999 */
  zIndex?: number
  content: React.ReactNode
}

export function useShadowModal(options: UseShadowModalOptions) {
  const { name, zIndex = 999, content } = options

  const modalUi = useRef<ShadowRootUi | null>(null)
  const openRef = useRef(false)

  const toggleModal = () => {
    openRef.current = !openRef.current
    if (openRef.current) {
      modalUi.current?.mount()
    } else {
      modalUi.current?.remove()
    }
  }

  useEffect(() => {
    createShadowRootUi({
      name,
      position: 'modal',
      zIndex,
      onMount: (container, shadowRoot, shadowHost) => {
        shadowHost.style.display = 'block'
        return reactRenderInShadowRoot(
          { uiContainer: container, shadow: shadowRoot, shadowHost },
          <div
            className={`
              absolute inset-0 flex items-center justify-center backdrop-blur-lg
            `}
            onClick={() => {
              toggleModal()
            }}
          >
            <div
              className='max-h-[80vh] min-h-20 w-130 max-w-[80vw]'
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              {content}
            </div>
          </div>,
        )
      },
    }).then((ui) => {
      if (modalUi.current) {
        modalUi.current.remove()
      }
      modalUi.current = ui
      if (openRef.current) {
        ui.mount()
      }
    })
  }, [name, zIndex, content])

  return {
    toggleModal,
  }
}
