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
      styles={{
        // 把滚动从抽屉 body 移到下面的内容区：分段切换要留在滚动容器外。
        // body 自己不滚（`overflow: hidden`），所以整个抽屉里始终只有一个滚动区域，
        // 不存在「鼠标在哪一层上滚」的歧义。
        // 内边距也一并交给内层：body 有 padding 时滚动条会贴在 padding 内侧，
        // 看起来像浮在内容中间。
        body: { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* 常驻：不跟着内容滚，也就不会因为内容区滚动条的出现/消失而横向抽动 */}
      <div className='shrink-0 px-6 pt-6 pb-4'>
        <Segmented<Tab>
          block
          value={tab}
          options={[
            { label: '设置', value: 'settings' },
            { label: '功能', value: 'features' },
          ]}
          onChange={setTab}
        />
      </div>
      {/*
        `min-h-0` 不能省：flex 子项的默认 `min-height: auto` 会让它被内容撑开而不是
        产生滚动，滚动条就跑回抽屉外层去了。

        `scrollbar-gutter: stable` 常驻滚动条槽位：设置页内容够高会出现滚动条、功能页
        不会，切换时可用宽度差 15px，里面的控件会整体横向跳一下。
      */}
      <div className='
        min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto px-6 pb-6
      '
      >
        {tab === 'settings'
          ? <SettingsPanel scripts={scripts} target={target} request={request} />
          : <FeatureList scripts={scripts} />}
      </div>
    </Drawer>
  )
}
