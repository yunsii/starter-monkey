import SettingsHost from '@/components/settings/host'
import { reactRenderInShadowRoot } from '@/helpers/react/shadow-root-helpers'
import { createShadowRootUi } from '@/helpers/ui/shadow-root'
import type { ShadowRootUi } from '@/helpers/ui/shadow-root'

import { getUserscripts } from '../scripts'

const HOST_NAME = 'starter-monkey-settings'

let ui: ShadowRootUi<ReturnType<typeof reactRenderInShadowRoot>> | null = null
let opening: Promise<void> | null = null

/**
 * 面板状态放在模块里而不是组件 state：它由命令式 API 驱动（`openSettings` 可能来自
 * 油猴菜单、功能内按钮、悬浮入口），组件只是订阅者。
 */
export interface SettingsUiState {
  /** 抽屉是否展开。与「宿主是否挂载」分开，才能放完关闭动画再卸载 */
  open: boolean
  /** 定位目标：`<Script.id>` 或 `<Script.id>.<field>` */
  target?: string
  /**
   * 每次 `openSettings` 调用递增。
   *
   * 只看 `target` 是不够的：面板已经开着、又对同一个功能再点一次定位时，`target` 没变，
   * 状态去重会把它当成「什么都没发生」，于是不切页也不滚动。请求号让每次调用都是一次
   * 可区分的请求。
   */
  request: number
}

let state: SettingsUiState = { open: false, request: 0 }
const listeners = new Set<() => void>()

export function getSettingsUiState(): SettingsUiState {
  return state
}

export function subscribeSettingsUi(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setState(next: SettingsUiState) {
  // 快照必须稳定，无变化时不能换引用，否则 useSyncExternalStore 会无限重渲染
  if (next.open === state.open && next.target === state.target && next.request === state.request) {
    return
  }
  state = next
  for (const listener of listeners) {
    listener()
  }
}

/**
 * 定位目标已经用掉了，从状态里清掉（面板保持展开）。
 *
 * 定位是一次性命令，不是常驻状态。留着它的话，任何一次重新挂载都会把定位重放一遍 ——
 * 切到「功能」页再切回来时 `SettingsPanel` 就是卸载重建的，`useEffect` 的依赖只在同一次
 * 挂载内去重，管不到跨挂载，于是又滚一次；目标恰好是最后一个区块时下方没内容可滚，
 * 滚动位置被夹到最大值，表现就是「一切回设置页就跳到底部」（实测踩过）。
 */
export function consumeSettingsTarget(): void {
  setState({ open: state.open, request: state.request })
}

/** 收起抽屉，动画结束后由 `destroySettings` 真正卸载。 */
export function collapseSettings(): void {
  setState({ ...state, open: false })
}

/**
 * 卸载配置面板。
 *
 * 卸载而不是留着隐藏：卸载后引用计数会把 document 级的 `@property` 样式一并移除，
 * 页面回到打开之前的状态。低频入口值得这么换 —— 代价只是下次打开重新挂一次。
 */
export function destroySettings(): void {
  const current = ui
  ui = null
  // 定位目标随卸载清掉，请求号保留：它只用来区分「这是新的一次请求」
  setState({ open: false, request: state.request })

  // 让出一个宏任务再拆：这个函数由抽屉的 `afterOpenChange` 触发，仍处在 React 的
  // 渲染阶段内，同步 `root.unmount()` 会报
  // "Attempted to synchronously unmount a root while React was already rendering"。
  setTimeout(() => {
    current?.remove()
  }, 0)
}

/**
 * 打开聚合配置面板，可选定位到某个功能或字段。
 *
 * ```ts
 * openSettings()                    // 总览
 * openSettings('v2ex-demo')         // 定位到某功能
 * openSettings('v2ex-demo.apiBase') // 定位到某字段
 * ```
 *
 * 首次调用才创建 shadow 宿主、才注入 document 级样式；在此之前页面上一片干净。
 * 可重入：已经打开时再调用只是换定位目标，不重建。
 *
 * 返回的 Promise 在面板挂载后 resolve —— 给验证循环用，业务侧不需要 await。
 */
export async function openSettings(target?: string): Promise<void> {
  if (ui) {
    setState({ open: true, target, request: state.request + 1 })
    return
  }

  // 并发调用（例如用户连点两次）只创建一个宿主
  opening ??= (async () => {
    const scripts = await getUserscripts()
    const created = await createShadowRootUi({
      name: HOST_NAME,
      // detached 而不是 modal：modal 的宿主会撑成 `fixed; inset: 0` 铺满页面，
      // 而这里的内容自己用 fixed 定位，宿主保持 0×0 就够了
      position: 'detached',
      onMount: (uiContainer, shadow, shadowHost) => {
        return reactRenderInShadowRoot(
          { uiContainer, shadow, shadowHost },
          <SettingsHost scripts={scripts} />,
        )
      },
      onRemove: (root) => root?.unmount(),
    })
    ui = created
    created.mount()
  })()

  try {
    await opening
  } finally {
    opening = null
  }

  // 挂载时是收起态，让出一个宏任务再展开，React 因此会把"关闭"和"打开"提交成两帧，
  // 抽屉拿到真正的 false→true 过渡。
  //
  // 用 `setTimeout` 而不是 `requestAnimationFrame`：rAF 在隐藏标签页里不触发，
  // 用它会让 `openSettings()` 在后台标签页中永远不 resolve（实测踩过）。
  // 定时器在后台只是被节流，仍然会执行。
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
  setState({ open: true, target, request: state.request + 1 })
}
