import { Empty, Switch, Tooltip } from 'antd'
import { useCallback, useMemo, useSyncExternalStore } from 'react'

import type { MatchedUserscript } from '@/helpers/scripts'
import { detectHasPanelContent } from '@/helpers/settings/actions'
import {
  FEATURE_ENABLED_FIELD,
  isFeatureEnabled,
  setFeatureEnabled,
} from '@/helpers/settings/feature-toggle'
import { openSettings } from '@/helpers/settings/open'
import {
  bumpSettingsRevision,
  getSettingsRevision,
  subscribeSettingsRevision,
} from '@/helpers/settings/revision'
import { createSettingsStore } from '@/helpers/settings/storage'

import PanelItem from './panel-item'

/** 一个功能声明的注入范围，`matches` 与 `includes` 二选一。 */
function injectionPatterns(script: MatchedUserscript['script']): string[] {
  return 'matches' in script
    ? script.matches
    : script.includes.map((item) => String(item))
}

export interface FeatureListProps {
  scripts: MatchedUserscript[]
}

/**
 * 功能清单，同时也是启用开关所在的地方。
 *
 * 清单完全由代码生成，没有需要手工维护的一份名单：`import.meta.glob` 在每个注入页面都会
 * 加载全部功能模块，所以这里读得到每个功能的 `Script.id` / `displayName` / 注入范围，
 * 以及它在当前页面是否命中 —— 包括那些不匹配、因而根本没执行的功能。
 *
 * 开关放在这里而不是各功能的设置分组里：「有哪些功能、哪些开着」是同一个问题，
 * 拆到两个页面上看反而要来回切。而且不匹配当前页面的功能也能在这里关掉。
 */
export default function FeatureList({ scripts }: FeatureListProps) {
  const revision = useSyncExternalStore(
    useCallback((onStoreChange) => {
      const unsubscribes = [
        subscribeSettingsRevision(onStoreChange),
        ...scripts.map((item) =>
          createSettingsStore(item.script.id).subscribe(FEATURE_ENABLED_FIELD, onStoreChange)),
      ]
      return () => {
        for (const unsubscribe of unsubscribes) {
          unsubscribe()
        }
      }
    }, [scripts]),
    getSettingsRevision,
  )

  // 当前页面生效的排前面：用户十有八九是为眼前这个页面来的
  const ordered = useMemo(
    () => [...scripts].sort((a, b) => Number(b.matched) - Number(a.matched)),
    [scripts],
  )

  const enabledMap = useMemo(() => {
    void revision
    return new Map(scripts.map((item) => [item.script.id, isFeatureEnabled(item.script.id)]))
  }, [scripts, revision])

  if (ordered.length === 0) {
    return (
      <Empty
        className='py-4'
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description='还没有任何功能'
      />
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {/*
        功能已经执行完了才关掉它，页面上留下的东西不会自己消失 —— 让用户知道要刷新，
        比让他们盯着一个「关了却还在」的功能自我怀疑要好。

        而既然话说到「要刷新」，就顺手让它能刷：整行可点，右侧不再摆一个写着「刷新」的
        按钮 —— 动词已经在标题里了。图标是纯装饰（没有自己的 onClick），所以不违反
        `PanelItem.onClick` 那条「别和交互控件同时用」。
      */}
      <PanelItem
        title='刷新页面，让开关改动生效'
        description='已经执行过的功能，页面上渲染出来的东西不会随开关关闭而消失'
        action={<span className='i-bx--refresh size-4 text-gray-400' />}
        onClick={() => {
          window.location.reload()
        }}
      />

      {ordered.map((item) => {
        const enabled = enabledMap.get(item.script.id) ?? true
        // 设置页只列「当前页面生效且已启用」的功能，可点性必须和它保持一致，
        // 所以「有没有东西可显示」这一问走同一个判断
        const configurableNow = detectHasPanelContent(item.script.id, Boolean(item.settings))
          && item.matched
          && enabled
        return (
          <PanelItem
            key={item.script.id}
            title={item.settings?.title ?? item.script.displayName}
            description={item.settings?.description}
            action={(
              <>
                {/*
                  状态用图标而不是文字标签：一行里塞两三个标签会把标题挤没，
                  而这两条信息都是「扫一眼确认」性质的，需要细节时 hover 即可。
                */}
                <Tooltip title={item.matched ? '当前页面生效' : '当前页面未生效'}>
                  <span
                    className={`
                      size-4
                      ${item.matched
                ? 'i-bx--check-circle text-green-600'
                : 'i-bx--circle text-gray-300'}
                    `}
                  />
                </Tooltip>
                {/*
                  没有配置项也占同一个位置，只是置灰：缺一个图标会让后面的开关跟着左移，
                  一列开关对不齐，扫一眼反而更费劲。

                  只有真能调的时候才可点：设置页只列出「当前页面生效且已启用」的功能，
                  对着一个跳过去也看不到的目标做定位，比不给点更让人困惑。
                */}
                <Tooltip title={configurableNow
                  ? '前往设置'
                  : item.settings
                    ? '有可配置项，需在其生效的页面上并保持启用'
                    : '没有可配置项'}
                >
                  <span
                    role={configurableNow ? 'button' : undefined}
                    tabIndex={configurableNow ? 0 : undefined}
                    className={`
                      i-bx--cog size-4
                      ${item.settings ? 'text-blue-500' : 'text-gray-300'}
                      ${configurableNow
                ? `
                  cursor-pointer
                  hover:text-blue-700
                `
                : ''}
                    `}
                    onClick={configurableNow
                      ? () => {
                          void openSettings(item.script.id)
                        }
                      : undefined}
                    onKeyDown={configurableNow
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            void openSettings(item.script.id)
                          }
                        }
                      : undefined}
                  />
                </Tooltip>
                <Switch
                  size='small'
                  checked={enabled}
                  onChange={(next) => {
                    setFeatureEnabled(item.script.id, next)
                    bumpSettingsRevision()
                  }}
                />
              </>
            )}
          >
            <div className='flex flex-col gap-0.5'>
              {injectionPatterns(item.script).map((pattern) => (
                <code key={pattern} className='text-xs break-all text-gray-400'>
                  {pattern}
                </code>
              ))}
            </div>
          </PanelItem>
        )
      })}
    </div>
  )
}
