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
        if (left.name.text === 'displayName' && ts.isStringLiteral(right)) {
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

  if (displayName && includes.length > 0) {
    return { displayName, includes }
  }

  if (displayName && matches.length > 0) {
    return { displayName, matches }
  }

  throw new Error(`UserscriptConfig not found in source code, displayName: ${displayName}, matches: ${JSON.stringify(matches)}, includes: ${JSON.stringify(includes)}`)
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
