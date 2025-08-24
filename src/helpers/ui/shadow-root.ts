import { createIsolatedElement } from '@webext-core/isolated-element'

import { applyPosition, createMountFunctions, mountUi } from './shared'
import { splitShadowRootCss } from './split-shadow-root-css'

import type { ContentScriptUi, ContentScriptUiOptions } from './types'

export type ShadowRootUi<TMounted = unknown> = Awaited<ReturnType<typeof createShadowRootUi<TMounted>>>

export async function createShadowRootUi<TMounted>(
  options: ShadowRootContentScriptUiOptions<TMounted>,
): Promise<ShadowRootContentScriptUi<TMounted>> {
  const instanceId = Math.random().toString(36).substring(2, 15)
  const css: string[] = []

  if (options.css) {
    css.push(options.css)
  }

  // Some rules must be applied outside the shadow root, so split the CSS apart
  const { shadowCss, documentCss } = splitShadowRootCss(css.join('\n').trim())

  const {
    isolatedElement: uiContainer,
    parentElement: shadowHost,
    shadow,
  } = await createIsolatedElement({
    name: options.name,
    css: {
      textContent: shadowCss,
    },
    mode: options.mode ?? 'open',
    isolateEvents: options.isolateEvents,
  })
  shadowHost.setAttribute('data-monkey-shadow-root', '')

  let mounted: TMounted | undefined

  const mount = () => {
    // Add shadow root element to DOM
    mountUi(shadowHost, options)
    applyPosition(shadowHost, shadow.querySelector('html'), options)

    // Add document CSS
    if (
      documentCss
      && !document.querySelector(
        `style[data-monkey-shadow-root-document-styles="${instanceId}"]`,
      )
    ) {
      const style = document.createElement('style')
      style.textContent = documentCss
      style.setAttribute('data-monkey-shadow-root-document-styles', instanceId);
      (document.head ?? document.body).append(style)
    }

    // Mount UI inside shadow root
    mounted = options.onMount(uiContainer, shadow, shadowHost)
  }

  const remove = () => {
    // Cleanup mounted state
    options.onRemove?.(mounted)

    // Detach shadow root from DOM
    shadowHost.remove()

    // Remove document CSS
    const documentStyle = document.querySelector(
      `style[data-monkey-shadow-root-document-styles="${instanceId}"]`,
    )
    documentStyle?.remove()

    // Remove children from uiContainer
    while (uiContainer.lastChild) {
      uiContainer.removeChild(uiContainer.lastChild)
    }

    // Clear mounted value
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
    shadow,
    shadowHost,
    uiContainer,
    ...mountFunctions,
    get mounted() {
      return mounted
    },
  }
}

export interface ShadowRootContentScriptUi<TMounted>
  extends ContentScriptUi<TMounted> {
  /**
   * The `HTMLElement` hosting the shadow root used to isolate the UI's styles. This is the element
   * that get's added to the DOM. This element's style is not isolated from the webpage.
   */
  shadowHost: HTMLElement
  /**
   * The container element inside the `ShadowRoot` whose styles are isolated. The UI is mounted
   * inside this `HTMLElement`.
   */
  uiContainer: HTMLElement
  /**
   * The shadow root performing the isolation.
   */
  shadow: ShadowRoot
}

export type ShadowRootContentScriptUiOptions<TMounted>
  = ContentScriptUiOptions<TMounted> & {
    /**
     * The name of the custom component used to host the ShadowRoot. Must be kebab-case.
     */
    name: string
    /**
     * Custom CSS text to apply to the UI. If your content script imports/generates CSS and you've
     * set `cssInjectionMode: "ui"`, the imported CSS will be included automatically. You do not need
     * to pass those styles in here. This is for any additional styles not in the imported CSS.
     */
    css?: string
    /**
     * ShadowRoot's mode.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/mode
     * @default "open"
     */
    mode?: 'open' | 'closed'
    /**
     * When enabled, `event.stopPropagation` will be called on events trying to bubble out of the
     * shadow root.
     *
     * - Set to `true` to stop the propagation of a default set of events,
     *   `["keyup", "keydown", "keypress"]`
     * - Set to an array of event names to stop the propagation of a custom list of events
     */
    isolateEvents?: boolean | string[]
    /**
     * Callback executed when mounting the UI. This function should create and append the UI to the
     * `uiContainer` element. It is called every time `ui.mount()` is called.
     *
     * Optionally return a value that can be accessed at `ui.mounted` or in the `onRemove` callback.
     */
    onMount: (
      uiContainer: HTMLElement,
      shadow: ShadowRoot,
      shadowHost: HTMLElement,
    ) => TMounted
  }
