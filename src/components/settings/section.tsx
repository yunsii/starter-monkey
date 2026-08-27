import { useCallback, useMemo, useSyncExternalStore } from 'react'

import { logger } from '@/helpers/logger'
import { FEATURE_ENABLED_FIELD } from '@/helpers/settings/feature-toggle'
import {
  bumpSettingsRevision,
  getSettingsRevision,
  subscribeSettingsRevision,
} from '@/helpers/settings/revision'
import { createSettingsStore } from '@/helpers/settings/storage'
import { schemaDefaults } from '@/helpers/settings/types'
import type { SettingsField, SettingsSchema, SettingsValues } from '@/helpers/settings/types'

import SettingsActions from './actions'
import SettingsFieldRow from './field'

export interface SettingsSectionProps {
  /** `Script.id`，同时是配置的存储命名空间 */
  namespace: string
  title: string
  schema: SettingsSchema
}

/**
 * 一个功能的配置分组。
 *
 * 值不进 React state，而是直接读 GM 存储、由版本号驱动重渲染。这样本标签页的写入和
 * 其他标签页的写入走同一条更新路径，不需要两套同步逻辑，也不会出现「界面和存储不一致」。
 */
export default function SettingsSection(props: SettingsSectionProps) {
  const { namespace, title, schema } = props

  const store = useMemo(() => createSettingsStore(namespace), [namespace])
  const fields = useMemo(() => {
    const entries = Object.entries(schema.fields ?? {})
    // `enabled` 是框架保留字段（启用开关存在同一个命名空间下），功能再声明一个同名的
    // 会互相覆盖。这里挡掉并出声，而不是让它表现成「开关时灵时不灵」
    const reserved = entries.filter(([key]) => key === FEATURE_ENABLED_FIELD)
    if (reserved.length > 0) {
      logger.warn(`配置字段 "${FEATURE_ENABLED_FIELD}" 是框架保留名（功能的启用开关），已忽略：${namespace}`)
    }
    return entries.filter(([key]) => key !== FEATURE_ENABLED_FIELD)
  }, [schema, namespace])
  const defaults = useMemo(() => schemaDefaults(schema), [schema])

  const revision = useSyncExternalStore(
    useCallback((onStoreChange) => {
      // 两个来源都要订阅：GM 监听负责其他标签页，本地版本号负责当前标签页
      const unsubscribes = [
        subscribeSettingsRevision(onStoreChange),
        ...fields.map(([key]) => store.subscribe(key, onStoreChange)),
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
    return Object.fromEntries(
      fields.map(([key]) => [key, store.get(key, defaults[key])]),
    )
  }, [store, fields, defaults, revision])

  const write = (key: string, value: unknown) => {
    store.set(key, value)
    bumpSettingsRevision()
    schema.fields?.[key]?.onChange?.(value as never)
  }

  // 呈现顺序由框架定死（见 `SettingsSchema` 的注释）：常规字段 → 动作 → render → 进阶字段。
  // 进阶字段单独拆出来而不是靠声明顺序，是因为它要落在动作**之后**，
  // 而动作是运行时注册的、声明方看不见
  const renderField = ([key, field]: [string, SettingsField]) => {
    if (field.visible && !field.visible(values)) {
      return null
    }
    return (
      <SettingsFieldRow
        key={key}
        field={field}
        value={values[key]}
        onChange={(value) => write(key, value)}
      />
    )
  }

  const normalFields = fields.filter(([, field]) => !field.advanced)
  const advancedFields = fields.filter(([, field]) => field.advanced)
  const advancedRows = advancedFields.map(renderField).filter(Boolean)

  return (
    <section className='flex flex-col gap-2'>
      <h3 className='m-0 text-sm font-semibold text-gray-800'>{title}</h3>
      {schema.description && (
        <p className='m-0 text-xs text-gray-400'>{schema.description}</p>
      )}

      {normalFields.map(renderField)}

      <SettingsActions namespace={namespace} />

      {schema.render?.({ store, values, setValue: write })}

      {/*
        分隔线只在真的有进阶项、且上面有内容时才出现 —— 一条悬空的线比没有线更难解释。
        不给标题：加一行「进阶」会让这一小段看起来像另一个分组，而它属于同一个功能。
      */}
      {advancedRows.length > 0 && (
        <div className='mt-1 flex flex-col gap-2 border-t border-gray-200 pt-3'>
          {advancedRows}
        </div>
      )}
    </section>
  )
}
