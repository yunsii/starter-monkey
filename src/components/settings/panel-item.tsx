export interface PanelItemProps {
  title: React.ReactNode
  /** 副标题。脱离上下文后，光看标题经常猜不出这一项是干什么的 */
  description?: React.ReactNode
  /** 标题行右侧的操作区：开关、状态图标这类窄控件 */
  action?: React.ReactNode
  /** 标题行之下的整行内容：输入框、注入范围列表这类需要整行宽度的东西 */
  children?: React.ReactNode
  /**
   * 整行可点。用于「点一下就执行」的条目 —— 那种条目不该在右侧摆一个写着「执行」的按钮，
   * 动词是什么全靠标题说清楚，按钮只会重复一遍。
   *
   * 给了它才有 hover 反馈与键盘可达（Enter / Space），没给就是纯展示的卡片。
   *
   * **`action` / `children` 里有交互控件（开关、输入框、可点图标）时不要给 `onClick`**：
   * 点子控件会一路冒泡到整行，一次操作触发两件事；而且 `role='button'` 里嵌可交互元素
   * 本身就是无效的 ARIA，读屏会把整行念成一个按钮，里面的开关无从表达。
   * 功能清单那样的行（开关 + 齿轮）属于这一类，让子控件各自可点，不要整行可点。
   */
  onClick?: () => void
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
export default function PanelItem({ title, description, action, children, onClick }: PanelItemProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`
        flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2.5
        ${onClick
      ? `
        cursor-pointer transition-colors outline-none
        hover:bg-gray-100
        focus-visible:ring-2 focus-visible:ring-blue-400
      `
      : ''}
      `}
      onClick={onClick}
      onKeyDown={onClick
        ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onClick()
            }
          }
        : undefined}
    >
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
