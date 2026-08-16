import { ColorPicker, Input, InputNumber, Segmented, Select, Switch } from 'antd'

import type { SettingsField } from '@/helpers/settings/types'

import PanelItem from './panel-item'

/** 选项不多于这个数就用 Segmented：一眼看全比展开一个下拉快。 */
const SEGMENTED_MAX_OPTIONS = 3

interface FieldControlProps {
  field: SettingsField
  value: unknown
  onChange: (value: unknown) => void
}

function FieldControl({ field, value, onChange }: FieldControlProps) {
  switch (field.type) {
    case 'boolean':
      return <Switch checked={value as boolean} onChange={onChange} />

    case 'string':
      return (
        <Input
          value={value as string}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )

    case 'text':
      return (
        <Input.TextArea
          value={value as string}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          onChange={(event) => onChange(event.target.value)}
        />
      )

    case 'number':
      return (
        <InputNumber
          value={value as number}
          min={field.min}
          max={field.max}
          suffix={field.suffix}
          onChange={(next) => onChange(next ?? field.default)}
        />
      )

    case 'color':
      return (
        <ColorPicker
          value={value as string}
          disabledAlpha={!field.alpha}
          showText
          // 第二个参数就是 CSS 字符串，不用自己从 Color 对象里拼
          onChange={(_color, css) => onChange(css)}
        />
      )

    case 'enum':
      return field.options.length <= SEGMENTED_MAX_OPTIONS
        ? (
            <Segmented
              value={value as string}
              options={field.options}
              onChange={onChange}
            />
          )
        : (
            <Select
              className='w-full'
              value={value as string}
              options={field.options}
              onChange={onChange}
            />
          )
  }
}

export type SettingsFieldRowProps = FieldControlProps

/**
 * 窄控件放标题行右侧，需要整行宽度的放标题行之下。
 *
 * 判断依据是控件本身要多宽，而不是有没有描述 —— 描述在新布局里本来就独占一行。
 * `enum` 视选项数而定：Segmented 是窄的，展开成 Select 就得占整行。
 */
function isCompactControl(field: SettingsField): boolean {
  switch (field.type) {
    case 'boolean':
    case 'color':
    case 'number':
      return true
    case 'enum':
      return field.options.length <= SEGMENTED_MAX_OPTIONS
    default:
      return false
  }
}

export default function SettingsFieldRow(props: SettingsFieldRowProps) {
  const { field } = props
  const control = <FieldControl {...props} />
  const compact = isCompactControl(field)

  return (
    <PanelItem
      title={field.label}
      description={field.description}
      action={compact ? control : undefined}
    >
      {compact ? null : control}
    </PanelItem>
  )
}
