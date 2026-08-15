/* eslint-disable react-refresh/only-export-components */
import { createContext } from '@/helpers/react/context'

export interface MountContext {
  uiContainer: HTMLElement
  shadow: ShadowRoot
  shadowHost: HTMLElement
  /**
   * React 树旁边的一个空容器，专门给组件库挂弹层（Popover / Tooltip / Select 等）用。
   *
   * 这类组件默认把弹层 portal 到 `document.body`，一旦出了 shadow root 就拿不到里面的样式，
   * 表现为弹层「裸奔」。把它传给组件库的容器参数即可：antd `getPopupContainer`、
   * Radix / shadcn 的 `container`、MUI 的 `container`……
   *
   * 单独开一个容器而不是直接用 `uiContainer`，是为了让弹层始终排在 React 树之后，
   * 不会被 React 的 DOM diff 影响，也不会和应用节点抢层叠顺序。
   */
  popupContainer: HTMLElement
}

// MountContext provider and hook. Name chosen to surface clear error messages when used
// outside of a provider: 'MountContext'.
export const [MountContextProvider, useMountContext] = createContext<MountContext>(
  'MountContext',
)

export default MountContextProvider
