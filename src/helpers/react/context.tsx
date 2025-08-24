import * as React from 'react'

/**
 * 创建 context
 * @see https://github.com/radix-ui/primitives/blob/main/packages/react/context/src/create-context.tsx
 */
export function createContext<ContextValueType extends object | null>(
  rootComponentName: string,
  defaultContext?: ContextValueType,
) {
  const Context = React.createContext<ContextValueType | undefined>(
    defaultContext,
  )

  const Provider = (props: React.PropsWithChildren<ContextValueType>) => {
    const { children, ...context } = props
    // Only re-memoize when prop values change
    const value = React.useMemo(
      () => context,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(context),
    ) as ContextValueType

    return <Context.Provider value={value}>{children}</Context.Provider>
  }

  function useContext() {
    const context = React.useContext(Context)
    if (context) {
      return context
    }
    if (defaultContext !== undefined) {
      return defaultContext
    }

    // if a defaultContext wasn't specified, it's a required context.
    throw new Error(
      `the component must be used within \`${rootComponentName}\``,
    )
  }

  return [Provider, useContext] as const
}
