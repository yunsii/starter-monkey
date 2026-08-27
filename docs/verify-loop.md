# 自动化验证循环

用户脚本的麻烦在于：它只有装进浏览器、注入到真实站点上才算数。跑通 `pnpm build`
什么都不证明。这份文档描述的是一条**不需要真人点鼠标**的闭环：

```
改代码 → 装进 Tampermonkey → 打开宿主页 → 轮询断言 → 改代码 …
```

配套的工具是 `scripts/tampermonkey-cdp.mjs`（裸 CDP，零依赖，`node` 直接跑）。

## 前提

Chrome 必须带远程调试端口启动，且已装 Tampermonkey：

```bash
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

前提查得对不对，让工具自己说：

```bash
pnpm verify doctor
```

它会逐条打印 Node 版本、CDP 可达性、Tampermonkey 扩展 id、是否有可用的网页标签、
dev server、构建产物，缺哪一环就给出对应的处理建议，并以非零码退出。
**先跑它**——缺前提时后面的命令会以看起来毫不相干的方式失败（「找不到安装按钮」
「面板没有列出任何脚本」）。

> 端口被占用时用 `CDP_PORT=9333` 覆盖；dev server 不在 5173 时用
> `MONKEY_DEV_URL=http://127.0.0.1:5174` 覆盖。

## 关键的一点，不知道就会得出相反结论

Tampermonkey 的安装确认页是 `chrome-extension://<id>/ask.html`，而
**`chrome-devtools` MCP 不列出 `chrome-extension://` 目标**。所以用它导航到
`.user.js` 之后，页面列表里什么都没多出来，看起来像「提示根本没弹、这事没法
自动化」——**是错的**。提示就开在那儿，只是那个工具看不见它。Chrome 自己的
`/json/list` 列得出来，连上那个 target 的 WebSocket 就能点掉。

`scripts/tampermonkey-cdp.mjs` 做的就是这件事。Tampermonkey 的**面板**
（`options.html`）也在同一个盲区里，所以 `list` / `toggle` / `remove` 都走
浏览器级 CDP 会话自己建标签页。

## 两种安装模式

**默认走 dev server。** 先起开发服务器，再装 dev 版脚本：

```bash
pnpm dev                                      # 另开一个终端
pnpm verify install http://127.0.0.1:5173
```

热更新是这条循环的价值所在——改一个常量、刷新页面就能在真实站点上看到结果。
不要因为 `install-build` 步骤看起来更少就默认用它：它每次改动都要重装重构建，
在「改一点看一眼」的开发节奏下反而更慢。

**只有在宿主页 CSP 拦住本地模块加载时才改用 `install-build`**，也就是要在这类站点上
做功能开发的时候：

```bash
pnpm verify install-build
pnpm verify install-build --no-build          # 复用已有产物
```

dev 版脚本只是个加载器，运行时要从 `127.0.0.1:5173` 拉几百个模块；严格 CSP 的站点
（或 Chrome 拦住 HTTPS 页面访问 `http://localhost` 时）会把这些请求拦掉，表现为脚本装上了
却什么都不做。构建产物把一切内联、运行时不碰本地端口，任何 CSP 都拦不住。它也比装
Disable CSP 扩展 + 改 `chrome://flags` 轻得多，且不需要真人动浏览器。

|                       | `install <serverUrl>`（默认）                | `install-build`（CSP 受限时） |
| --------------------- | -------------------------------------------- | ----------------------------- |
| 脚本内容              | 只是加载器，运行时从 `127.0.0.1:5173` 拉模块 | 构建产物，全部内联            |
| 热更新                | 有，改完刷新页面即生效                       | 无，每次改动要重新装          |
| 宿主页 CSP / 私有网络 | 可能被拦：装上了却什么都不做                 | 不受影响，运行时不碰本地      |
| UI 首次出现           | 慢，几百个模块逐个 serve                     | 快                            |

`install-build` 会改写元数据（`@name` 追加 `(local build)`、换 `@namespace`、
删掉 `@updateURL`/`@downloadURL`），所以它与已发布版**并存**而不是覆盖，
也不会被自动更新悄悄换回线上版。代价是两者 `@match` 相同、会双份注入，
装完记得关掉其中一个：

```bash
pnpm verify list
pnpm verify toggle "Starter Monkey" off
```

这段改写逻辑由 `scripts/tampermonkey-cdp.test.mjs` 断言（`pnpm test`），
因为它改错了不会报错，只会在面板上留下一个「装了但好像没装」的重名副本。

## 一次完整的验收

