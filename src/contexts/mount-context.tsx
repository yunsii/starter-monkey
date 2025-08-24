/* eslint-disable react-refresh/only-export-components */
import { createContext } from '@/helpers/react/context'

export interface MountContext {
  uiContainer: HTMLElement
  shadow: ShadowRoot
  shadowHost: HTMLElement
}

// MountContext provider and hook. Name chosen to surface clear error messages when used
// outside of a provider: 'MountContext'.
export const [MountContextProvider, useMountContext] = createContext<MountContext>(
  'MountContext',
)

export default MountContextProvider
