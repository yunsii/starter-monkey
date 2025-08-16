declare interface Userscript {
  (): import('type-fest').Promisable<void>
  displayName: string
  matches: string []
}
