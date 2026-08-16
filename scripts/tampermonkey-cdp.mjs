#!/usr/bin/env node
/**
 * 用裸 CDP 驱动 Tampermonkey 和宿主页面，全程不需要真人点鼠标。
 *
 * 存在的理由是一个很具体的缺口：Tampermonkey 的安装确认页是
 * `chrome-extension://<id>/ask.html`，而 **`chrome-devtools` MCP 不列出
 * `chrome-extension://` 目标** —— 于是从 agent 的视角看，导航到 `.user.js`
 * 之后页面列表里什么都没多出来，最容易得出的结论（「提示根本没弹，这事没法
 * 自动化」）是错的。提示就开在那儿，只是那个工具看不见它。Chrome 自己的
 * `/json/list` 列得出来，连上那个 target 的 WebSocket 就能点掉。
 *
 * 前提：Chrome 带 `--remote-debugging-port=9222` 启动，且已装 Tampermonkey。
 * 先跑 `doctor` 会把这些前提逐条查一遍。
 *
 * 用法：
 *   node scripts/tampermonkey-cdp.mjs doctor
 *   node scripts/tampermonkey-cdp.mjs install http://127.0.0.1:5173
 *   node scripts/tampermonkey-cdp.mjs install-build [--no-build]
 *   node scripts/tampermonkey-cdp.mjs list
 *   node scripts/tampermonkey-cdp.mjs toggle "Starter Monkey" off
 *   node scripts/tampermonkey-cdp.mjs remove "Starter Monkey (local build)"
 *   node scripts/tampermonkey-cdp.mjs cleanup
 *   node scripts/tampermonkey-cdp.mjs open https://www.v2ex.com/
 *   node scripts/tampermonkey-cdp.mjs reload v2ex.com
 *   node scripts/tampermonkey-cdp.mjs eval v2ex.com "document.title"
 *   node scripts/tampermonkey-cdp.mjs wait v2ex.com "!!document.querySelector('[data-starter-monkey-shadow-root]')"
 *   node scripts/tampermonkey-cdp.mjs type v2ex.com "hello"
 *   node scripts/tampermonkey-cdp.mjs targets
 *
 * `install` 装的是 vite dev server 版（有热更新），`install-build` 装的是构建产物
 * （不受宿主页 CSP 影响）。怎么选见 docs/verify-loop.md。
 *
 * 刻意用 `.mjs` 而不是 `.ts`：这条链路要在「构建挂了」的时候也能跑，多一个转译器
 * 就多一个会把自己搞坏的环节。裸 node 跑，零依赖。
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const PORT = process.env.CDP_PORT ?? '9222'
const endpoint = `http://127.0.0.1:${PORT}`
const CDP_TIMEOUT_MS = 20000
const DEV_SERVER_URL = process.env.MONKEY_DEV_URL ?? 'http://127.0.0.1:5173'
const ROOT = fileURLToPath(new URL('..', import.meta.url))

// `WebSocket` 是 Node 22 才默认可用的全局。低版本上失败信息会是
// 「WebSocket is not defined」，看不出是环境问题。
if (typeof WebSocket === 'undefined') {
  console.error(`需要 Node >= 22（当前 ${process.version}）：这个脚本用的是内置的全局 WebSocket。`)
  process.exit(1)
}

async function targets() {
  const response = await fetch(`${endpoint}/json/list`).catch(() => null)
  if (!response) {
    throw new Error(`连不上 ${endpoint}。Chrome 需要带 --remote-debugging-port=${PORT} 启动，详见 docs/verify-loop.md。`)
  }
  return response.json()
}

async function findTarget(match, { wait = 0 } = {}) {
  const deadline = Date.now() + wait
  do {
    const found = (await targets()).find((t) => t.type === 'page' && t.url.includes(match))
    if (found) {
      return found
    }
    await new Promise((r) => setTimeout(r, 300))
  } while (Date.now() < deadline)
  return null
}

/** 一条 CDP 会话，只封装这个脚本用得到的那几个调用。 */
async function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  let seq = 0
  const listeners = new Set()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    for (const listener of [...listeners]) {
      listener(message)
    }
  })

  // 每个调用都有超时。否则一个永远不会到达的回包 —— target 被关掉了、导航把
  // 执行上下文销毁了 —— 会让 promise 永远挂着，整条命令没有任何输出地卡死。
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq
      let timer
      const onMessage = (message) => {
        if (message.id !== id) {
          return
        }
        clearTimeout(timer)
        listeners.delete(onMessage)
        resolve(message.result)
      }
      timer = setTimeout(() => {
        listeners.delete(onMessage)
        reject(new Error(`CDP ${method} 超时（${CDP_TIMEOUT_MS}ms）`))
      }, CDP_TIMEOUT_MS)
      listeners.add(onMessage)
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })

  /** 等一个 CDP 事件。必须在触发它的调用**之前**挂上，否则会错过。 */
  const once = (method, { wait = CDP_TIMEOUT_MS } = {}) =>
    new Promise((resolve, reject) => {
      let timer
      const onMessage = (message) => {
        if (message.method !== method) {
          return
        }
        clearTimeout(timer)
        listeners.delete(onMessage)
        resolve(message.params)
      }
      timer = setTimeout(() => {
        listeners.delete(onMessage)
        reject(new Error(`等待事件 ${method} 超时（${wait}ms）`))
      }, wait)
      listeners.add(onMessage)
    })

  const evaluate = async (expression) => {
    // `userGesture` 是有意义的：一部分扩展 UI 会把没有用户激活的调用当成不可信，
    // 然后什么都不做，且不报错。
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    })
    if (result?.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed')
    }
    return result?.result?.value
  }

  return { send, once, evaluate, close: () => ws.close() }
}

