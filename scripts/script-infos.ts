import { readFileSync } from 'node:fs'

import ts from 'typescript'
import { glob } from 'zx'

interface ScriptInfo {
  displayName: string
  matches: string[]
}

function parseScriptInfo(sourceCode: string): ScriptInfo {
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

  if (displayName && matches.length > 0) {
    return { displayName, matches }
  }

  throw new Error('ScriptInfo not found in source code')
}

export async function getScriptInfos(): Promise<ScriptInfo[]> {
  const reactUserscriptPaths = await glob('src/scripts/*/*/index.tsx')

  const result = await Promise.all(reactUserscriptPaths.map(async (item): Promise<ScriptInfo> => {
    const sourceCode = readFileSync(item, 'utf-8')
    return parseScriptInfo(sourceCode)
  }))

  return result
}

export function printScriptInfos(scriptInfos: ScriptInfo[]): void {
  console.log('🐒 Userscript Configuration:')
  scriptInfos.forEach((script, index) => {
    const isLast = index === scriptInfos.length - 1
    const treePrefix = isLast ? '└── ' : '├── '
    const childPrefix = isLast ? '    ' : '│   '

    console.log(`${treePrefix}⚡ ${script.displayName}`)
    script.matches.forEach((match, matchIndex) => {
      const isLastMatch = matchIndex === script.matches.length - 1
      const matchTreePrefix = isLastMatch ? '└── ' : '├── '
      console.log(`${childPrefix}${matchTreePrefix}🎯 ${match}`)
    })

    // 添加空行分隔不同脚本，除了最后一个
    if (!isLast) {
      console.log(`│`)
    }
  })
}
