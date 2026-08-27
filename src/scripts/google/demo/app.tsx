import { useEffect, useState } from 'react'

import { registerFeatureActions } from '@/helpers/settings/actions'

import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import Script from './index'

import './app.css'

export default function App() {
  const [count, setCount] = useState(0)

  // 一次性操作用 trigger：计数没有「开/关」两态，用开关表达它反而要多想一步。
  // 结果在页面上，所以点完面板会自己收起（见 `components/settings/actions.tsx`）。
  //
  // 这里刻意和 v2ex demo 的 toggle 形成对照：两种动作类型各有一个真实调用方，
  // 免得哪一支只有类型定义、没人走过。
  useEffect(
    () => registerFeatureActions(Script.id, [
      {
        type: 'trigger',
        id: 'reset-count',
        label: '计数归零',
        description: `把页面上的计数器重置为 0，当前是 ${count}`,
        icon: 'i-bx--reset',
        onTrigger: () => setCount(0),
      },
    ]),
    [count],
  )

  const baseLogoCls = cls`h-10 p-1 will-change-[filter]`

  return (
    <div>
      <div className='flex'>
        <a href='https://vitejs.dev' target='_blank' rel='noreferrer'>
          <img
            src={viteLogo}
            className={cls`
              ${baseLogoCls}
              hover:drop-shadow-xl hover:drop-shadow-indigo-400
            `}
            alt='Vite logo'
          />
        </a>
        <a href='https://reactjs.org' target='_blank' rel='noreferrer'>
          <img
            src={reactLogo}
            className={cls`
              ${baseLogoCls}
              hover:drop-shadow-xl hover:drop-shadow-blue-300
            `}
            alt='React logo'
          />
        </a>
      </div>
      <h1 className='italic'>Vite + React</h1>
      <div className='p-1'>
        <button className='cursor-pointer border px-1' type='button' onClick={() => setCount((count) => count + 1)}>
          count is
          {' '}
          {count}
        </button>
        <p>
          Edit
          {' '}
          <code>src/App.tsx</code>
          {' '}
          and save to test HMR
        </p>
      </div>
      <p className='text-gray-800'>
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}