async function waitFor(read, { wait = 5000, interval = 250 } = {}) {
  const deadline = Date.now() + wait
  do {
    const value = await read()
    if (value) {
      return value
    }
    await new Promise((r) => setTimeout(r, interval))
  } while (Date.now() < deadline)
  return null
}

/**
 * 导航到一个 `.user.js`，让 Tampermonkey 拦截它。
 *
 * 走真实页面里的 `window.open` 而不是新建标签页：不带 `userGesture` 会被弹窗
 * 拦截器拒掉，而 `evaluate` 会带上它。
 */
async function openUserscriptUrl(url) {
  const page = (await targets()).find((t) => t.type === 'page' && t.url.startsWith('http'))
  if (!page) {
    throw new Error('浏览器里没有普通网页标签，无法触发安装导航。先随便打开一个 http(s) 页面。')
  }
  const session = await attach(page)
  await session.evaluate(`window.open(${JSON.stringify(url)}, '_blank')`)
  session.close()
}

/**
 * 点掉 Tampermonkey 当前开着的安装/更新确认。
 *
 * 导航到 `.user.js` 这一步任何浏览器自动化都能做，留给调用方；这里只处理必须
 * 走裸 CDP 的那一段。
 */
async function install(serverUrl) {
  if (serverUrl) {
    await openUserscriptUrl(`${serverUrl.replace(/\/$/, '')}/__vite-plugin-monkey.install.user.js`)
  }

  // Tampermonkey 是异步开这个提示页的，无法直接拦截导航时还会绕一次
  // tampermonkey.net 的中转页。
  const ask = await findTarget('ask.html', { wait: 8000 })
  if (!ask) {
    console.log('没有待确认的安装提示（可能已装且内容未变，或导航被拦截）')
    return
  }

  const session = await attach(ask)
  // 轮询按钮，而不是读一次。target 在标签页创建的瞬间就存在，但按钮是页面自己的
  // 脚本渲染的 —— `findTarget` 之后立刻读会输掉这个竞争，对一个半秒后才出现的
  // 提示报「找不到安装按钮」。
  let clicked = null
  for (let attempt = 0; attempt < 20 && !clicked; attempt += 1) {
    clicked = await session.evaluate(`
      (() => {
        const button = [...document.querySelectorAll('button,input[type=button],input[type=submit]')]
          .find((b) => /reinstall|update|install|安装|更新/i.test(b.value || b.textContent || ''))
        if (!button) return null
        button.click()
        return (button.value || button.textContent).trim()
      })()
    `)
    if (!clicked) {
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  session.close()
  console.log(clicked ? `已点击「${clicked}」` : '找不到安装按钮')
}

// Tampermonkey 5.x 面板的内部结构。天然脆弱 —— 哪个选择器不匹配了，
// 从 `listScripts` 开始重新摸结构。
function readRow(name) {
  return `
    (() => {
      for (const tr of document.querySelectorAll('tr.scripttr')) {
        if (tr.querySelector('.nameNname16')?.textContent.trim() !== ${JSON.stringify(name)}) continue
        const toggle = tr.querySelector('div.clickable[title]')
        return toggle ? { title: toggle.title } : null
      }
      return null
    })()
  `
}

/** 找到构建产物。 */
function findBundle() {
  const distDir = join(ROOT, 'dist')
  const files = existsSync(distDir) ? readdirSync(distDir).filter((file) => file.endsWith('.user.js')) : []
  return files.length > 0 ? join(distDir, files[0]) : null
}

/** `install-build` 追加的后缀，也是 `cleanup` 的识别依据。 */
const LOCAL_SUFFIX = '(local build)'

/**
 * 改写产物元数据，让本地构建与已发布版**并存**而不是覆盖它。
 *
 * 单独抽出来是因为这是整条链路里唯一的纯函数，也是最容易静默出错的一段：
 * 改错了不会报错，只会在面板上看到一个「装了但好像没装」的重名副本。
 * `scripts/tampermonkey-cdp.test.mjs` 直接断言它。
 */
export function rewriteUserscriptMeta(raw) {
  // 取产物里的 `@name` 作为基名，而不是 package.json 的包名：面板上显示的是
  // 前者，两者不一致时会对着面板找不到刚装的东西。
  const baseName = /^\/\/ @name[ \t]+(?<name>[^\n]*)/m.exec(raw)?.groups.name.trim() || 'userscript'
  const localName = `${baseName} ${LOCAL_SUFFIX}`

  const source = raw
    .split('\n')
    // 去掉更新地址，否则 Tampermonkey 会在你背后把这个本地构建换成线上版。
    .filter((line) => !/^\/\/ @(?:downloadURL|updateURL)\b/.test(line))
    .map((line) => {
      // 所有本地化变体（`@name:en`、`@name:zh-CN`…）一起改。Tampermonkey 显示的是
      // 本地化名，只改 `@name` 会让面板上仍是原名，看起来像没装上 ——
      // 实际是装了一个重名副本。
      const named = /^\/\/ @name(?<locale>:[\w-]+)?\s/.exec(line)
      if (named) {
        return `// @name${named.groups.locale ?? ''}         ${localName}`
      }
      return /^\/\/ @namespace\s/.test(line)
        ? `// @namespace    user/starter-monkey-local-build`
        : line
    })
    .join('\n')

  return { source, baseName, localName }
}

/**
 * 装构建产物，而不是 dev server 版。
 *
 * 为什么要有这个模式：dev server 版脚本只是个加载器，运行时会从
 * `127.0.0.1:5173` 拉几百个 ES 模块。宿主页面若有严格 CSP（或撞上 Chrome 的
 * 私有网络访问检查），这些请求会被拦掉 —— 脚本装上了，然后什么都不做。
 * 构建产物把一切内联，运行时不碰本地端口，任何 CSP 都拦不住它。
 *
 * 代价是没有热更新：每次改完代码都要重跑一次。
 *
 * 产物的元数据会被改写，让它与已发布版**并存**而不是覆盖 —— 但两者 `@match`
 * 相同，装完记得关掉其中一个，否则会双份注入。
 */
async function installBuild({ build = true } = {}) {
  if (build) {
    console.log('构建中（跳过请加 --no-build）…')
    await new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit' })
      child.on('error', reject)
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`构建失败（exit ${code}）`))))
    })
  }

  const bundle = findBundle()
  if (!bundle) {
    throw new Error('dist 下没有 .user.js，去掉 --no-build 让它先构建')
  }

  const { source, baseName, localName } = rewriteUserscriptMeta(readFileSync(bundle, 'utf8'))

  // Tampermonkey 只拦截路径以 `.user.js` 结尾的导航，所以走 http 起一个临时服务，
  // 而不是直接给 file:// 路径（后者还需要手动打开扩展的文件访问权限）。
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
    response.end(source)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    await openUserscriptUrl(`http://127.0.0.1:${server.address().port}/local-build.user.js`)
    await install()
  } finally {
    server.close()
  }

  // 点了「安装」不等于装上了。回面板核对。
  const installed = await withDashboard((evaluate) => evaluate(readRow(localName)))
  if (!installed) {
    throw new Error(`点了安装但「${localName}」没出现在 Tampermonkey 列表里`)
  }
  console.log(`已安装「${localName}」（${installed.title}），与已发布版并存；`)
  console.log(`用 toggle ${JSON.stringify(baseName)} off 关掉已发布版，否则两份都会注入。`)
}

