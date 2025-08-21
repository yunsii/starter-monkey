import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import monkey, { cdn } from 'vite-plugin-monkey'
import tsconfigPaths from 'vite-tsconfig-paths'

import { getAllMatches } from './scripts/all-matches'

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const match = await getAllMatches()

  console.log(`👀 all userscript match:\n${match.map((item) => `- ${item}`).join('\n')}`)

  return {
    plugins: [
      tsconfigPaths(),
      react(),
      tailwindcss(),
      monkey({
        entry: 'src/main.ts',
        userscript: {
          icon: 'https://vitejs.dev/logo.svg',
          namespace: 'npm/vite-plugin-monkey',
          match,
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
