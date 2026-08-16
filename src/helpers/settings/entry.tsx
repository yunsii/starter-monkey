import SettingsFloatingEntry from '@/components/settings/floating-entry'
import { logger } from '@/helpers/logger'
import { reactRenderInShadowRoot } from '@/helpers/react/shadow-root-helpers'
import { createShadowRootUi } from '@/helpers/ui/shadow-root'
import type { ShadowRootUi } from '@/helpers/ui/shadow-root'

import { commonSettingsSchema, commonSettingsStore } from './common'
import { openSettings } from './open'
import { subscribeSettingsRevision } from './revision'

const HOST_NAME = 'starter-monkey-settings-entry'
const FIELD = 'showFloatingEntry'

let ui: ShadowRootUi<ReturnType<typeof reactRenderInShadowRoot>> | null = null

/**
 * 所有挂载/卸载都排在这条链上串行执行。
 *
 * 必须串行：`sync` 有两个触发源（GM 的跨标签变更监听 + 本标签的版本号），点一次开关
 * 两个都会触发；而创建 shadow UI 是异步的，`if (ui) return` 这种守卫在两个并发调用里
 * 会双双通过，结果是页面上挂出两个悬浮入口。实测踩过。
 */
let queue: Promise<void> = Promise.resolve()

function enabled(): boolean {
  return commonSettingsStore.get(
    FIELD,
    commonSettingsSchema.fields![FIELD].default as boolean,
  )
}

/**
 * 把当前挂载状态对齐到配置。
 *
 * 在任务真正执行的那一刻才读配置并比对，所以重复调用是幂等的 —— 触发几次都只会收敛到
 * 同一个结果，不需要调用方去重。
 */
function sync(): Promise<void> {
  queue = queue.then(async () => {
    const want = enabled()
    if (want && !ui) {
      const created = await createShadowRootUi({
        name: HOST_NAME,
        position: 'detached',
        onMount: (uiContainer, shadow, shadowHost) => {
          return reactRenderInShadowRoot(
            { uiContainer, shadow, shadowHost },
            <SettingsFloatingEntry onOpen={() => void openSettings()} />,
          )
        },
        onRemove: (root) => root?.unmount(),
      })
      ui = created
      created.mount()
    } else if (!want && ui) {
      const current = ui
      ui = null
      current.remove()
    }
  }).catch((cause: unknown) => {
    logger.error('同步悬浮入口失败', cause)
  })
  return queue
}

/**
 * 按配置挂载/卸载页面悬浮入口。
 *
 * 关闭时**完全不挂载**，而不是挂了再隐藏 —— 这是本模板对「低侵入」的可操作定义：
 * 用户没开启时，页面上不应该出现自定义元素、shadow root，也不应该注入 document 级的
 * `@property` 样式。
 *
 * 同时订阅配置变化：在配置面板里打开开关应当立刻生效，不需要刷新页面；
 * 在另一个标签页里改也一样（GM 的变更监听覆盖跨标签场景）。
 */
export async function mountSettingsEntry(): Promise<void> {
  commonSettingsStore.subscribe(FIELD, () => {
    void sync()
  })
  subscribeSettingsRevision(() => {
    void sync()
  })

  await sync()
}
