import { useCallback, useEffect, useRef, useState } from 'react'
import { useElementsMutationObserver } from 'react-dx'

import ShadowModal from '@/components/shadow-modal'
import { createShadowModalStore } from '@/components/shadow-modal/store'

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
  /**
   * 默认 `2147483647`，见 `ContentScriptDetachedPositioningOptions.zIndex`。
   *
   * 早先这里默认 999，在真实站点上是很容易被页面元素盖住的量级。
   */
  zIndex?: number
  content: React.ReactNode
}

export function useShadowModal(options: UseShadowModalOptions) {
  const { name, zIndex, content } = options

  // 只创建一次。content 后续通过下面的 effect 推进 store，不参与 shadow UI 的重建条件——
  // 调用方传的多半是内联 JSX，每次 render 都是新引用，放进依赖数组会导致整个 UI 反复重建
  const [store] = useState(() => createShadowModalStore(content))

  useEffect(() => {
    store.setState({ content })
  }, [store, content])

  useEffect(() => {
    let disposed = false
    let ui: ShadowRootUi<ReturnType<typeof reactRenderInShadowRoot>> | null = null

    createShadowRootUi({
      name,
      // detached 而不是 modal：modal 会把宿主撑成 `fixed; inset: 0`，常驻挂载会吞掉整页点击，
      // 所以旧实现只能靠 mount/remove 来开合——而 remove 并不会 unmount React root，
      // 每开合一次就泄漏一棵 React 树。detached 的宿主是 0×0，可以一直挂着，开合交给 React 状态
      position: 'detached',
      zIndex,
      onMount: (uiContainer, shadow, shadowHost) => {
        return reactRenderInShadowRoot(
          { uiContainer, shadow, shadowHost },
          <ShadowModal store={store} />,
        )
      },
      onRemove: (root) => root?.unmount(),
    }).then((created) => {
      // 创建是异步的，期间组件可能已经卸载
      if (disposed) {
        created.remove()
        return
      }
      ui = created
      created.mount()
    })

    return () => {
      disposed = true
      ui?.remove()
    }
  }, [name, zIndex, store])

  const toggleModal = useCallback(() => {
    store.setState({ open: !store.getSnapshot().open })
  }, [store])

  return {
    toggleModal,
  }
}
