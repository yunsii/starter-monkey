import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import autoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import monkey, { cdn, util } from 'vite-plugin-monkey'

import type { Plugin } from 'vite'

import { localesMeta } from './config/locales/meta.ts'
import { pxUtilities } from './scripts/px-utilities.ts'
import { getScriptInfos, printScriptInfos } from './scripts/script-infos.ts'

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const scriptInfos = await getScriptInfos()
  const allMatches = scriptInfos.flatMap((script) => {
    if ('matches' in script) {
      return script.matches
    }
    return []
  })
  const allIncludes = scriptInfos.flatMap((script) => {
    if ('includes' in script) {
      return script.includes
    }
    return []
  })

  printScriptInfos(scriptInfos)

  return {
    // Vite 8 起原生支持 tsconfig 的 paths 解析，不再需要 vite-tsconfig-paths 插件
    resolve: { tsconfigPaths: true },
    plugins: [
      autoImport({
        imports: [
          'react',
          util.unimportPreset,
          {
            'tagged-classnames-free': ['cls', 'tw'],
          },
          {
            '@/helpers/ui/integrated': ['createIntegratedUi'],
            '@/helpers/ui/shadow-root': ['createShadowRootUi'],
            '@/helpers/react/shadow-root-helpers': ['reactRenderInShadowRoot'],
            '@/helpers/settings/open': ['openSettings'],
          },
          {
            from: '@/helpers/ui/shadow-root.ts',
            imports: ['ShadowRootUi'],
            type: true,
          },
        ],
      }),
      react(),
      tailwindcss(),
      // 必须紧跟 `tailwindcss()`：两者都是 `enforce: 'post'`，同相位内按数组顺序执行，
      // 排到它前面就只能拿到 `@import 'tailwindcss'` 那一行，一个 rem 都换不到且不报错
      pxUtilities(),
      monkey({
        entry: 'src/main.ts',
        userscript: {
          name: localesMeta.name,
          description: localesMeta.description,
          icon: 'https://vitejs.dev/logo.svg',
          namespace: 'yuns',
          match: allMatches,
          include: allIncludes,
          grant: ['unsafeWindow'],
          noframes: true,
          require: [
            // antd 的 UMD 产物把 dayjs 外部化了，缺了它 antd 一加载就抛
            // `Cannot read properties of undefined (reading 'extend')`，整个脚本随之失效。
            // 走 `require` 而不是 `externalGlobals`：源码里并不 import dayjs，
            // 没有可供外部化的模块，只能直接声明依赖。
            'https://cdn.jsdelivr.net/npm/dayjs@1.11.19/dayjs.min.js',
          ],
          license: 'MIT',
        },
        build: {
          // React 19 移除了官方 UMD 产物，这里用社区的 react-umd 顶上
          // （https://github.com/magicdawn/react-umd）。
          //
          // ⚠️ CDN 版本号取自**安装的 react 版本**：react 发了新版而 react-umd 还没跟上时，
          // `@require` 会 404，整个脚本一行都跑不了。升 react 之后务必确认
          // `https://cdn.jsdelivr.net/npm/react-umd@<版本>/dist/react.umd.min.js` 可达。
          //
          // 下面两个 data: 补丁都是**结构性**的，不是某个版本的 bug，升 react-umd 不会让它们
          // 变得多余。缺口在「antd 的 UMD 按 React 18 的形状取依赖」，而不在 react-umd。
          //
          // antd@6.6.0 的 UMD 头部声明的外部依赖是 `react` / `react-dom` / `dayjs`
          // （对应全局 `React` / `ReactDOM` / `dayjs`），并且**没有内联 react-dom 实现**
          // （`react-stack-bottom-frame`、`Minified React error` 等内部特征串在产物里均为 0）。
          // 也就是说它完全依赖这两个全局对象长成 React 18 的样子。
          //
          // 实测 react-umd 19.2.4 / 19.2.5 / 19.2.8（压缩与未压缩）：
          //   React.default            → undefined  ← 需要补
          //   ReactDOM.createRoot      → undefined  ← 需要补
          //   ReactDOMClient.createRoot → function
          // issue 里作者提到 `v19.2.5-pre.1` 用 cjs src 修掉了 `React.default`，但那个版本
          // 并未发布（npm 上只有 `19.2.5-pre.0`），已发布版本里观察不到该修复。
          externalGlobals: {
            'react': [
              'React',
              (version: string, name: string, importName: string) => {
                return `https://cdn.jsdelivr.net/npm/react-umd@${version}/dist/react.umd.min.js`
              },
              // antd 的产物按 esModuleInterop 的方式取 `React.default`，而 UMD 版的 React
              // 没有这个属性，不补的话 antd 一初始化就抛
              // `Cannot read properties of undefined (reading 'createContext')`。
              // ref: https://github.com/ant-design/ant-design/issues/55889
              'data:application/javascript,window.React&&(window.React.default=window.React);',
            ],
            'react-dom': [
              'ReactDOM',
              (version: string, name: string, importName: string) => {
                return `https://cdn.jsdelivr.net/npm/react-umd@${version}/dist/react-dom.umd.min.js`
              },
            ],
            'react-dom/client': [
              'ReactDOMClient',
              (version: string, name: string, importName: string) => {
                return `https://cdn.jsdelivr.net/npm/react-umd@${version}/dist/react-dom-client.umd.min.js`
              },
              // antd 产物里有且仅有一处这样取根渲染 API（rc-util 的 React root）：
              //
              //   var e = t(6003) /* 外部依赖 react-dom */, q = e.createRoot; e.hydrateRoot
              //   let O = "__rc_react_root__"
              //
              // React 18 时 `react-dom` 上确实有 `createRoot`，React 19 把它挪进了
              // `react-dom/client`，于是 `q` 是 undefined。任何带 Wave（点击涟漪）的 antd
              // 组件——例如 Switch——点一下就抛 `TypeError: q is not a function`
              // （报错里的 `q` 正是上面那个变量）；Segmented 这类不带 Wave 的则不受影响。
              //
              // 把 createRoot / hydrateRoot 补回 `react-dom` 全局，与上面 `React.default`
              // 同一形态。两个都要补：上面那行代码把 hydrateRoot 也读了。
              'data:application/javascript,window.ReactDOM%26%26window.ReactDOMClient%26%26(window.ReactDOM.createRoot%3Dwindow.ReactDOMClient.createRoot%2Cwindow.ReactDOM.hydrateRoot%3Dwindow.ReactDOMClient.hydrateRoot)%3B',
            ],
            // antd 走 CDN 而不是打进产物：它体积很大，而用户脚本的每一 KB 都要在
            // 每个匹配页面上下载解析
            '@ant-design/cssinjs': cdn.jsdelivr('antdCssinjs', 'dist/umd/cssinjs.min.js'),
            'antd': cdn.jsdelivr('antd', 'dist/antd.min.js'),
          },
        },
      }),
      // ref: https://github.com/lisonge/vite-plugin-monkey/issues/156
      {
        name: 'replace-unsafeWindow',
        apply: 'build',
        transform(code, id) {
          if (id.includes('@monaco-editor/loader/lib/es/loader/index.js')) {
            return `import {unsafeWindow as window} from '$';\n${code}`
          }
        },
      } satisfies Plugin,
    ],
  }
})
