import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import autoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import monkey, { cdn, util } from 'vite-plugin-monkey'
import tsconfigPaths from 'vite-tsconfig-paths'

import type { Plugin } from 'vite'

import { getScriptInfos, printScriptInfos } from './scripts/script-infos'
import { localesMeta } from './src/locales/meta'

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
          util.unimportPreset,
          {
            'tagged-classnames-free': ['cls', 'tw'],
          },
          {
            '@/helpers/ui/integrated': ['createIntegratedUi'],
            '@/helpers/ui/shadow-root': ['createShadowRootUi'],
            '@/helpers/react/shadow-root-helpers': ['reactRenderInShadowRoot'],
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
      monkey({
        entry: 'src/main.ts',
        userscript: {
          name: localesMeta.name,
          description: localesMeta.description,
          icon: 'https://vitejs.dev/logo.svg',
          namespace: 'yuns',
          match: allMatches,
          grant: ['unsafeWindow'],
          noframes: true,
          license: 'MIT',
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
