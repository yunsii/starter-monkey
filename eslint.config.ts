import { GLOB_SRC } from '@antfu/eslint-config'
import janna from '@jannajs/lint/eslint'
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss'

export default janna({
  formatters: true,
}, {
  files: [`src/${GLOB_SRC}`],
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  settings: {
    'better-tailwindcss': {
      entryPoint: 'src/components/inline-tailwindcss/tailwind-config.css',
    },
  },
  plugins: {
    'better-tailwindcss': eslintPluginBetterTailwindcss,
  },
  rules: {
    ...eslintPluginBetterTailwindcss.configs['recommended-error'].rules,
  },
})