/** Tampermonkey 的官方扩展 id；跑 Beta 版时用 TAMPERMONKEY_ID 覆盖。 */
const TAMPERMONKEY_ID = 'dhdgffkkebhmkfjojejmpbldmpobfkfo'

async function extensionIds() {
  const browser = await attachBrowser()
  try {
    const { targetInfos } = await browser.send('Target.getTargets')
    return new Set(
      targetInfos
        .map((t) => /^chrome-extension:\/\/([a-p]{32})\//.exec(t.url)?.[1])
        .filter(Boolean),
    )
  } finally {
    browser.close()
  }
}

async function tampermonkeyId() {
  if (process.env.TAMPERMONKEY_ID) {
    return process.env.TAMPERMONKEY_ID
  }
  const ids = await extensionIds().catch(() => new Set())
  if (ids.has(TAMPERMONKEY_ID) || ids.size === 0) {
    return TAMPERMONKEY_ID
  }
  return ids.size === 1 ? [...ids][0] : TAMPERMONKEY_ID
}

async function attachBrowser() {
  const { webSocketDebuggerUrl } = await (await fetch(`${endpoint}/json/version`)).json()
  return attach({ webSocketDebuggerUrl })
}

/**
 * 在 Tampermonkey 面板上做点什么。
 *
 * 面板是 `chrome-extension://` 页，chrome-devtools MCP 同样不列出它 —— 和安装
 * 确认页是同一个盲区。浏览器级的 CDP 会话仍然能建出来并驱动它。
 */
async function withDashboard(run) {
  const optionsUrl = `chrome-extension://${await tampermonkeyId()}/options.html`
  const browser = await attachBrowser()

  // 永远开一个新面板，而不是复用上一次跑剩下的：陈旧的标签显示的是当时的列表，
  // 之后装的脚本不在里面，于是刚装好的东西看起来像装失败了。顺手关掉被中断的
  // 运行留下的面板，免得在用户浏览器里堆积、又被误当成新开的。
  for (const stale of (await targets()).filter((t) => t.url.startsWith(optionsUrl))) {
    await browser.send('Target.closeTarget', { targetId: stale.id }).catch(() => {})
  }

  // 不能用 `background: true`：后台标签会被节流，Tampermonkey 一直不填充列表，
  // 读到的只有那行静态的 `<New userscript>` 模板。
  const { targetId } = await browser.send('Target.createTarget', {
    url: `${optionsUrl}#nav=dashboard`,
  })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  await browser.send('Runtime.enable', {}, sessionId)

  const evaluate = async (expression) => {
    const result = await browser.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true, userGesture: true },
      sessionId,
    )
    if (result?.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed')
    }
    return result?.result?.value
  }

  // 列表是逐行渲染的，「至少有一行」在渲染中途就为真，会拿到半截列表。
  // 要等行数连续几次不变。
  let seen = -1
  let unchanged = 0
  const ready = await waitFor(
    async () => {
      const count = await evaluate(`document.querySelectorAll('tr.scripttr').length`).catch(() => 0)
      unchanged = count === seen ? unchanged + 1 : 0
      seen = count
      return count > 0 && unchanged >= 3
    },
    { wait: 20000, interval: 400 },
  )
  if (!ready) {
    throw new Error('Tampermonkey 面板没有列出任何脚本（没装 Tampermonkey？或 DOM 结构已变，先跑 doctor）')
  }

  try {
    return await run(evaluate)
  } finally {
    await browser.send('Target.closeTarget', { targetId })
    browser.close()
  }
}

