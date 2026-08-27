import { useCallback, useMemo, useSyncExternalStore } from 'react'

import { getFeatureActions, subscribeFeatureActions } from '@/helpers/settings/actions'
import type { FeatureAction } from '@/helpers/settings/actions'
import { getSettingsRevision, subscribeSettingsRevision } from '@/helpers/settings/revision'
import { createSettingsStore } from '@/helpers/settings/storage'
import { schemaDefaults } from '@/helpers/settings/types'
import type { SettingsSchema, SettingsValues } from '@/helpers/settings/types'

/**
 * 在功能里读取自己的配置，值变化时自动重渲染。
 *
 * 两个来源都订阅：本标签页在配置面板里的改动（版本号），以及其他标签页的改动
 * （`GM_addValueChangeListener`）。所以「在设置里改一下，页面立刻变」和
 * 「在另一个标签页改，这个标签页也变」都成立，不需要功能侧写任何同步逻辑。
 */
export function useSettings(namespace: string, schema: SettingsSchema) {
  const store = useMemo(() => createSettingsStore(namespace), [namespace])
  const fields = useMemo(() => Object.keys(schema.fields ?? {}), [schema])
  const defaults = useMemo(() => schemaDefaults(schema), [schema])

  const revision = useSyncExternalStore(
    useCallback((onStoreChange) => {
      const unsubscribes = [
        subscribeSettingsRevision(onStoreChange),
        ...fields.map((key) => store.subscribe(key, onStoreChange)),
      ]
      return () => {
        for (const unsubscribe of unsubscribes) {
          unsubscribe()
        }
      }
    }, [store, fields]),
    getSettingsRevision,
  )

  const values: SettingsValues = useMemo(() => {
    void revision
    return Object.fromEntries(fields.map((key) => [key, store.get(key, defaults[key])]))
  }, [store, fields, defaults, revision])

  return { values, store }
}

/**
 * 订阅某个功能注册的动作。
 *
 * 订阅点故意只有这一处：配置分组要根据「上面有没有内容」决定画不画分隔线，也就得知道
 * 动作有几条。若让分组自己再读一次注册表，就会漏掉订阅 —— 动作注销时分组不重渲染，
 * 那条线会留在原地悬着。
 *
 * hook 放这里而不是 `helpers/settings/actions.ts`：那个模块被 `node --test` 直接加载，
 * 不能依赖 React（见 docs/verify-loop.md「不需要浏览器的那一半」）。
 */
export function useFeatureActions(namespace: string): readonly FeatureAction[] {
  return useSyncExternalStore(
    subscribeFeatureActions,
    useCallback(() => getFeatureActions(namespace), [namespace]),
  )
}
