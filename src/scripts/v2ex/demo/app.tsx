import MonacoEditor from '@/components/monaco-editor'
import useCreateUis, { useShadowModal } from '@/hooks/ui'

export default function App() {
  const { toggleModal: toggleEditorModal } = useShadowModal({
    name: 'v2ex-demo-editor',
    content: (
      <div className='bg-white'>
        <div className='p-2 text-lg'>Monaco Editor</div>
        <MonacoEditor height='50vh' defaultValue='Hello, world!' />
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
            className='font-bold text-red-400'
            onClick={() => {
              toggleEditorModal()
            }}
          >
            Editor
          </button>,
        )
      },
    })
  })

  // 不直接渲染任何 DOM
  return null
}
