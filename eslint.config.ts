import { GLOB_SRC } from '@antfu/eslint-config'
import janna from '@jannajs/lint/eslint'
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss'

export default janna({
  formatters: true,
  // `CLAUDE.md` 是指向 `AGENTS.md` 的 symlink（AGENTS.md 是跨工具标准，CLAUDE.md 只为兼容
  // 旧的 Claude Code 解析路径）。不忽略的话同一份内容会被报两次，`--fix` 也会对同一个 inode
  // 写两次。真相源只有 AGENTS.md，lint 也只走它。
  ignores: ['CLAUDE.md'],
}, {
  // 验证链路的脚本用 Node 内置的 `node:test`，不引入 vitest：这条链路要在应用构建
  // 挂掉时也能跑，多一个转译/测试框架就多一个会把自己搞坏的环节。模板本身也不想
  // 为一个纯逻辑断言背上一整套测试框架依赖。
  files: ['**/*.test.mjs', '**/*.test.ts'],
  rules: {
    'test/no-import-node-test': 'off',
  },
}, {
  // 脚本入口按约定同时导出 `default`（功能本体）和 `settings`（配置声明）——
  // 后者必须是具名导出，配置面板才能在不执行功能的前提下读到它。两者都不是组件，
  // fast refresh 那条规则的前提在这里不成立。
  files: ['src/scripts/*/*/index.tsx'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
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
