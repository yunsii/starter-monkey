import { readFileSync } from 'node:fs'

import ts from 'typescript'
import { glob } from 'zx'

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
  let includes: (string | RegExp)[] = []

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
          includes = right.elements.map((element) => {
            if (ts.isStringLiteral(element)) {
              return element.text
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

  // `id` 是配置的存储命名空间，含 `.` 或 `@` 会破坏键结构，反解不回来时表现为
  // 「配置改了不生效」，所以在构建期就拦下
  if (id && !/^[\w-]+$/.test(id)) {
    throw new Error(`Script.id 只能包含字母、数字、下划线和连字符，收到：${JSON.stringify(id)}`)
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
