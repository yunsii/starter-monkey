import { fs, glob } from 'zx'

export async function getAllMatches() {
  const reactUserscriptPaths = await glob('src/scripts/*/index.tsx')

  const result = await Promise.all(reactUserscriptPaths.map(async (item) => {
    const content = await fs.readFile(item, 'utf-8')
    const matchArray = /matches[ \n]*=[ \n]*(\[.*\])/.exec(content)
    if (!matchArray) {
      return []
    }
    return JSON.parse(matchArray[1].replace(/'/g, '"')) as string[]
  }))

  return result.flat()
}
