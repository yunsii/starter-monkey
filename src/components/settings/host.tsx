import { Drawer, Segmented } from 'antd'
import { useState, useSyncExternalStore } from 'react'

import type { MatchedUserscript } from '@/helpers/scripts'
import {
  collapseSettings,
  destroySettings,
  getSettingsUiState,
  subscribeSettingsUi,
} from '@/helpers/settings/open'
import { useScrollLock } from '@/hooks/scroll-lock'

import FeatureList from './feature-list'
import SettingsPanel from './index'

type Tab = 'settings' | 'features'

export interface SettingsHostProps {
  scripts: MatchedUserscript[]
}

/**
 * 配置面板的外壳。
 *
 * 抽屉而不是全屏遮罩：配置常常要边看页面边改（改完看看效果），全屏遮罩会把页面盖住。
 */
export default function SettingsHost({ scripts }: SettingsHostProps) {
  const { open, target, request } = useSyncExternalStore(subscribeSettingsUi, getSettingsUiState)
  const [tab, setTab] = useState<Tab>('settings')

  // 抽屉开着时锁住宿主页面滚动
  useScrollLock(open)

  // 带定位目标进来（从某个功能的 ⚙ 或菜单项）时切回设置页，否则定位会落空。
  // 比对请求号而不是 target：面板开着时对同一个功能再点一次，target 没变但确实是一次新请求。
  // 用「渲染期比对上一次的值」而不是 effect：effect 会先提交一帧停留在功能页，
  // 再重渲染切过去，肉眼能看到闪动。
  const [lastRequest, setLastRequest] = useState(request)
  if (request !== lastRequest) {
    setLastRequest(request)
    if (target) {
      setTab('settings')
    }
  }

  return (
    <Drawer
      open={open}
      title='脚本配置'
      placement='right'
      // antd v6 起 `width` 已弃用，改用 `size`（同样接受数字）
      size={420}
      // 宿主是 detached 的 0×0 元素，抽屉必须自己相对视口定位
      rootStyle={{ position: 'fixed', inset: 0 }}
      onClose={collapseSettings}
      // 等关闭动画放完再卸载，直接卸载会让抽屉瞬间消失
      afterOpenChange={(nextOpen) => {
        if (!nextOpen) {
          destroySettings()
        }
      }}
    >
      {/*
        不在这里再套一层滚动容器：抽屉自己的 body 已经能滚，再嵌一层会变成两个滚动区域，
        鼠标在哪一层上滚都不确定。整个面板（含上面的分段切换）一起滚更符合预期。
      */}
      <div className='flex flex-col gap-4'>
        <Segmented<Tab>
          block
          value={tab}
          options={[
            { label: '设置', value: 'settings' },
            { label: '功能', value: 'features' },
          ]}
          onChange={setTab}
        />
        {tab === 'settings'
          ? <SettingsPanel scripts={scripts} target={target} request={request} />
          : <FeatureList scripts={scripts} />}
      </div>
    </Drawer>
  )
}
