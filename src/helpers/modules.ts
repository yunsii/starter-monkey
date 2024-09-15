export function interopDefault<T>(module: T) {
  const internalModule = module as any
  if ('default' in internalModule) {
    return internalModule.default as T
  }
  return internalModule as T
}