async function listScripts() {
  const scripts = await withDashboard((evaluate) => evaluate(`
    [...document.querySelectorAll('tr.scripttr')].map((tr) => ({
      name: tr.querySelector('.nameNname16')?.textContent.trim(),
      state: tr.querySelector('div.clickable[title]')?.title,
    })).filter((s) => s.name)
  `))
  for (const script of scripts) {
    console.log(`${script.state === 'Enabled' ? '●' : '○'} ${script.name}`)
  }
}

async function toggleScript(name, desired) {
  await withDashboard(async (evaluate) => {
    const row = await evaluate(readRow(name))
    if (!row) {
      throw new Error(`Tampermonkey 里没有名为「${name}」的脚本，先跑 list 看看`)
    }
    if (row.title === desired) {
      console.log(`${name}: 已是 ${desired}`)
      return
    }

    await evaluate(`
      (() => {
        for (const tr of document.querySelectorAll('tr.scripttr')) {
          if (tr.querySelector('.nameNname16')?.textContent.trim() !== ${JSON.stringify(name)}) continue
          tr.querySelector('div.clickable[title]').click()
          return true
        }
        return false
      })()
    `)

    // `title` 的更新滞后于点击。立刻回读拿到的是旧状态，会把一次成功的切换判成失败。
    const settled = await waitFor(
      async () => (await evaluate(readRow(name)))?.title === desired,
      { wait: 5000 },
    )
    console.log(settled ? `${name}: ${row.title} → ${desired}` : `${name}: 点击后状态未变`)
  })
}

