import {
  GM_addValueChangeListener,
  GM_deleteValue,
  GM_getValue,
  GM_listValues,
  GM_removeValueChangeListener,
  GM_setValue,
} from '$'

import { assertIdentifier, listStoredFields, settingKey } from './keys'

/**
 * 一个命名空间下的配置读写。
 *
 * 命名空间是 `Script.id`（功能私有）或 `COMMON_NAMESPACE`（跨功能共享）——
 * 作用域只按功能划分。GM 存储本身是脚本级、跨站共享的，所以一个功能匹配多个站点时，
 * 它们读写的是同一份配置。
 */
export function createSettingsStore(namespace: string) {
  assertIdentifier(namespace, '配置命名空间')

  return {
    namespace,

    /** 没存过值时返回传入的默认值，默认值因此可以随 schema 演进而不需要迁移。 */
    get<T>(field: string, fallback: T): T {
      return GM_getValue<T>(settingKey(namespace, field), fallback)
    },

    set<T>(field: string, value: T): void {
      assertIdentifier(field, '配置字段名')
      GM_setValue(settingKey(namespace, field), value)
    },

    /** 恢复默认值：删掉键即可，不需要额外的「是否已修改」标记位。 */
    reset(field: string): void {
      GM_deleteValue(settingKey(namespace, field))
    },

    /** 这个功能已经存过值的字段，供配置面板判断哪些项被改过。 */
    storedFields(): string[] {
      return listStoredFields(GM_listValues(), namespace)
    },

    /**
     * 订阅字段变化，返回取消订阅函数。
     *
     * 回调的 `remote` 为真表示改动来自另一个标签页 —— 这是让「在设置面板改一下，
     * 其他标签页立刻生效」成立的机制。
     */
    subscribe(field: string, onChange: (remote: boolean) => void): () => void {
      // `remote` 在部分引擎上可能缺省，按「本标签页改动」处理更安全：
      // 误判成远程只会多一次无害的重渲染，误判成本地则可能吞掉跨标签同步
      const id = GM_addValueChangeListener(
        settingKey(namespace, field),
        (_name, _old, _new, remote) => {
          onChange(remote ?? false)
        },
      )

      return () => {
        GM_removeValueChangeListener(id)
      }
    },
  }
}

export type SettingsStore = ReturnType<typeof createSettingsStore>
