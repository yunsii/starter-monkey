// 带扩展名的相对导入，而不是仓库里通用的 `@/` 别名：这个文件是纯逻辑，由
// `keys.test.ts` 通过 `node --test` 直接执行（Node 22 原生剥离类型），而 Node 不认
// tsconfig 的路径别名。为了让它可测，这一个 import 用 Node 也能解析的写法。
import { NAMESPACE } from '../namespace.ts'

/**
 * 跨功能共享配置的命名空间。
 *
 * 功能私有配置用 `Script.id` 作命名空间。硬规则：功能永远不写别的功能的命名空间 ——
 * 两个功能需要同一个值时，把它**提升**到这里，是一次显式动作；否则会长出隐式依赖，
 * 删掉功能 A 会让功能 B 悄悄坏掉。
 */
export const COMMON_NAMESPACE = 'common'

/** GM 存储里所有本模板配置项的统一前缀，便于 `GM_listValues` 扫描与人工辨认。 */
const KEY_PREFIX = `${NAMESPACE}:`

/**
 * 配置项的存储键。
 *
 * 作用域只按**功能**划分（命名空间就是 `Script.id`），不按站点。GM 存储本身是脚本级、
 * 跨站共享的，所以一个功能匹配多个站点时，它们天然共用同一份配置 —— 这正是想要的行为，
 * 不需要额外机制。
 */
export function settingKey(namespace: string, field: string): string {
  return `${KEY_PREFIX}${namespace}.${field}`
}

export interface ParsedKey {
  namespace: string
  field: string
}

/**
 * 反解一个 GM 键，供配置面板按功能归集已存的配置。
 *
 * 不是本模板的键返回 `null` —— GM 存储是整个脚本共用的，将来放别的东西时不能误判。
 */
export function parseKey(key: string): ParsedKey | null {
  if (!key.startsWith(KEY_PREFIX)) {
    return null
  }

  const body = key.slice(KEY_PREFIX.length)
  // 从最后一个 `.` 切分：namespace 不允许含 `.`，但这样写对将来放宽更宽容
  const dot = body.lastIndexOf('.')
  if (dot <= 0 || dot === body.length - 1) {
    return null
  }

  return {
    namespace: body.slice(0, dot),
    field: body.slice(dot + 1),
  }
}

/** 列出某个命名空间下已经存过值的字段，输入是 `GM_listValues()` 的结果。 */
export function listStoredFields(
  allKeys: readonly string[],
  namespace: string,
): string[] {
  return allKeys
    .map(parseKey)
    .filter((parsed): parsed is ParsedKey => parsed != null && parsed.namespace === namespace)
    .map((parsed) => parsed.field)
}

/**
 * 命名空间与字段名的合法性。
 *
 * 在开发期就炸掉，而不是让一个含 `.` 的字段名生成出永远反解不回来的键 —— 那种错误
 * 只会表现为「配置改了不生效」，排查成本极高。
 */
export function assertIdentifier(value: string, what: string): void {
  if (!/^[\w-]+$/.test(value)) {
    throw new Error(`${what} 只能包含字母、数字、下划线和连字符，收到：${JSON.stringify(value)}`)
  }
}