async function removeScript({ name, id }) {
  await withDashboard(async (evaluate) => {
    const matches = await evaluate(`
      [...document.querySelectorAll('tr.scripttr')]
        .map((tr) => ({ id: tr.id, name: tr.querySelector('.nameNname16')?.textContent.trim() }))
        .filter((row) => ${id ? `row.id === ${JSON.stringify(id)}` : `row.name === ${JSON.stringify(name)}`})
    `)
    if (matches.length === 0) {
      throw new Error(`Tampermonkey 里没有${id ? ` id 为 ${id}` : `名为「${name}」`}的脚本`)
    }
    if (matches.length > 1) {
      const ids = matches.map((row) => `  --id ${row.id}`).join('\n')
      throw new Error(`有 ${matches.length} 个脚本都叫「${name}」，改用 remove --id 指定：\n${ids}`)
    }

    const [row] = matches
    await evaluate(`
      document.getElementById(${JSON.stringify(row.id)})
        .querySelector('span.actions [title="Delete"], span.actions [title="删除"]')
        .click()
    `)
    const gone = await waitFor(
      async () => !(await evaluate(`!!document.getElementById(${JSON.stringify(row.id)})`)),
      { wait: 5000 },
    )
    console.log(gone ? `已删除「${row.name}」` : `点了删除但「${row.name}」还在（可能弹了确认框）`)
  })
}

/**
 * 撤销一次验收装上的东西。
 *
 * 本地构建装完不删比不装还糟：它会在每个匹配页面持续注入、悄悄盖住已发布版，
 * 下次调试时你会对着一个陈旧的产物排查。所以清理是流程的一部分，不是收尾的客套。
 */
async function cleanup() {
  const scripts = await withDashboard((evaluate) => evaluate(`
    [...document.querySelectorAll('tr.scripttr')].map((tr) => ({
      id: tr.id,
      name: tr.querySelector('.nameNname16')?.textContent.trim(),
      state: tr.querySelector('div.clickable[title]')?.title,
    })).filter((s) => s.name)
  `))

  const locals = scripts.filter((s) => s.name.includes(LOCAL_SUFFIX))
  for (const local of locals) {
    await removeScript({ id: local.id })
  }

  if (locals.length === 0) {
    console.log(`没有找到 ${LOCAL_SUFFIX} 脚本`)
  }

  // 刻意**不**自动启用任何脚本。本地构建通常伴随「关掉已发布版」，但「所有停用的
  // 脚本」里也包含用户自己有意关掉的，而且已发布脚本的显示名可能是本地化的
  // （`@name:zh-CN`），没法可靠地映射回它遮挡的那一个。
  const disabled = scripts.filter((s) => s.state === 'Disabled' && !s.name.includes(LOCAL_SUFFIX))
  if (disabled.length > 0) {
    console.log('\n以下脚本当前是停用状态，如果是这次验收关掉的，记得开回来：')
    for (const script of disabled) {
      console.log(`  node scripts/tampermonkey-cdp.mjs toggle ${JSON.stringify(script.name)} on`)
    }
  }
}

/** 打开一个宿主页面，等它 load 完再返回。 */
async function open(url) {
  const browser = await attachBrowser()
  const { targetId } = await browser.send('Target.createTarget', { url })
  browser.close()
  const target = await waitFor(
    async () => (await targets()).find((t) => t.id === targetId),
    { wait: 15000, interval: 300 },
  )
  console.log(target ? `已打开 ${target.url}` : `已请求打开 ${url}，但没在目标列表里找到它`)
}

