interface FeatureActionBase {
  /** 同一个功能内唯一，用作列表的 key，也便于在日志里指认 */
  id: string
  label: string
  /** 副标题。动作脱离上下文后，光看标题经常猜不出会发生什么 */
  description?: string
  /** iconify class，如 `i-bx--window-open` */
  icon?: string
}

/**
 * 有明确开关语义的动作，用 Switch 呈现。
 *
 * 比「进入 X」「退出 X」两条互斥的触发式动作好：开关直接表达当前状态，不需要读文字，
 * 也不会出现「明明已经在 X 里、列表却还写着进入」的时序错觉。
 */
export interface FeatureToggleAction extends FeatureActionBase {
  type: 'toggle'
  checked: boolean
  onChange: (checked: boolean) => void
}

/** 点一下就执行的动作，整行可点。 */
export interface FeatureTriggerAction extends FeatureActionBase {
  type: 'trigger'
  onTrigger: () => void
}

export type FeatureAction = FeatureToggleAction | FeatureTriggerAction

/**
 * 功能的动作注册表。
 *
 * **为什么是运行时注册，而不是写进 `SettingsSchema`**：schema 是「不执行功能也能读」的
 * 具名导出 —— 配置面板正是靠这一点列出当前页面不匹配的功能。而动作的 handler 必须闭包住
 * 功能的运行时状态（哪个 tab 是打开的、审查模式在不在），静态对象里根本表达不了。
 * 所以配置是声明式的、动作是命令式的，两者的生命周期本就不同：**只有正在运行的功能才有动作**。
 *
 * 顺带解决了跨 React 树的问题：动作渲染在配置面板那棵树里（它有自己的 shadow root，
 * 由 `openSettings` 挂载），拿不到功能组件的 state。这个注册表就是两棵树之间的桥。
 */
const registry = new Map<string, FeatureAction[]>()
const listeners = new Set<() => void>()

/**
 * 未注册时返回同一个空数组。
 *
 * `useSyncExternalStore` 要求快照引用稳定，每次返回新的 `[]` 会无限重渲染 ——
 * 这个坑在这里尤其隐蔽，因为「没有动作」是最常见的情况（多数功能只有配置）。
 */
const EMPTY: readonly FeatureAction[] = []

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

/**
 * 注册某个功能的动作，返回注销函数。
 *
 * 每次调用整体替换该功能的动作列表，而不是追加：动作的可用性会随功能状态变化
 * （审查模式开着时是「退出」、关着时是「进入」），增量维护必然漏删。
 *
 * 调用方通常在 effect 里调用它，并把返回值当清理函数 —— 功能卸载后面板里就不该
 * 再留着点了没反应的条目。
 */
export function registerFeatureActions(scriptId: string, actions: FeatureAction[]): () => void {
  registry.set(scriptId, actions)
  emit()

  return () => {
    // 只有仍是自己那批时才删：功能重挂载时新的注册已经覆盖过来了，
    // 此时旧 effect 的清理不该把新的一起带走
    if (registry.get(scriptId) === actions) {
      registry.delete(scriptId)
      emit()
    }
  }
}

export function getFeatureActions(scriptId: string): readonly FeatureAction[] {
  return registry.get(scriptId) ?? EMPTY
}

export function subscribeFeatureActions(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
