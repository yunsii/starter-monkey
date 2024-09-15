import { unindent } from '@antfu/utils'
import { useEffect, useRef, useState } from 'react'

import { getUserscripts } from './helpers/scripts'

function App() {
  const [loading, setLoading] = useState(false)
  const loadedModulesRef = useRef<{ key: string, ReactUserscript: ReactUserscript, matched: boolean }[]>([])

  useEffect(() => {
    getUserscripts().then((userscripts) => {
      // https://en.wikipedia.org/wiki/Box-drawing_characters
      const printInfo = unindent(`
        ┌──── 🦄 starter-monkey (${userscripts.filter((item) => item.matched).length}/${userscripts.length}) ────┄
        ${userscripts.map((item) => {
            return `│ ${item.matched ? '🟢' : '🔴'} ${item.ReactUserscript.displayName}`
          })}
        └──────────────────────────────────┄
      `)
      // eslint-disable-next-line no-console
      console.debug(printInfo)
      loadedModulesRef.current = userscripts
      setLoading(true)
    })
  }, [])

  if (!loading) {
    return null
  }

  return loadedModulesRef.current.filter((item) => {
    return item.matched
  }).map((item) => {
    const { ReactUserscript } = item
    return <ReactUserscript key={item.key} />
  })
}

export default App
