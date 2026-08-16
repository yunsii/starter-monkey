import { GM_info } from '$'

import { NAMESPACE } from '@/helpers/namespace'

import { COMMON_NAMESPACE } from './keys'
import { createSettingsStore } from './storage'

import type { SettingsSchema } from './types'

/**
 * 悬浮入口的悬停提示，默认取用户脚本自己的名字。
 *
 * 取脚本名而不是写死一句「脚本配置」：装了多个基于本模板的脚本时，页面边缘会出现好几条
 * 一模一样的指示条，提示里不带名字就分不清哪条是哪个脚本的。
 *
 * `GM_info` 在非油猴环境下不存在（比如把组件放进普通页面调试），回落到命名空间。
 */
export const DEFAULT_ENTRY_TITLE = GM_info?.script?.name ?? NAMESPACE

export const ENTRY_TITLE_FIELD = 'entryTitle'

/** 半透明中性灰：在深浅两种宿主页面上都还能看清，又不抢注意力 */
export const DEFAULT_ENTRY_BACKGROUND = 'rgba(107, 114, 128, 0.14)'
export const DEFAULT_ENTRY_BAR_COLOR = 'rgba(55, 65, 81, 0.65)'

export const ENTRY_BACKGROUND_FIELD = 'entryBackground'
export const ENTRY_BAR_COLOR_FIELD = 'entryBarColor'
export const ENTRY_BAR_LENGTH_FIELD = 'entryBarLength'

/** 指示条长度（px）。容器高度由它加上四周内边距推出，不单独配置。 */
export const DEFAULT_ENTRY_BAR_LENGTH = 64
export const MIN_ENTRY_BAR_LENGTH = 24
export const MAX_ENTRY_BAR_LENGTH = 200

/** 指示条到容器边缘的距离，四周相同。 */
export const ENTRY_PADDING = 6

/**
 * 跨功能共享的框架级配置。
 *
 * 硬规则：功能永远不写别的功能的命名空间。两个功能需要同一个值时，把它**提升**到这里，
 * 是一次显式动作 —— 否则会长出隐式依赖，删掉功能 A 会让功能 B 悄悄坏掉。
 */
export const commonSettingsSchema: SettingsSchema = {
  title: '通用',
  fields: {
    showFloatingEntry: {
      type: 'boolean',
      label: '页面悬浮入口',
      description: '在页面边缘显示一个常驻的配置入口，可上下拖动、也可拖到左右任意一侧。默认关闭 —— 不开启时脚本不会往页面添加任何元素，配置仍可从油猴菜单进入。',
      default: false,
    },
    entryTitle: {
      type: 'string',
      label: '入口悬停提示',
      description: `鼠标停在入口上时显示的文字。默认是这个用户脚本的名字（${DEFAULT_ENTRY_TITLE}），留空即恢复默认。`,
      default: DEFAULT_ENTRY_TITLE,
      placeholder: DEFAULT_ENTRY_TITLE,
      visible: (values) => values.showFloatingEntry === true,
    },
    // 颜色可配，是因为这个入口要压在任意宿主页面上：深色站、花哨背景、
    // 或者恰好和站点主色撞了，一套写死的配色不可能都合适
    entryBackground: {
      type: 'color',
      label: '入口容器底色',
      default: DEFAULT_ENTRY_BACKGROUND,
      alpha: true,
      visible: (values) => values.showFloatingEntry === true,
    },
    entryBarColor: {
      type: 'color',
      label: '入口指示条颜色',
      default: DEFAULT_ENTRY_BAR_COLOR,
      alpha: true,
      visible: (values) => values.showFloatingEntry === true,
    },
    entryBarLength: {
      type: 'number',
      label: '入口指示条长度',
      description: '容器高度会跟着这个值走，四周内边距保持不变',
      default: DEFAULT_ENTRY_BAR_LENGTH,
      min: MIN_ENTRY_BAR_LENGTH,
      max: MAX_ENTRY_BAR_LENGTH,
      suffix: 'px',
      visible: (values) => values.showFloatingEntry === true,
    },
  },
}

export const commonSettingsStore = createSettingsStore(COMMON_NAMESPACE)

export const COMMON_SETTINGS_ID = COMMON_NAMESPACE

/**
 * 悬浮入口被拖到哪儿了。
 *
 * 刻意**不放进 schema**：schema 里的字段会渲染成配置表单，而"贴哪条边、纵向多少"
 * 是拖拽的结果而非用户要填的东西，列出来只会让人对着一个坐标发呆。
 */
export const ENTRY_EDGE_FIELD = 'entryEdge'
export const ENTRY_OFFSET_FIELD = 'entryOffset'

export type EntryEdge = 'left' | 'right'

export const DEFAULT_ENTRY_EDGE: EntryEdge = 'right'
/** 纵向位置，视口高度的比例 —— 用比例而不是像素，窗口缩放后不会跑到视口外 */
export const DEFAULT_ENTRY_OFFSET = 0.5
