interface FeatureActionBase {
  /** 同一个功能内唯一，用作列表的 key */
  id: string
  label: string
  /** 副标题。动作脱离上下文后，光看标题经常猜不出会发生什么 */
  description?: string
  /**
   * iconify class，如 `i-bx--edit`。
   *
   * **必须是源码里的字面量。** Tailwind 是扫源文件的原始文本来决定生成哪些类，
   * 从配置、接口或字符串拼接来的图标名扫不到，产物里就没有对应规则 —— 症状是图标位置
   * 一片空白，而 class 明明挂上去了。同一个约束也管着 `Script.matches` / `Script.includes`。
   */
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
  /**
   * **注册时的快照，不是活引用。**
   *
   * 面板上的 Switch 直接由它驱动，而动作是个静态对象：状态变了必须重新
   * `registerFeatureActions` 才能推动它。实践上就是把那个状态写进注册 effect 的依赖数组
   * —— 漏了的话开关会一直停在旧值，点了不动，而症状完全不指向这里。
   * 参照 `src/scripts/v2ex/demo/app.tsx`。
   */
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
 * 每次注册/注销递增。
 *
 * 配置面板要回答「这个功能该不该出现」——一个只注册了动作、没有任何配置项的功能也得出现，
 * 否则它的动作没有落脚的地方。那个判断跨所有功能，没法用单个 `getFeatureActions` 的引用
 * 当快照，所以给一个稳定的版本号（原始值，`useSyncExternalStore` 不会因它无限重渲染）。
 */
let revision = 0

/**
 * 未注册时返回同一个空数组。
 *
 * `useSyncExternalStore` 要求快照引用稳定，每次返回新的 `[]` 会无限重渲染 ——
 * 这个坑在这里尤其隐蔽，因为「没有动作」是最常见的情况（多数功能只有配置）。
 */
const EMPTY: readonly FeatureAction[] = []

function emit() {
  revision += 1
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

export function getFeatureActionsRevision(): number {
  return revision
}

/**
 * 这个功能在配置面板里有没有东西可显示：声明了配置项，或注册了动作。
 *
 * 抽成一处是因为有两个消费方必须给出同一个答案 —— 面板要不要列出这一组
 * （`components/settings/index.tsx`），以及功能页的齿轮能不能点
 * （`components/settings/feature-list.tsx`）。两边各写一遍，迟早出现「齿轮能点、
 * 跳过去却是空的」或者反过来「有动作却没有入口」。
 */
export function detectHasPanelContent(scriptId: string, hasSettings: boolean): boolean {
  return hasSettings || getFeatureActions(scriptId).length > 0
}

export function subscribeFeatureActions(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
