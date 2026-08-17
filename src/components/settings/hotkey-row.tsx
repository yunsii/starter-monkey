import { Button, Tag } from 'antd'
import { useState } from 'react'

import { commonSettingsStore, OPEN_HOTKEY_FIELD } from '@/helpers/settings/common'
import { comboFromEvent, formatHotkey, isUsableHotkey } from '@/helpers/settings/hotkey'
import type { HotkeyCombo } from '@/helpers/settings/hotkey'
import { bumpSettingsRevision } from '@/helpers/settings/revision'

import PanelItem from './panel-item'

/**
 * 打开配置的快捷键，录制式设置。
 *
 * 这是 `SettingsSchema.render` 逃生舱的用例：快捷键没法用声明式字段表达 ——
 * 它的输入不是「填一个值」，而是「按一次键」，还要即时校验组合是否可用。
 */
export default function HotkeyRow() {
  const [combo, setCombo] = useState<HotkeyCombo | null>(
    () => commonSettingsStore.get<HotkeyCombo | null>(OPEN_HOTKEY_FIELD, null),
  )
  const [recording, setRecording] = useState(false)
  const [rejected, setRejected] = useState<string | null>(null)

  const write = (next: HotkeyCombo | null) => {
    commonSettingsStore.set(OPEN_HOTKEY_FIELD, next)
    setCombo(next)
    bumpSettingsRevision()
  }

  return (
    <PanelItem
      title='打开配置的快捷键'
      description='默认不绑定。模板预设的快捷键迟早会和某个站点撞上，所以留给你自己定；未绑定时不会注册任何键盘监听。'
      action={(
        <>
          {combo && !recording && (
            <Tag className='m-0 font-mono'>{formatHotkey(combo)}</Tag>
          )}
          <Button
            size='small'
            type={recording ? 'primary' : 'default'}
            onClick={() => {
              setRejected(null)
              setRecording(true)
            }}
            // 录制期间由这个按钮接管键盘：聚焦在它身上，按键才落得到 onKeyDown
            autoFocus={recording}
            onKeyDown={(event) => {
              if (!recording) {
                return
              }
              event.preventDefault()
              event.stopPropagation()

              if (event.key === 'Escape') {
                setRecording(false)
                return
              }

              const next = comboFromEvent(event.nativeEvent)
              // 只按下修饰键时继续等：用户总要先按住 Ctrl 再按字母
              if (!next) {
                return
              }
              if (!isUsableHotkey(next)) {
                setRejected('至少要带一个 Ctrl / Meta / Alt，否则在输入时会误触')
                return
              }
              setRecording(false)
              write(next)
            }}
          >
            {recording ? '按下组合键…' : combo ? '重设' : '设置快捷键'}
          </Button>
          {combo && !recording && (
            <Button size='small' type='text' onClick={() => write(null)}>
              清除
            </Button>
          )}
        </>
      )}
    >
      {rejected && <span className='text-xs text-amber-600'>{rejected}</span>}
    </PanelItem>
  )
}
