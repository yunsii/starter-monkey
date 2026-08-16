import { reactRenderInShadowRoot } from '@/helpers/react/shadow-root-helpers'
import type { SettingsSchema } from '@/helpers/settings/types'
import { createShadowRootUi } from '@/helpers/ui/shadow-root'

/**
 * 配置声明。
 *
 * 具名导出而不是挂在 `Script` 上：配置面板要列出**所有**功能，包括当前页面不匹配、
 * 因而不会执行的那些。模块本身在每个注入页面都会被加载，所以具名导出天然可读。
 */
export const settings: SettingsSchema = {
  title: 'V2EX 增强',
  description: '在主题列表里插入编辑器入口',
  fields: {
    entryLabel: {
      type: 'string',
      label: '入口文案',
      default: 'Editor',
      placeholder: 'Editor',
    },
    editorTheme: {
      type: 'enum',
      label: '编辑器主题',
      options: [
        { label: '浅色', value: 'light' },
        { label: '深色', value: 'vs-dark' },
      ],
      default: 'light',
    },
    initialValue: {
      type: 'text',
      label: '编辑器初始内容',
      description: '打开编辑器时预填的文本，留空则不预填',
      default: 'Hello, world!',
    },
  },
}

const Script: Userscript = async () => {
  // 不需要在这里判断「有没有被关掉」——启用开关是框架能力，`main.ts` 已经过滤过了
  const ui = await createShadowRootUi(
    {
      name: Script.id,
      position: 'inline',
      onMount: (container, shadowRoot, shadowHost) => {
        return reactRenderInShadowRoot(
          { uiContainer: container, shadow: shadowRoot, shadowHost },
          () => import('./app'),
        )
      },
    },
  )

  ui.mount()
}

Script.id = 'v2ex-demo'
Script.displayName = 'v2ex-demo'
Script.matches = ['https://www.v2ex.com/']

export default Script
