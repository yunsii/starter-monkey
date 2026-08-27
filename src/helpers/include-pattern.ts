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
 * 所以修 `.some()` 是必要但不充分的，必须连这里一起修。
 */
export function compileIncludePattern(item: string | RegExp): RegExp {
  if (item instanceof RegExp) {
    return item
  }

  const delimited = /^\/(.+)\/([a-z]*)$/.exec(item)

  if (delimited) {
    return new RegExp(delimited[1], delimited[2])
  }

  // 不带定界符时按裸正则编译。Tampermonkey 在这种形式下走的是**通配符**语义
  // （`*` 匹配任意串），运行时这一侧没有实现它 —— 两侧语义不一致会以「装上了却不执行」
  // 的形式出现，很难查。新增 include 一律写成正则字面量或 `/.../` 字符串。
  return new RegExp(item)
}

/** 当前地址是否命中任意一条 `includes`。 */
export function matchesInclude(items: readonly (string | RegExp)[], href: string): boolean {
  return items.some((item) => compileIncludePattern(item).test(href))
}
