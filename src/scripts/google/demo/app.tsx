import { useState } from 'react'

import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'

import './app.css'

export default function App() {
  const [count, setCount] = useState(0)

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