/**
 * 刷新页面，并等到新文档真的 load 完。
 *
 * `Page.reload` 之后立刻查询命中的是**旧文档**，拿到的是刷新前的结果。必须先等
 * `Page.loadEventFired`，而监听器要在 reload **之前**挂上。
 */
async function reload(match) {
  const target = await findTarget(match, { wait: 5000 })
  if (!target) {
    throw new Error(`没有匹配 ${match} 的页面`)
  }
  const session = await attach(target)
  await session.send('Page.enable')
  const loaded = session.once('Page.loadEventFired', { wait: 60000 })
  await session.send('Page.reload', { ignoreCache: true })
  await loaded
  session.close()
  console.log(`已刷新 ${target.url}`)
}

/**
 * 轮询一个表达式直到它为真值。
 *
 * 验收要轮询等待，不要 sleep 一个拍脑袋的固定值：dev server 模式下脚本 UI 出现
 * 明显晚于页面 `load`（几百个模块要逐个 serve），固定 sleep 要么白等要么误判。
 */
async function waitExpression(match, expression, timeout) {
  const target = await findTarget(match, { wait: 5000 })
  if (!target) {
    throw new Error(`没有匹配 ${match} 的页面`)
  }
  const session = await attach(target)
  const value = await waitFor(
    // 导航会销毁执行上下文，evaluate 抛错是正常现象，不该中断轮询
    () => session.evaluate(expression).catch(() => null),
    { wait: timeout, interval: 300 },
  )
  session.close()
  if (!value) {
    throw new Error(`${timeout}ms 内表达式一直不为真：${expression}`)
  }
  console.log(JSON.stringify(value, null, 1))
}

/**
 * 像真人一样往页面里打字。
 *
 * 在 `Runtime.evaluate` 里调 `element.focus()` 不足以让 `Input.insertText` 落进
 * shadow root 里的 Monaco —— 文字哪儿都没去，文档悄无声息地毫无变化。真正把焦点
 * 挪过去的是一次派发出去的鼠标点击。
 */
async function type(match, text) {
  const target = await findTarget(match)
  if (!target) {
    throw new Error(`没有匹配 ${match} 的页面`)
  }
  const session = await attach(target)

  const point = await session.evaluate(`
    (() => {
      const roots = [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).map((e) => e.shadowRoot)
      const el = [document, ...roots].map((r) => r.querySelector('.monaco-editor .view-lines')).find(Boolean)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x + 40), y: Math.round(r.y + 8) }
    })()
  `)
  if (!point) {
    throw new Error('页面上找不到 Monaco 编辑器')
  }

  for (const type of ['mousePressed', 'mouseReleased']) {
    await session.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left', clickCount: 1 })
  }
  await new Promise((r) => setTimeout(r, 200))
  for (const type of ['rawKeyDown', 'keyUp']) {
    await session.send('Input.dispatchKeyEvent', { type, key: 'Home', code: 'Home', windowsVirtualKeyCode: 36, modifiers: 2 })
  }
  await session.send('Input.insertText', { text })
  session.close()
  console.log('已输入')
}

/**
 * 把这条链路的前提逐条查一遍。
 *
 * 缺哪一环，后面的命令都会以看起来无关的方式失败（「找不到安装按钮」「面板没列出
 * 任何脚本」），所以值得有一个专门说人话的入口。
 */