```bash
pnpm verify doctor
pnpm dev &
pnpm verify install http://127.0.0.1:5173
pnpm verify open https://www.v2ex.com/

# 等 UI 真的挂上来，而不是 sleep 一个拍脑袋的固定值
pnpm verify wait v2ex.com "!!document.querySelector('[data-starter-monkey-shadow-root]')"

# 断言具体行为
pnpm verify eval v2ex.com "getComputedStyle(document.querySelector('[data-starter-monkey-shadow-root]')).zIndex"

# 改完代码之后
pnpm verify reload v2ex.com
pnpm verify wait v2ex.com "..."
```

`wait` 会轮询到表达式为真值或超时（`--timeout`，默认 30000），超时以非零码退出。
`reload` 会等到新文档真的 `load` 完再返回。

### 验收完立刻清理

本地构建装完不删比不装还糟：它会在每个匹配页面持续注入、悄悄盖住已发布版，
下次调试时你会对着一个陈旧的产物排查。所以清理是流程的一部分，不是收尾的客套。

```bash
pnpm verify cleanup                          # 删掉所有 (local build)
pnpm verify toggle "Starter Monkey" on       # 把之前关掉的开回来
```

`cleanup` **只删本地构建**，不会自动启用任何脚本——「所有停用的脚本」里也包含
用户自己有意关掉的，而且已发布脚本的显示名可能是本地化的（`@name:zh-CN`），
没法可靠地映射回它遮挡的那一个。所以它把待恢复项列出来，由你确认。

同名脚本用 `--id` 消歧（`remove` 匹配到多个时会把 id 打出来）：

```bash
pnpm verify remove "Starter Monkey (local build)"
pnpm verify remove --id tr_xxxxxxxx
```

## 这条链路上会骗人的几个点

都是实测踩过的，不知道就会得出「这事没法自动化」的相反结论：

- **`chrome-extension://` 页不被 chrome-devtools MCP 列出**（安装确认页和
  Tampermonkey 面板都是）。所以这里用裸 CDP，而不是那个 MCP。
- **面板标签不能后台创建**：`Target.createTarget({ background: true })` 拿到的
  标签会被节流，Tampermonkey 一直不填充列表，读到的只有那行静态
  `<New userscript>` 模板，看着像「一个脚本都没装」。
- **列表是逐行渲染的**，「至少有一行」在渲染中途就为真，会拿到半截列表。
  要等行数连续几次不变。
- **不要复用上一次留下的面板标签**：它显示的是当时的列表，之后装的脚本不在里面，
  于是刚装好的东西看起来像装失败了。
- **开关的 `title` 异步更新**：点完立刻回读还是旧状态，会把一次成功的切换判成失败。
- **`Page.reload` 之后立刻查询命中的是旧文档**，必须先等 `Page.loadEventFired`
  再开始轮询——而且监听器要在 reload **之前**挂上。`reload` 子命令已处理。
- **dev server 模式下脚本 UI 出现明显晚于页面 `load`**（几百个模块要逐个拉），
  验收要轮询等待。用 `wait`，不要 sleep 固定值。
- **`@name` 可能有本地化变体**（`@name:zh-CN`）。Tampermonkey 显示本地化名，
  只改 `@name` 会导致面板上仍是原名，看起来像没装上，实际是装了一个重名副本。
  `install-build` 会把所有 `@name:*` 一起改。
- **同名脚本并存会让断言读到旧产物**：`(local build)` 与 dev 版 `@match` 相同、挂的
  自定义元素名也相同，两份同时注入时 `document.querySelector('<host>')` 命中的是先挂上的
  那一个。症状是代码改了、`install` 重装了、`reload` 也刷了，断言值却一动不动，看起来像
  HMR 坏了或者改动没编译进去。开工前先 `pnpm verify list` 确认只有一份是启用的。
- **点了「安装」不等于装上了**。`install` 打印「已点击 Reinstall」只说明按钮被点了。
  `install-build` 会回面板核对；用 `install` 时请自己用 `wait` 在宿主页上确认。
- **往 Monaco 里塞文字，只调 `element.focus()` 是不够的**——编辑器的 textarea 在
  shadow root 里，`Input.insertText` 不会落进去，文档悄无声息地毫无变化。必须先派发
  一次真实的鼠标点击。`type` 子命令已处理。
- **`Input.dispatchKeyEvent` 依赖浏览器窗口的系统焦点**，而且会在某个时刻悄悄不再送达 ——
  页面一个 `keydown` 都收不到，表现得像快捷键功能本身坏了。判据是先在页面上挂一个捕获监听
  回读收到的按键：一条都没有就是事件没送达，而不是匹配没中。替代路径是 `element.click()`，
  它不依赖焦点。快捷键这类入口因此不适合当验收的**唯一**通路。
- **别拿跨大版本改过的类名做断言**。`.ant-drawer-content` 是 antd 5 的类名，antd 6 没有 ——
  抽屉明明开着（`ant-drawer-open` 在、标题也在），断言却报「没打开」。这和
  [docs/ui.md](ui.md) 里「查『看不见』必须用命中测试」是同一类陷阱：断言对象选错了，
  失败信息会把你引向完全无关的方向。
