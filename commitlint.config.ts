import type { UserConfig } from '@commitlint/types'

const config: UserConfig = {
  // ref: https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional
  // ref: https://www.conventionalcommits.org/en/v1.0.0/#summary
  extends: ['@commitlint/config-conventional'],
  // [Question] how to extend and override config-conventional settings:
  // https://github.com/conventional-changelog/commitlint/issues/2232
  parserPreset: {
    parserOpts: {
      // 支持 emoji 前缀的 headerPattern
      // 格式: ✨ feat(scope): subject 或 feat(scope): subject
      // 有 emoji 时，emoji 和 type 之间必须有空格
      //
      // 破坏性标记 `!` 也要认。原来的 pattern 里没有它，于是
      // `fix(scope)!: subject` 整个 header 匹配不上，报出来的是「type may not be
      // empty / subject may not be empty」—— 完全看不出真正的原因是那个 `!`。
      headerPattern: /^(?:([^\w\s]{1,2})\s+)?(\w+)(?:\((.*)\))?(!)?: (.*)$/,
      headerCorrespondence: ['emoji', 'type', 'scope', 'breaking', 'subject'],
      // 默认的 breakingHeaderPattern 不认 emoji 前缀，配了上面还得配这条，
      // 否则 emoji 注入之后 `!` 就不再被识别成破坏性变更
      breakingHeaderPattern: /^(?:[^\w\s]{1,2}\s+)?(\w+)(?:\((.*)\))?!: (.*)$/,
    },
  },
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
      ],
    ],
  },
}

export default config
