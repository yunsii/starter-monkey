import { Editor } from '@monaco-editor/react'

import type { EditorProps } from '@monaco-editor/react'

import { useSyncDocumentHeadElements } from '@/hooks/document'

export default function MonacoEditor(props: EditorProps) {
  useSyncDocumentHeadElements({
    selectors: 'link[data-name="vs/editor/editor.main"], script[src*="/vs/editor/editor.main.js"], style[data-name="vs/editor/editor.main"]',
  })

  return (
    <Editor {...props} />
  )
}
