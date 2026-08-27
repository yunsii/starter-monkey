import { Switch } from 'antd'

import type { FeatureAction } from '@/helpers/settings/actions'
import { collapseSettings } from '@/helpers/settings/open'

import PanelItem from './panel-item'

export interface SettingsActionsProps {
  /** 由 `useFeatureActions` 订阅得到，见那里为什么订阅点只有一处 */
  actions: readonly FeatureAction[]
}

/**
 * 一个功能注册的动作，逐条摊在它的配置分组里。
 *
 * 摊开而不是收进一个带搜索框的命令面板：一个功能的动作通常只有几条、全都能一眼看完，
 * 搜索框反而多一次点击，「最近使用」则是把同一条重复列出。等真长到需要检索时再说。
 */
export default function SettingsActions({ actions }: SettingsActionsProps) {
  if (actions.length === 0) {
    return null
  }

  return (
    <>
      {actions.map((action) => {
        const title = (
          <span className='flex items-center gap-1.5'>
            {action.icon && (
              <span className={`
                ${action.icon}
                size-4 shrink-0 text-gray-400
              `}
              />
            )}
            {action.label}
          </span>
        )

        if (action.type === 'toggle') {
          return (
            <PanelItem
              key={action.id}
              title={title}
              description={action.description}
              action={<Switch checked={action.checked} onChange={action.onChange} />}
            />
          )
        }

        return (
          <PanelItem
            key={action.id}
            title={title}
            description={action.description}
            // 执行后收起面板：动作的结果几乎都在页面上，而面板占着一侧会挡住要看的东西。
            // 收起而不是卸载，回来时还是原来那一屏。
            //
            // finally 而不是顺序执行：handler 抛了异常也该让位，否则面板停在原地、
            // 页面上又什么都没发生，看起来像「这一项点了没反应」
            onClick={() => {
              try {
                action.onTrigger()
              } finally {
                collapseSettings()
              }
            }}
            action={<span className='i-bx--chevron-right size-4 text-gray-300' />}
          />
        )
      })}
    </>
  )
}
