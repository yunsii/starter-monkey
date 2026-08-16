import { Empty } from 'antd'
import { useEffect, useMemo, useRef } from 'react'

import type { MatchedUserscript } from '@/helpers/scripts'
import { COMMON_SETTINGS_ID, commonSettingsSchema } from '@/helpers/settings/common'
import { isFeatureEnabled } from '@/helpers/settings/feature-toggle'

import SettingsSection from './section'

export interface SettingsPanelProps {
  scripts: MatchedUserscript[]
  /** 定位目标：`<Script.id>` 或 `<Script.id>.<field>` */
  target?: string
  /** 定位请求号，同一个 target 再次请求时也要重新滚动 */
  request: number
}

/**
 * 配置面板：公共配置 + **当前页面生效的功能**的配置。
 *
 * 刻意不列出在当前页面不生效、或被关掉的功能：改一个此刻根本没跑的功能的参数，
 * 既看不到效果，也让人分不清哪些设置和眼前的页面有关。想知道这份脚本一共有哪些功能、
 * 想开关它们，看「功能」页 —— 那里是完整清单，本页只回答「我现在能调什么」。
 */
export default function SettingsPanel({ scripts, target, request }: SettingsPanelProps) {
  const available = useMemo(
    () => scripts.filter(
      (item) => item.settings && item.matched && isFeatureEnabled(item.script.id),
    ),
    [scripts],
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const targetId = target?.split('.')[0]

  useEffect(() => {
    if (!targetId || !containerRef.current) {
      return
    }
    const node = containerRef.current.querySelector<HTMLElement>(
      `[data-settings-section="${CSS.escape(targetId)}"]`,
    )
    if (!node) {
      return
    }
    node.scrollIntoView({ block: 'start', behavior: 'smooth' })
    // 只滚动不移动焦点，对键盘和读屏用户等于没有定位
    node.setAttribute('tabindex', '-1')
    node.focus({ preventScroll: true })
  }, [targetId, request])

  return (
    <div ref={containerRef} className='flex flex-col gap-6 p-1'>
      {/* 框架级配置排在最前：它对所有功能生效，且悬浮入口开关是最常用的一项 */}
      <div data-settings-section={COMMON_SETTINGS_ID} className='outline-none'>
        <SettingsSection
          namespace={COMMON_SETTINGS_ID}
          title={commonSettingsSchema.title!}
          schema={commonSettingsSchema}
        />
      </div>

      {/* 公共配置永远在，所以「空」指的是当前页面没有可调的功能 */}
      {available.length === 0 && (
        <Empty
          className='py-4'
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description='当前页面没有已启用且可配置的功能'
        />
      )}

      {available.map((item) => (
        <div
          key={item.script.id}
          data-settings-section={item.script.id}
          className='outline-none'
        >
          <SettingsSection
            namespace={item.script.id}
            title={item.settings?.title ?? item.script.displayName}
            schema={item.settings!}
          />
        </div>
      ))}
    </div>
  )
}
