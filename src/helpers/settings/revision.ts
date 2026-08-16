/**
 * 本标签页内的配置版本号。
 *
 * 为什么需要它：`GM_addValueChangeListener` 只在**其他标签页**写入时回调，本标签页
 * 自己 `GM_setValue` 不会触发。只订阅 GM 的话，用户点了开关界面纹丝不动。
 *
 * 用自增数字而不是快照对象，是因为 `useSyncExternalStore` 要求快照引用稳定 ——
 * 每次读 GM 都会得到新对象，直接当快照会导致无限重渲染。版本号变了再去现读。
 */
let revision = 0
const listeners = new Set<() => void>()

export function getSettingsRevision(): number {
  return revision
}

/** 本标签页写入配置后调用，通知界面重新读取。 */
export function bumpSettingsRevision(): void {
  revision += 1
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeSettingsRevision(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
