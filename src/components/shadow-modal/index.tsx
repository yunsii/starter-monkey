import { useSyncExternalStore } from 'react'

import type { ShadowModalStore } from './store'

export interface ShadowModalProps {
  store: ShadowModalStore
}

/**
 * `useShadowModal` 渲染在 shadow root 里的那一层：遮罩 + 居中容器。
 *
 * 只负责呈现，开合与内容都来自 `store`，所以宿主的 shadow UI 创建一次就够了。
 */
export default function ShadowModal(props: ShadowModalProps) {
  const { store } = props
  const { open, content } = useSyncExternalStore(store.subscribe, store.getSnapshot)

  if (!open) {
    return null
  }

  return (
    <div
      // `fixed` 而不是 `absolute`：detached 的宿主是 0×0 且 `overflow: hidden`，
      // 同时是绝对定位后代的包含块，`absolute inset-0` 会塌成 0×0 再被裁掉
      className={`
        fixed inset-0 flex items-center justify-center backdrop-blur-lg
      `}
      onClick={() => {
        store.setState({ open: false })
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
    </div>
  )
}
