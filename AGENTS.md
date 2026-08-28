# AGENTS.md

用户脚本模板仓库：React 19 + Tailwind v4 + vite-plugin-monkey，产物是单个
`dist/starter-monkey.user.js`。每个功能是 `src/scripts/<分类>/<名>/index.tsx` 下的一个脚本，
运行时按当前 URL 决定执行哪些。命令、依赖、项目定位见 `package.json` 和 `README.md`，此处不重复。

## Hard Rules

### 脚本的注入范围写在源码里，不在 `vite.config.ts`

`scripts/script-infos.ts` 用 TypeScript AST **静态解析**（不执行）每个脚本的
`Script.displayName` 和 `Script.matches` / `Script.includes`，再由 `vite.config.ts` 注入
userscript 元数据。因此：

- 脚本路径必须是两级：`src/scripts/*/*/index.tsx`，否则 glob 扫不到。
- `matches` / `includes` 必须是**字面量数组**。引用常量、展开、拼接、计算表达式都会让构建抛
  `UserscriptConfig not found in source code`。
- 要改注入范围就改脚本源码，不要去 `vite.config.ts` 里手写 `match`。

参照 `src/scripts/google/demo/` 和 `src/scripts/v2ex/demo/` 两个示例。

### 不要手改 `auto-imports.d.ts`

它由 unplugin-auto-import 生成。`createShadowRootUi` / `createIntegratedUi` /
`reactRenderInShadowRoot` / `cls` / `tw` / React hooks / GM API 都是**自动导入的全局**——
看到没有 import 的符号不要补 import 语句，先查 `vite.config.ts` 里的 `autoImport` 配置。
要新增自动导入项，改 `vite.config.ts` 后跑 `pnpm dev` 或 `pnpm build` 重新生成。

### `pnpm verify cleanup` 会删掉浏览器里**所有** `(local build)` 脚本

包括其他仓库留下的。只想删本仓库的用 `pnpm verify remove "Starter Monkey (local build)"`。
详见 [docs/verify-loop.md](docs/verify-loop.md)。

### 两份 README 手工同步

`README.md` 与 `README.zh-CN.md` 内容对应，没有生成机制。改一份就要改另一份。

### 交付前的验证

至少跑 `pnpm lint && pnpm typecheck && pnpm test`（脚本定义见 `package.json`）。
改到 UI 在真实页面上的行为时，`pnpm build` 通过不算数——走 [docs/verify-loop.md](docs/verify-loop.md)
的浏览器循环，在真实站点上断言。

浏览器循环**默认走 dev server**：`pnpm dev` 起开发服务器，再 `pnpm verify install <serverUrl>`，
靠热更新「改一点看一眼」。只有要在 CSP 拦住本地模块加载的站点上做功能开发时，才改用
`pnpm verify install-build`——它没有热更新，每次改动都要重装。

`pnpm lint` 的 formatter 会重排 markdown 表格，手写的表格必然报错，用 `pnpm lint:fix`。
但注意它的 `unicorn/template-indent` 自动修复会给模板字符串统一加缩进——依赖行首锚点的字符串
（如 userscript 元数据块夹具）要用数组 `join('\n')` 构造，不要用模板字符串，否则会被静默改坏。

## Task Routing

只读匹配当前任务的那一篇，不要预加载全部。

| 任务                                                                         | 读                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| shadow root UI 的定位方式、样式隔离、document 级 CSS、弹层容器、宿主页根字号 | [docs/ui.md](docs/ui.md)                                            |
| 在真实浏览器 / Tampermonkey 上验证脚本，自动化验收循环                       | [docs/verify-loop.md](docs/verify-loop.md)                          |
| 新增或修改一个用户脚本                                                       | 上面第一条 Hard Rule + `src/scripts/*/demo/`                        |
| 命名前缀（DOM 属性、元素 id、CSS 变量、日志）                                | `src/helpers/namespace.ts`（fork 后改这一处）                       |
| 新增纯逻辑模块，或给 helper 加日志（能不能被 `node --test` 直接跑）          | [docs/verify-loop.md](docs/verify-loop.md) 「不需要浏览器的那一半」 |
