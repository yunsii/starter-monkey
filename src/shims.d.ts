interface UserscriptFunction {
  (): import('type-fest').Promisable<void>
}

interface UserscriptConfigBase {
  displayName: string
}

interface UserscriptConfigWithMatches extends UserscriptConfigBase {
  matches: string[]
}
interface UserscriptConfigWithIncludes extends UserscriptConfigBase {
  includes: (string | RegExp)[]
}

interface UserscriptWithMatches extends UserscriptFunction, UserscriptConfigWithMatches {}
interface UserscriptWithIncludes extends UserscriptFunction, UserscriptConfigWithIncludes {}

declare type UserscriptConfig = UserscriptConfigWithMatches | UserscriptConfigWithIncludes
declare type Userscript = UserscriptWithMatches | UserscriptWithIncludes
