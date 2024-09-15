import react from '@vitejs/plugin-react-swc'
import unoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import monkey, { cdn } from 'vite-plugin-monkey'

import { getAllMatches } from './scripts/all-matches'

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const match = await getAllMatches()
  // eslint-disable-next-line no-console
  console.log(`👀 all userscript match:\n${match.map((item) => `- ${item}`).join('\n')}`)

  return {
    plugins: [
      unoCSS(),
      react(),
      monkey({
        entry: 'src/main.tsx',
        userscript: {
          icon: 'https://vitejs.dev/logo.svg',
          namespace: 'npm/vite-plugin-monkey',
          match,
        },
        build: {
          externalGlobals: {
            'react': cdn.jsdelivr('React', 'umd/react.production.min.js'),
            'react-dom': cdn.jsdelivr(
              'ReactDOM',
              'umd/react-dom.production.min.js',
            ),
            'lodash': ['_', 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'],
          },
        },
      }),
    ],
  }
})
