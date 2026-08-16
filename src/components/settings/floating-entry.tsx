import { useRef, useState } from 'react'

import {
  commonSettingsSchema,
  commonSettingsStore,
  DEFAULT_ENTRY_EDGE,
  DEFAULT_ENTRY_OFFSET,
  DEFAULT_ENTRY_TITLE,
  ENTRY_BACKGROUND_FIELD,
  ENTRY_BAR_COLOR_FIELD,
  ENTRY_BAR_LENGTH_FIELD,
  ENTRY_EDGE_FIELD,
  ENTRY_OFFSET_FIELD,
  ENTRY_PADDING,
  ENTRY_TITLE_FIELD,
} from '@/helpers/settings/common'
import type { EntryEdge } from '@/helpers/settings/common'
import { COMMON_NAMESPACE } from '@/helpers/settings/keys'
import { useSettings } from '@/hooks/settings'

/** 超过这个位移就判定为拖拽，不再触发点击。手抖几个像素不该吞掉一次点击。 */
const DRAG_THRESHOLD_PX = 4

/** 纵向留白，避免被拖到贴顶或贴底后难以再抓住 */
const MIN_OFFSET = 0.06
const MAX_OFFSET = 0.94

function clamp(value: number) {
  return Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, value))
}

/**
 * 页面边缘的配置入口。
 *
 * 一个圆角矩形容器，里面居中一条细长的指示条。只有容器可见，指示条本身很细，
 * 所以不占版面也不抢注意力；容器同时充当点击区域，留出的内边距让 3px 的细条也能被
 * 轻松点中 —— 视觉要细，命中目标不能细。
 *
 * 底色与指示条颜色都可配置：这个入口要压在任意宿主页面上，一套写死的配色不可能都合适。
 * 悬停与拖拽的反馈因此不靠改颜色（那会和用户配的颜色打架），只靠指示条变粗和容器微放大。
 *
 * 默认不启用 —— 这是唯一会在页面上留下常驻元素的入口。
 *
 * 可拖拽：纵向任意，横向越过屏幕中线就换边，位置持久化。
 */
export interface SettingsFloatingEntryProps {
  /**
   * 点击时打开配置。
   *
   * 由挂载方注入而不是直接 import `openSettings`：那会形成
   * `floating-entry → open → host → …` 的依赖链，而 `open` 与 `host` 本身互相引用，
   * 循环导入下模块求值顺序不稳定。组件也本就不该反向依赖挂载自己的模块。
   */
  onOpen: () => void
}

export default function SettingsFloatingEntry({ onOpen }: SettingsFloatingEntryProps) {
  // 颜色走 schema，改完立刻生效（也会跨标签页同步）；位置不在 schema 里，
  // 是拖拽的结果，只在挂载时读一次
  const { values } = useSettings(COMMON_NAMESPACE, commonSettingsSchema)
  const background = values[ENTRY_BACKGROUND_FIELD] as string
  const barColor = values[ENTRY_BAR_COLOR_FIELD] as string
  const barLength = values[ENTRY_BAR_LENGTH_FIELD] as number
  // 清空输入框即恢复默认，而不是留一个没有提示的入口
  const title = (values[ENTRY_TITLE_FIELD] as string)?.trim() || DEFAULT_ENTRY_TITLE

  const [edge, setEdge] = useState<EntryEdge>(
    () => commonSettingsStore.get(ENTRY_EDGE_FIELD, DEFAULT_ENTRY_EDGE),
  )
  const [offset, setOffset] = useState<number>(
    () => commonSettingsStore.get(ENTRY_OFFSET_FIELD, DEFAULT_ENTRY_OFFSET),
  )
  const [dragging, setDragging] = useState(false)

  // 用 ref 而不是 state：这两个值只在事件处理里读写，进 state 会白白多出重渲染，
  // 而且 `moved` 要在同一次事件序列里被 click 读到，state 的异步更新来不及
  const startRef = useRef({ x: 0, y: 0 })
  const movedRef = useRef(false)

  return (
    <button
      type='button'
      aria-label={title}
      title={title}
      className={`
        fixed z-2147483646 flex w-4 -translate-y-1/2 items-center justify-center
        rounded-full
        ${edge === 'right' ? 'right-1' : 'left-1'}
        ${dragging ? 'scale-110 cursor-grabbing' : 'cursor-grab'}
        group touch-none border-0 p-0 backdrop-blur-sm transition-transform
        duration-200
        hover:scale-105
      `}
      // 容器高度由指示条长度推出，四周内边距恒定；宽度不跟着变，
      // 否则贴边的观感会随长度漂移
      style={{
        top: `${offset * 100}%`,
        height: barLength + ENTRY_PADDING * 2,
        background,
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        startRef.current = { x: event.clientX, y: event.clientY }
        movedRef.current = false
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (!dragging) {
          return
        }
        const dx = event.clientX - startRef.current.x
        const dy = event.clientY - startRef.current.y
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          movedRef.current = true
        }
        if (!movedRef.current) {
          return
        }
        setOffset(clamp(event.clientY / window.innerHeight))
        setEdge(event.clientX > window.innerWidth / 2 ? 'right' : 'left')
      }}
      onPointerUp={() => {
        setDragging(false)
        if (!movedRef.current) {
          return
        }
        // 只在拖拽结束时落盘：拖动过程中每帧写一次 GM 存储既没必要，
        // 还会把变更事件刷爆（其他标签页也在监听）
        commonSettingsStore.set(ENTRY_EDGE_FIELD, edge)
        commonSettingsStore.set(ENTRY_OFFSET_FIELD, offset)
      }}
      onPointerCancel={() => {
        setDragging(false)
      }}
      onClick={() => {
        // 拖拽结束后浏览器仍会补一个 click，这里挡掉
        if (movedRef.current) {
          return
        }
        onOpen()
      }}
    >
      {/*
        容器既是视觉也是命中区，指示条居中，四周留出 `ENTRY_PADDING` 的内边距。
        两者都用 `rounded-full`：半径会被夹到宽度的一半，因此上下端都是完整半圆，
        内外两层是同心的胶囊。给容器写固定圆角值会随宽度变化而不再是半圆。

        长度可配，所以只有宽度参与悬停/拖拽反馈 —— 在 hover 时改动用户设定的长度会很怪。
      */}
      <span
        className={`
          block rounded-full transition-all duration-200
          ${dragging
      ? 'w-[6px]'
      : `
        w-[4px]
        group-hover:w-[6px]
      `}
        `}
        style={{ background: barColor, height: barLength }}
      />
    </button>
  )
}
