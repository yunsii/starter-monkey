/**
 * `Script.includes` 的模式编译。
 *
 * 这些值有两个消费方，形式要求不同，是这里唯一的复杂度来源：
 *
 * - **构建期**：`scripts/script-infos.ts` 静态解析出来交给 vite-plugin-monkey 写进
 *   `@include` 元数据。Tampermonkey 用带 `/.../` 定界符的形式区分「正则」和「通配符」。
 * - **运行时**：`helpers/scripts.ts` 拿它判断当前页面是否命中。
 *
 * 运行时那一侧曾经写成 `new RegExp(item).test(`/${href}/`)`，两处独立的错叠在一起：
 *
 * 1. **被测字符串被包了一层斜杠**。`^` 只在字符串开头为真，而开头被那个 `/` 占了 ——
 *    于是任何锚定 `^` 的模式永远不命中，无论 `includes` 里放的是 RegExp 字面量还是字符串。
 *    只有不带锚点的模式（如裸 `example`）会碰巧能用。
 * 2. `includes` 写成带定界符的**字符串**时（类型允许），`new RegExp(item)` 会把定界符
 *    也编进模式，模式变成「先吃掉一个 `/`，再断言字符串开头」，再叠一层必然失败。
 *
 * 这个错长期没暴露，是因为它被上一层的 `.map()` 掩盖着：`map` 返回 `boolean[]`，
 * 空数组在 JS 里是真值，于是调用方的 `filter((item) => item.matched)` 永远为真，
 * 「一个都不命中」表现成了「每个注入页面都命中」。两个错误的净效果看起来像能用，
 * 只有把 `.map()` 改成 `.some()` 之后才会露出来：脚本一个页面都不再执行。
 *
 * 这个模块**不依赖任何浏览器 / GM API**，`node --test` 直接加载它。要加日志请加在调用方
 * （`helpers/scripts.ts`），不要在这里 import `logger` —— 那会把 `import.meta.env` 拖进来。
 */

/**
 * `/pattern/flags` 形式。类型上 `IncludePattern` 已经挡掉了裸字符串，这里是运行时的第二道：
 * 类型能被 `as` 绕过，旧构建产物里也可能留着不合规的值。
 */
const DELIMITED_PATTERN = /^\/(.+)\/([a-z]*)$/

/**
 * `g` / `y` 会让 `test()` 推进 `lastIndex`，而 `includes` 是模块级字面量数组、RegExp 实例
 * 跨调用共享，`getUserscripts()` 又会被调用多次（`main.ts` 一次，之后每次打开设置面板再一次）。
 * 于是同一个页面第一次命中、第二次不命中：脚本明明执行了，设置面板却显示「当前页面未生效」，
 * 关掉再开又好了。这两个 flag 对「是否命中」本来也没有意义，直接剥掉。
 */
function withoutStatefulFlags(flags: string): string {
  return flags.replaceAll(/[gy]/g, '')
}

export function compileIncludePattern(item: string | RegExp): RegExp {
  if (item instanceof RegExp) {
    const flags = withoutStatefulFlags(item.flags)
    return flags === item.flags ? item : new RegExp(item.source, flags)
  }

  const delimited = DELIMITED_PATTERN.exec(item)

  // 不带定界符时**不再**按裸正则编译。Tampermonkey 在这种形式下走的是**通配符**语义
  // （`*` 匹配任意串），按正则读语义会跑偏，而且偏的方向不只是「装上了却不执行」：
  // `https://example.com/*` 当正则读时 `.` 是任意字符、`/*` 是零或多个斜杠，于是
  // `https://example.community/x` 也命中。产物是单个 bundle、按所有脚本 pattern 的并集
  // 注入，所以只要别的脚本把 bundle 带到了那个页面，这条 include 就会在 Tampermonkey
  // 本来不会注入的宿主上执行 —— 宁可报错，也不要在错的域名上跑。
  if (!delimited) {
    throw new Error(
      `includes 里的字符串必须写成带定界符的 /pattern/flags 形式，收到：${JSON.stringify(item)}\n`
      + '提示：通配符形式（如 `https://example.com/*`）运行时没有实现，改写成正则字面量或 `/.../` 字符串',
    )
  }

  return new RegExp(delimited[1], withoutStatefulFlags(delimited[2]))
}

/**
 * 当前地址是否命中任意一条 `includes`。
 *
 * 模式非法（定界符缺失、flags 写错）时**抛出**，不静默当成不命中：怎么降级是调用方的事，
 * `helpers/scripts.ts` 会把它收敛成「这个脚本不命中」并打一条 warn。
 */
export function matchesInclude(items: readonly (string | RegExp)[], href: string): boolean {
  return items.some((item) => compileIncludePattern(item).test(href))
}