- **反向对照必须只差一个变量**。做「去掉某个补丁看是不是真的会坏」这类对照时，如果上一轮
  验收顺手点过某个会**写进 GM 存储**的开关（悬浮入口、功能启用……），那个状态会跨构建留存，
  于是你以为在测补丁，实际在测自己上一步的副作用 —— 实测把「点击抛异常」误读成了「整个
  不渲染」，结论完全反了。所以验收动作优先选**不写持久状态**的目标；下结论前先确认对照组
  只差预期那一项。
- **后台标签的 `requestAnimationFrame` 被冻结，弹层的入场动画会停在起点**。`Target.createTarget`
  开出来的宿主页标签 `document.visibilityState` 是 `hidden`，rAF 不执行 —— antd 抽屉的入场动画
  由 rc-motion 驱动，于是 `.ant-drawer-content-wrapper` 一直停在 `translateX(100%)`。症状很像
  「被什么东西盖住了」：`.ant-drawer-open` 在、元素查得到、文本读得出，但
  `getBoundingClientRect()` 的 `x` 落在视口右侧之外，`elementFromPoint` 返回 `null`。
  `Page.bringToFront` 只能把它设成所在窗口的活动标签，窗口本身不在前台时（WSL2 里 Chrome
  跑在 Windows 宿主上就是这样）`visibilityState` 照旧是 `hidden`。要做命中测试就先把动画推到
  终态（给 wrapper 设一次 `transform: none`）；行为断言则完全不必等它 —— `element.click()`
  和 `dispatchEvent` 都不要求元素可见。
- **这份文档里的 `starter-monkey-*` 都是示例值**。DOM 属性、元素 id、自定义元素名全都从
  `src/helpers/namespace.ts` 的 `NAMESPACE` 推导，fork 改过之后照抄这里的命令会一个都查不到，
  症状恰好和「脚本没装上」一模一样。抄之前先看一眼那个常量。
- **别用 `textContent` 判断 UI 的开合**。shadow root 的 `textContent` 把里面的 `<style>`
  文本也算进去。判「编辑器弹窗关掉了没」时断言「不含 `Monaco`」会永远失败 —— Monaco 的
  样式表里本来就有 `Monaco`（字体族），而样式不随内容卸载被移除。开合要断言真正会消失的
  那个节点（遮罩、容器，也就是组件关闭时 `return null` 的那一层）。这是本节第三个
  「断言对象选错」，规律很稳定：下断言之前先问一句「这个对象在关闭之后到底还在不在」。
- **图标类走的是 `mask-image`，不是 `background-image`**。想确认 `i-bx--*` 到底有没有渲染出来，
  要读 `getComputedStyle(el).maskImage`；读 `backgroundImage` 只会拿到 `none`，据此得出的
  「图标没生成」是假警报。又一次「断言对象选错」。
- **用户脚本管理器的菜单项目前验不了**。Tampermonkey 的 popup 需要真实的浏览器动作上下文：
  用 `Target.createTarget` 开成普通标签，它会把「当前活动标签」查到自己头上，列不出任何
  菜单命令（换独立窗口、或先聚焦宿主页再刷新，都不行）。菜单恰恰是唯一对页面零侵入的入口，
  却是这条链路上唯一断言不到的一环 —— 目前只能间接确认「注册没抛异常」（它在 `main.ts` 里
  排在功能执行之前，抛了功能就根本不会跑）。

## 不需要浏览器的那一半

`pnpm test` 跑 `node --test`（Node 内置，零依赖），目前覆盖元数据改写、`includes` 模式编译、
快捷键解析、配置存储键这几块纯逻辑。纯逻辑能在这里断言的，就不要放到浏览器循环里——后者慢、
需要前提、且失败原因更含糊。

被 `node --test` 直接加载的模块**不能依赖浏览器 / GM API**（`import.meta.env`、`GM_*`、
`window` 都算）。想加日志就加在调用方，别为了一行 warn 把整个模块从这一半赶到浏览器那一半。

### 判断测试是真抓住了 bug，还是只描述了现象

把实现回退成修复前的行为，跑一遍测试，看它是不是真的会红。不红就说明那些断言只是在陈述
当前实现，换个人重构一次照样全绿。同理，加约束时也做一次反向的：故意写一个非法值，确认
构建期或 import 期真的会炸。

**还原时用备份，不要用 `git checkout <file>`。** 那个文件通常正带着你这次尚未提交的改动，
`checkout` 会把它们一起抹掉。症状还很有迷惑性：实测是把一个文件还原后，另一个文件仍在
import 刚被抹掉的导出，构建报 `Missing export` —— 看起来像新加的 import 写错了，跟变异
本身毫无关系。先 `cp` 到临时目录，验完再 `cp` 回来。
