export interface PanelItemProps {
  title: React.ReactNode
  /** 副标题。脱离上下文后，光看标题经常猜不出这一项是干什么的 */
  description?: React.ReactNode
  /** 标题行右侧的操作区：开关、状态图标这类窄控件 */
  action?: React.ReactNode
  /** 标题行之下的整行内容：输入框、注入范围列表这类需要整行宽度的东西 */
  children?: React.ReactNode
}

/**
 * 面板里一行「条目」的统一布局。
 *
 * ```
 * [ 标题 ..................... 操作 ]
 * [ 描述                            ]
 * [ 整行内容                        ]
 * ```
 *
 * 配置项和功能清单原本各写了一套几乎一样的卡片，只是操作区一个是控件、一个是开关加图标。
 * 抽成一个组件之后，往后新增任何「标题 + 开关」的条目都直接复用，不用再对一遍圆角、
 * 内边距和字号 —— 这类样式一旦各写各的，过几轮就会肉眼可见地对不齐。
 *
 * 窄控件（开关、颜色、数字）放 `action`，需要整行的（输入框、下拉、多行文本）放 `children`。
 */
export default function PanelItem({ title, description, action, children }: PanelItemProps) {
  return (
    <div className='flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2.5'>
      <div className='flex items-center gap-2'>
        <span className='min-w-0 text-sm font-medium text-gray-700'>{title}</span>
        {action && (
          <div className='ml-auto flex shrink-0 items-center gap-2'>{action}</div>
        )}
      </div>

      {description && (
        <span className='text-xs/relaxed text-gray-400'>{description}</span>
      )}

      {children}
    </div>
  )
}
