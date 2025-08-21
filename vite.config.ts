import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import autoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import monkey, { cdn } from 'vite-plugin-monkey'
import tsconfigPaths from 'vite-tsconfig-paths'

import { getScriptInfos, printScriptInfos } from './scripts/script-infos'

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const scriptInfos = await getScriptInfos()
  const allMatches = scriptInfos.flatMap((script) => script.matches)

  printScriptInfos(scriptInfos)

  return {
    plugins: [
      tsconfigPaths(),
      autoImport({
        imports: [
          'react',
          {
            'tagged-classnames-free': ['cls', 'tw'],
          },
        ],
      }),
      react(),
      tailwindcss(),
      monkey({
        entry: 'src/main.ts',
        userscript: {
          icon: 'https://vitejs.dev/logo.svg',
          namespace: 'npm/vite-plugin-monkey',
          match: allMatches,
          grant: ['unsafeWindow'],
          noframes: true,
        },
        build: {
          externalGlobals: {
            'react': cdn.jsdelivr('React', 'umd/react.production.min.js'),
            'react-dom': cdn.jsdelivr(
              'ReactDOM',
              'umd/react-dom.production.min.js',
            ),
          },
        },
      }),
    ],
  }
})
