import { Switch } from 'antd'
import { useCallback, useSyncExternalStore } from 'react'

import {
  getFeatureActions,
  subscribeFeatureActions,
} from '@/helpers/settings/actions'
import { collapseSettings } from '@/helpers/settings/open'

import PanelItem from './panel-item'

export interface SettingsActionsProps {
  /** `Script.id`，也是动作注册表的键 */
  namespace: string
}

/**
 * 一个功能注册的动作，逐条摊在它的配置分组里。
 *
 * 摊开而不是收进一个带搜索框的命令面板：一个功能的动作通常只有几条、全都能一眼看完，
 * 搜索框反而多一次点击，「最近使用」则是把同一条重复列出。等真长到需要检索时再说。
 */
export default function SettingsActions({ namespace }: SettingsActionsProps) {
  const actions = useSyncExternalStore(
    subscribeFeatureActions,
    useCallback(() => getFeatureActions(namespace), [namespace]),
  )

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
            // 收起而不是卸载，回来时还是原来那一屏
            onClick={() => {
              action.onTrigger()
              collapseSettings()
            }}
            action={<span className='i-bx--chevron-right size-4 text-gray-300' />}
          />
        )
      })}
    </>
  )
}
