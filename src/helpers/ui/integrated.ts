import { applyPosition, createMountFunctions, mountUi } from './shared'

import type { ContentScriptUi, ContentScriptUiOptions } from './types'

export function createIntegratedUi<TMounted>(
  options: IntegratedContentScriptUiOptions<TMounted>,
): IntegratedContentScriptUi<TMounted> {
  const wrapper = document.createElement(options.tag || 'div')
  wrapper.setAttribute('data-starter-monkey', '')

  let mounted: TMounted | undefined
  const mount = () => {
    applyPosition(wrapper, undefined, options)
    mountUi(wrapper, options)
    mounted = options.onMount?.(wrapper)
  }
  const remove = () => {
    options.onRemove?.(mounted)
    wrapper.replaceChildren()
    wrapper.remove()
    mounted = undefined
  }

  const mountFunctions = createMountFunctions(
    {
      mount,
      remove,
    },
    options,
  )

  return {
    get mounted() {
      return mounted
    },
    wrapper,
    ...mountFunctions,
  }
}

export interface IntegratedContentScriptUi<TMounted>
  extends ContentScriptUi<TMounted> {
  /**
   * A wrapper div that assists in positioning.
   */
  wrapper: HTMLElement
}

export type IntegratedContentScriptUiOptions<TMounted>
  = ContentScriptUiOptions<TMounted> & {
    /**
     * Tag used to create the wrapper element.
     *
     * @default "div"
     */
    tag?: string
    /**
     * Callback executed when mounting the UI. This function should create and append the UI to the
     * `wrapper` element. It is called every time `ui.mount()` is called.
     *
     * Optionally return a value that can be accessed at `ui.mounted` or in the `onRemove` callback.
     */
    onMount: (wrapper: HTMLElement) => TMounted
  }
