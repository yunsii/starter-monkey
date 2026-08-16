import MonacoEditor from '@/components/monaco-editor'
import { useSettings } from '@/hooks/settings'
import useCreateUis, { useShadowModal } from '@/hooks/ui'

import Script, { settings } from './index'

export default function App() {
  // 配置变化即时生效，不需要刷新页面；另一个标签页改的也会同步过来
  const { values } = useSettings(Script.id, settings)

  const { toggleModal: toggleEditorModal } = useShadowModal({
    name: 'v2ex-demo-editor',
    content: (
      <div className='bg-white'>
        <div className='flex items-center justify-between p-2'>
          <span className='text-lg'>Monaco Editor</span>
          {/* 功能自身 UI 里的配置入口：定位到这个功能的配置，零额外页面footprint */}
          <button
            type='button'
            className={`
              cursor-pointer text-sm text-gray-400
              hover:text-gray-700
            `}
            onClick={() => {
              void openSettings(Script.id)
            }}
          >
            设置
          </button>
        </div>
        <MonacoEditor
          height='50vh'
          theme={values.editorTheme as string}
          defaultValue={values.initialValue as string}
        />
      </div>
    ),
  })

  useCreateUis('a.topic-link', async (element) => {
    return createShadowRootUi({
      name: 'v2ex-demo-item',
      position: 'inline',
      append: 'after',
      anchor: element as HTMLAnchorElement,
      onMount: (container, shadowRoot, shadowHost) => {
        shadowHost.style.display = 'inline-block'
        return reactRenderInShadowRoot(
          { uiContainer: container, shadow: shadowRoot, shadowHost },
          <button
            type='button'
            className='inline-flex items-center gap-1 font-bold text-red-400'
            onClick={() => {
              toggleEditorModal()
            }}
          >
            {values.entryLabel as string}
            <span className='i-bx--bx-edit' />
          </button>,
        )
      },
    })
  })

  // 不直接渲染任何 DOM
  return null
}
