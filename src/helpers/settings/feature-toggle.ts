import { createSettingsStore } from './storage'

/**
 * 功能的启用开关。
 *
 * 这是**框架能力**而不是各功能自己声明的配置项：每个功能都需要它，语义完全相同，
 * 让每个功能都在自己的 schema 里重写一遍，既是重复，也会让「启用」这件事散落在
 * 各个分组里而不是集中在功能列表上。
 *
 * 存在功能自己的命名空间下，所以 `enabled` 是**保留字段名**，功能的 schema 不能再声明它。
 */
export const FEATURE_ENABLED_FIELD = 'enabled'

/** 缺省视为启用：装了脚本却默认什么都不跑，不符合预期。 */
export function isFeatureEnabled(scriptId: string): boolean {
  return createSettingsStore(scriptId).get(FEATURE_ENABLED_FIELD, true)
}

export function setFeatureEnabled(scriptId: string, enabled: boolean): void {
  createSettingsStore(scriptId).set(FEATURE_ENABLED_FIELD, enabled)
}
