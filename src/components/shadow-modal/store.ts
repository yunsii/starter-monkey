export interface ShadowModalState {
  open: boolean
  content: React.ReactNode
}

/**
 * 弹窗状态存在 React 树之外。
 *
 * shadow root 里的内容跑在一棵独立的 React 树上，拿不到外层的 state；而把开关状态放回外层
 * 又意味着每次开合都要重建 shadow UI。用一个极小的外部 store 把两棵树接起来，
 * shadow UI 只需创建一次，开关和内容更新都只是一次普通的 re-render。
 */
export function createShadowModalStore(initialContent: React.ReactNode) {
  let state: ShadowModalState = { open: false, content: initialContent }
  const listeners = new Set<() => void>()

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    setState: (patch: Partial<ShadowModalState>) => {
      const next = { ...state, ...patch }
      // useSyncExternalStore 要求快照稳定，无变化时不能换引用，否则会无限重渲染
      if (next.open === state.open && next.content === state.content) {
        return
      }
      state = next
      listeners.forEach((listener) => {
        listener()
      })
    },
  }
}

export type ShadowModalStore = ReturnType<typeof createShadowModalStore>
