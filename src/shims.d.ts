interface UserscriptFunction {
  (): import('type-fest').Promisable<void>
}

interface UserscriptConfigBase {
  /**
   * 功能的稳定标识，用作配置的存储命名空间。
   *
   * 必填且**不可变**：改了它，这个功能的基准配置和所有站点覆盖会一起变成孤儿。
   * 想改显示名称请改 `displayName` —— 那个只影响显示，改了没有副作用。
   *
   * 只能包含字母、数字、下划线和连字符（含 `.` 或 `@` 会破坏存储键结构）。
   */
  id: string
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
