import { readFileSync } from 'node:fs'

import ts from 'typescript'
import { glob } from 'zx'

import { CUSTOM_ELEMENT_NAME_PATTERN } from '../src/helpers/namespace.ts'

/**
 * `includes` 里的字符串必须带 `/.../` 定界符 —— 与 `src/helpers/include-pattern.ts` 的运行时
 * 编译共用同一个约定（那边是运行时兜底，这边让它在 `pnpm build` 就报出来）。
 *
 * 无定界符的形式在 Tampermonkey 那边走**通配符**语义，运行时却按正则编译，两侧不一致：
 * `https://example.com/*` 当正则读时 `.` 是任意字符、`/*` 是零或多个斜杠，`example.community`
 * 也会命中。产物是单个 bundle、按所有 pattern 的并集注入，所以这条 include 可能在
 * Tampermonkey 本来不会注入的宿主上执行。类型上 `IncludePattern` 已经挡了一道，这里防的是
 * 类型被 `as` 绕过、或脚本源码根本没过 typecheck 就直接 build 的情况。
 */
function parseIncludeString(text: string): IncludePattern {
  const delimited = /^\/(.+)\/([a-z]*)$/.exec(text)

  if (!delimited) {
    throw new Error(
      `includes 里的字符串必须写成带定界符的 /pattern/flags 形式，收到：${JSON.stringify(text)}\n`
      + '提示：通配符形式（如 `https://example.com/*`）运行时没有实现，改写成正则字面量或 `/.../` 字符串',
    )
  }

  // 试编译一次：非法 flags（`/foo/bar`）和非法模式（`*` 开头）在这里就暴露，
  // 而不是等到运行时被当作「这个脚本不命中」静默跳过。
  const compiled = new RegExp(delimited[1], delimited[2])

  return compiled.toString() as IncludePattern
}

function parseScriptInfo(sourceCode: string): UserscriptConfig {
  // 创建 TypeScript AST
  const sourceFile = ts.createSourceFile(
    'temp.tsx',
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  let id: string | null = null
  let displayName: string | null = null
  let matches: string[] = []
  let includes: IncludePattern[] = []

  function visit(node: ts.Node) {
    // 查找 Script.displayName = '...' 形式的赋值
    if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)) {
      const { left, right, operatorToken } = node.expression

      if (operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(left)
        && ts.isIdentifier(left.expression)
        && left.expression.text === 'Script') {
        if (left.name.text === 'id' && ts.isStringLiteral(right)) {
          id = right.text
        } else if (left.name.text === 'displayName' && ts.isStringLiteral(right)) {
          displayName = right.text
        } else if (left.name.text === 'includes' && ts.isArrayLiteralExpression(right)) {
          includes = right.elements.map((element): IncludePattern => {
            if (ts.isStringLiteral(element)) {
              return parseIncludeString(element.text)
            } else if (ts.isRegularExpressionLiteral(element)) {
              const regexText = element.text
              const match = regexText.match(/^\/(.*)\/([a-z]*)$/)
              if (match) {
                return new RegExp(match[1], match[2])
              }
            }
            throw new Error('Invalid includes element')
          })
        } else if (left.name.text === 'matches' && ts.isArrayLiteralExpression(right)) {
          matches = right.elements
            .filter(ts.isStringLiteral)
            .map((element) => element.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  // `id` 有两个用途，取更严的那个：
  //
  // 1. 配置的存储命名空间 —— 含 `.` 或 `@` 会破坏键结构，反解不回来时表现为「配置改了不生效」。
  // 2. **自定义元素名** —— `src/scripts/v2ex/demo/index.tsx` 就是 `name: Script.id`。
  //    这一条严得多：必须小写字母开头、必须含连字符，否则 `customElements.define` 抛
  //    `SyntaxError`，整个功能的 UI 直接不出现。旧的 `/^[\w-]+$/` 放行了 `mydemo`、
  //    `MyDemo`、`my_demo` 这三种，它们都过不了运行时。
  //
  // 规则跟 `NAMESPACE` 共用一处，别在这里另写一遍。
  if (id && !CUSTOM_ELEMENT_NAME_PATTERN.test(id)) {
    throw new Error(
      `Script.id 只能是小写字母、数字和连字符，且必须含至少一个连字符，收到：${JSON.stringify(id)}\n`
      + '提示：它会被当作自定义元素名使用（`createShadowRootUi({ name: Script.id })`），'
      + '大写、下划线或没有连字符都会让 customElements.define 抛 SyntaxError',
    )
  }

  if (id && displayName && includes.length > 0) {
    return { id, displayName, includes }
  }

  if (id && displayName && matches.length > 0) {
    return { id, displayName, matches }
  }

  // 这些属性是构建期用 AST **静态解析**的（不执行代码），所以右值必须是字面量。
  // 写成 `Script.id = SCRIPT_ID` 这样引用常量，解析到的就是 null —— 报错里点明这一点，
  // 否则只看到「not found」会去怀疑是不是漏写了。
  throw new Error(
    `UserscriptConfig not found in source code, id: ${id}, displayName: ${displayName}, matches: ${JSON.stringify(matches)}, includes: ${JSON.stringify(includes)}\n`
    + '提示：id / displayName / matches / includes 的右值必须是字面量，不能引用常量或表达式',
  )
}

export async function getScriptInfos(): Promise<UserscriptConfig[]> {
  const reactUserscriptPaths = await glob('src/scripts/*/*/index.tsx')

  const result = await Promise.all(reactUserscriptPaths.map(async (item): Promise<UserscriptConfig> => {
    console.log('Reading script info from:', item)
    const sourceCode = readFileSync(item, 'utf-8')
    return parseScriptInfo(sourceCode)
  }))

  return result
}

export function printScriptInfos(scriptInfos: UserscriptConfig[]): void {
  console.log('🐒 Userscript Configuration:')
  scriptInfos.forEach((script, index) => {
    const isLast = index === scriptInfos.length - 1
    const treePrefix = isLast ? '└── ' : '├── '
    const childPrefix = isLast ? '    ' : '│   '

    console.log(`${treePrefix}⚡ ${script.displayName}`)
    if ('includes' in script) {
      script.includes.forEach((include, includeIndex) => {
        const isLastInclude = includeIndex === script.includes!.length - 1
        const includeTreePrefix = isLastInclude ? '└── ' : '├── '
        console.log(`${childPrefix}${includeTreePrefix} ${include.toString()}`)
      })
    } else if ('matches' in script) {
      script.matches.forEach((match, matchIndex) => {
        const isLastMatch = matchIndex === script.matches.length - 1
        const matchTreePrefix = isLastMatch ? '└── ' : '├── '
        console.log(`${childPrefix}${matchTreePrefix} ${match}`)
      })
    }

    // 添加空行分隔不同脚本，除了最后一个
    if (!isLast) {
      console.log(`│`)
    }
  })
}
