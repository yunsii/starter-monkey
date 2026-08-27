import type { SettingsStore } from './storage'

/** 一个功能的配置取值集合，键是字段名。 */
export type SettingsValues = Record<string, unknown>

interface FieldBase<T> {
  label: string
  /**
   * 副标题。配置项脱离上下文后，光看 label 经常猜不出含义。
   *
   * 带 `description` 的字段会自动从「行式（label 左、控件右）」降级为竖排卡片。
   */
  description?: string
  default: T
  /**
   * 条件显示。返回 false 时该字段整行不渲染。
   *
   * 不是可选项：真实配置里「选了自定义才显示地址输入框」这种联动很常见，
   * 没有它就只能退回自定义渲染。
   */
  visible?: (values: SettingsValues) => boolean
  /**
   * 变更后的就地副作用，例如切换环境后刷新当前页。
   *
   * 跨标签页的联动请用 `SettingsStore.subscribe`，那条路径覆盖所有标签页；
   * 这里只处理「用户刚刚在这个面板上改了它」。
   */
  onChange?: (value: T) => void
  /**
   * 低频的进阶项，排到这一组的**最后**（动作与 `render` 之后），并与上面拉开一条分隔线。
   *
   * 是标记而不是 `order: number`：位置该由框架统一决定，各功能自己编号迟早会互相矛盾，
   * 而「这一项是不是进阶」是声明方唯一真正知道的事。开发者模式、诊断开关这类归它。
   */
  advanced?: boolean
}

export interface BooleanField extends FieldBase<boolean> {
  type: 'boolean'
}

export interface StringField extends FieldBase<string> {
  type: 'string'
  placeholder?: string
}

/** 多行文本。单行用 `string`。 */
export interface TextField extends FieldBase<string> {
  type: 'text'
  placeholder?: string
  rows?: number
}

export interface NumberField extends FieldBase<number> {
  type: 'number'
  min?: number
  max?: number
  /** 单位后缀，例如 `ms`、`次` */
  suffix?: string
}

export interface EnumOption {
  label: string
  value: string
}

/**
 * 单选。选项数 ≤ `SEGMENTED_MAX_OPTIONS` 时渲染成 Segmented，否则 Select ——
 * 由渲染器按选项数自动决定，声明方不需要再做一次这个选择。
 */
export interface EnumField extends FieldBase<string> {
  type: 'enum'
  options: EnumOption[]
}

/**
 * 颜色。值是 CSS 颜色字符串，直接可以塞进 `style`。
 *
 * 存 CSS 字符串而不是结构化的 rgba：读的一侧只想把它交给样式，中间多一层结构
 * 只会让每个使用者都得再拼一次。
 */
export interface ColorField extends FieldBase<string> {
  type: 'color'
  /** 是否允许调透明度。半透明容器这类需要，纯色文字之类不需要 */
  alpha?: boolean
}

export type SettingsField
  = | BooleanField
    | StringField
    | TextField
    | NumberField
    | EnumField
    | ColorField

export interface SettingsCustomRenderContext {
  store: SettingsStore
  values: SettingsValues
  setValue: (field: string, value: unknown) => void
}

/**
 * 一个功能的配置声明。
 *
 * 一组的呈现顺序是固定的，四段：
 *
 * ```
 * 常规字段 → 动作 → render 逃生舱 → 进阶字段（advanced）
 * ```
 *
 * 顺序由框架定死而不是交给声明方：各功能自己排，同一份面板里就会出现好几种阅读顺序。
 * 需要往「动作之后」放东西时，用字段的 `advanced` 标记，而不是把它塞进 `render`。
 *
 * **动作不在这里**。它们由正在运行的功能通过 `helpers/settings/actions.ts` 注册 ——
 * schema 是「不执行功能也能读」的静态声明（面板正是靠这一点列出当前页面不匹配的功能），
 * 而动作的 handler 必须闭包住运行时状态，静态对象表达不了。
 */
export interface SettingsSchema {
  /** 面板上这一组的标题，缺省时用功能的 `displayName`。 */
  title?: string
  description?: string
  fields?: Record<string, SettingsField>
  /**
   * 自定义渲染，追加在字段与动作之后。
   *
   * 用于 schema 表达不了的控件（快捷键录制、带校验的复合编辑器等）。
   * 约束：不能依赖「功能已经在当前页面跑起来」—— 配置面板会列出所有功能，
   * 包括在当前站点不活跃的那些，此时功能本体并未执行。要依赖运行时状态的是**动作**，
   * 走 `registerFeatureActions`。
   */
  render?: (context: SettingsCustomRenderContext) => React.ReactNode
}

/** 从 schema 取出全部字段的默认值。 */
export function schemaDefaults(schema: SettingsSchema): SettingsValues {
  return Object.fromEntries(
    Object.entries(schema.fields ?? {}).map(([key, field]) => [key, field.default]),
  )
}