async function doctor() {
  const lines = []
  const hint = []

  lines.push(`✓ Node ${process.version}`)

  let version = null
  try {
    version = await (await fetch(`${endpoint}/json/version`)).json()
    lines.push(`✓ CDP 可达：${version.Browser}（${endpoint}）`)
  } catch {
    lines.push(`✗ CDP 连不上 ${endpoint}`)
    hint.push(`用 --remote-debugging-port=${PORT} 重启 Chrome，并保持它开着`)
  }

  if (version) {
    const ids = await extensionIds().catch(() => new Set())
    if (ids.has(TAMPERMONKEY_ID)) {
      lines.push(`✓ 检测到 Tampermonkey（${TAMPERMONKEY_ID}）`)
    } else if (process.env.TAMPERMONKEY_ID) {
      lines.push(`? 用环境变量指定的扩展 id：${process.env.TAMPERMONKEY_ID}`)
    } else if (ids.size > 0) {
      lines.push(`? 没看到官方 Tampermonkey，但有其他扩展：${[...ids].join(', ')}`)
      hint.push('如果装的是 Beta 版，用 TAMPERMONKEY_ID=<id> 指定')
    } else {
      lines.push('✗ 没有检测到任何扩展')
      hint.push('确认这个 Chrome 实例装了 Tampermonkey（扩展的 service worker 休眠时也可能查不到，可先打开一次扩展面板）')
    }

    const pages = (await targets()).filter((t) => t.type === 'page' && t.url.startsWith('http'))
    if (pages.length > 0) {
      lines.push(`✓ 有 ${pages.length} 个 http 页面标签（安装导航需要至少一个）`)
    } else {
      lines.push('✗ 没有普通网页标签')
      hint.push('随便打开一个 http(s) 页面，install 需要从真实页面发起 window.open')
    }
  }

  const dev = await fetch(DEV_SERVER_URL, { signal: AbortSignal.timeout(2000) }).catch(() => null)
  // 刻意不进 `hint`：hint 非空会让 doctor 以非零码退出，而在 CSP 受限的站点上不起
  // dev server、直接走 install-build 是正当选择，不该判成前提缺失。但默认路径是
  // dev server，所以措辞要指向它，而不是把两种模式说成中立的二选一。
  lines.push(dev
    ? `✓ dev server 可达：${DEV_SERVER_URL}`
    : `- dev server 未启动：${DEV_SERVER_URL}（默认路径要先跑 pnpm dev；仅在宿主页 CSP 拦住本地模块加载时才改用 install-build）`)

  const bundle = findBundle()
  lines.push(bundle ? `✓ 构建产物：${bundle.replace(ROOT, '')}` : '- 还没有构建产物（install-build 会自己构建）')

  console.log(lines.join('\n'))
  if (hint.length > 0) {
    console.log(`\n待处理：\n${hint.map((h) => `  - ${h}`).join('\n')}`)
    process.exitCode = 1
  }
}

const [command, ...rest] = process.argv.slice(2)

function flagValue(name, fallback) {
  const index = rest.indexOf(name)
  return index === -1 ? fallback : rest[index + 1]
}

// 只有被直接执行时才跑 CLI。否则测试一 import 这个文件，下面的分发就会以
// `command === undefined` 触发，打印帮助并把退出码置 1。
if (import.meta.filename === process.argv[1]) {
  try {
    if (command === 'targets') {
      for (const t of await targets()) {
        console.log(`${t.type.padEnd(16)} ${t.url.slice(0, 120)}`)
      }
    } else if (command === 'doctor') {
      await doctor()
    } else if (command === 'install') {
      await install(rest[0])
    } else if (command === 'install-build') {
      await installBuild({ build: !rest.includes('--no-build') })
    } else if (command === 'list') {
      await listScripts()
    } else if (command === 'remove') {
      const idFlag = rest.indexOf('--id')
      if (idFlag === -1 && !rest[0]) {
        throw new Error('用法：remove "<脚本名>" 或 remove --id <行 id>')
      }
      await removeScript(idFlag === -1 ? { name: rest[0] } : { id: rest[idFlag + 1] })
    } else if (command === 'cleanup') {
      await cleanup()
    } else if (command === 'toggle') {
      const desired = { on: 'Enabled', off: 'Disabled' }[rest[1]]
      if (!rest[0] || !desired) {
        throw new Error('用法：toggle "<脚本名>" <on|off>')
      }
      await toggleScript(rest[0], desired)
    } else if (command === 'open') {
      if (!rest[0]) {
        throw new Error('用法：open <url>')
      }
      await open(rest[0])
    } else if (command === 'reload') {
      if (!rest[0]) {
        throw new Error('用法：reload <url 片段>')
      }
      await reload(rest[0])
    } else if (command === 'eval') {
      const target = await findTarget(rest[0])
      if (!target) {
        throw new Error(`没有匹配 ${rest[0]} 的页面`)
      }
      const session = await attach(target)
      console.log(JSON.stringify(await session.evaluate(rest[1]), null, 1))
      session.close()
    } else if (command === 'wait') {
      if (!rest[0] || !rest[1]) {
        throw new Error('用法：wait <url 片段> "<表达式>" [--timeout <ms>]')
      }
      await waitExpression(rest[0], rest[1], Number(flagValue('--timeout', 30000)))
    } else if (command === 'type') {
      await type(rest[0], rest[1])
    } else {
      console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0])
      process.exitCode = 1
    }
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : cause)
    process.exitCode = 1
  }
}
