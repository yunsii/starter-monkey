export interface ContentScriptUi<TMounted> extends MountFunctions {
  mounted: TMounted | undefined
}

export type ContentScriptUiOptions<TMounted> = ContentScriptPositioningOptions
  & ContentScriptAnchoredOptions & {
    /**
     * Callback called before the UI is removed from the webpage. Use to cleanup your UI, like
     * unmounting your Vue or React apps.
     *
     * Note that this callback is called only when `ui.remove` is called - that means it is
     * not called automatically when the anchor is removed, unless you use `autoMount`.
     */
    onRemove?: (mounted: TMounted | undefined) => void
  }

export type ContentScriptOverlayAlignment
  = | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'

/**
 * ![Visualization of different append modes](https://wxt.dev/content-script-ui-append.png)
 */
export type ContentScriptAppendMode
  = | 'last'
    | 'first'
    | 'replace'
    | 'before'
    | 'after'
    | ((anchor: Element, ui: Element) => void)

export interface ContentScriptInlinePositioningOptions {
  position: 'inline'
}

export interface ContentScriptOverlayPositioningOptions {
  position: 'overlay'
  /**
   * The `z-index` used on the `wrapper` element. Defaults to `2147483647` so the UI renders above
   * page content.
   */
  zIndex?: number
  /**
   * When using `type: "overlay"`, the mounted element is 0px by 0px in size. Alignment specifies
   * which corner is aligned with that 0x0 pixel space.
   *
   * ![Visualization of alignment options](https://wxt.dev/content-script-ui-alignment.png)
   *
   * @default "top-left"
   */
  alignment?: ContentScriptOverlayAlignment
}

export interface ContentScriptModalPositioningOptions {
  position: 'modal'
  /**
   * The `z-index` used on the `shadowHost`. Defaults to `2147483647` so the UI renders above
   * page content.
   */
  zIndex?: number
}

export interface ContentScriptDetachedPositioningOptions {
  position: 'detached'
  /**
   * The `z-index` used on the `shadowHost`. Defaults to `2147483647` so the UI renders above
   * page content.
   *
   * The host is `position: fixed`, which creates a stacking context — a `z-index` written on the
   * content inside cannot escape it, so this is the only value that decides whether the page can
   * cover your UI.
   */
  zIndex?: number
}

/**
 *  Choose between `"inline"`, `"overlay"`, `"modal"`, or `"detached"` positions.
 *
 * - `"detached"` — The shadow host is taken out of the document flow with zero dimensions.
 *   No positioning is applied to the inner content. Use when your UI handles its own
 *   positioning entirely (e.g. fixed buttons, modals, drawers). Unlike `"modal"`, the host does
 *   not blanket the page, so it is safe to leave mounted permanently.
 *
 *   Two constraints come with it:
 *
 *   1. The content must position itself with `position: fixed`. The host is `0x0` with
 *      `overflow: hidden` and is the containing block for absolutely positioned descendants, so
 *      `position: absolute` content collapses to zero size and gets clipped away. `fixed`
 *      descendants resolve against the viewport and escape the clip.
 *   2. `position: fixed` only resolves against the viewport while no ancestor of the host
 *      establishes a fixed containing block (`transform`, `filter`, `backdrop-filter`,
 *      `will-change`, `contain`). Keep `anchor` on `body` / `documentElement` rather than deep
 *      inside page markup you do not control.
 */
export type ContentScriptPositioningOptions
  = | ContentScriptInlinePositioningOptions
    | ContentScriptOverlayPositioningOptions
    | ContentScriptModalPositioningOptions
    | ContentScriptDetachedPositioningOptions

export interface ContentScriptAnchoredOptions {
  /**
   * A CSS selector, XPath expression, element, or function that returns one of the three. Along with `append`, the
   * `anchor` dictates where in the page the UI will be added.
   */
  anchor?:
    | string
    | Element
    | null
    | undefined
    | (() => string | Element | null | undefined)
  /**
   * In combination with `anchor`, decide how to add the UI to the DOM.
   *
   * - `"last"` (default) - Add the UI as the last child of the `anchor` element
   * - `"first"` - Add the UI as the first child of the `anchor` element
   * - `"replace"` - Replace the `anchor` element with the UI.
   * - `"before"` - Add the UI as the sibling before the `anchor` element
   * - `"after"` - Add the UI as the sibling after the `anchor` element
   * - `(anchor, ui) => void` - Customizable function that let's you add the UI to the DOM
   */
  append?: ContentScriptAppendMode | ((anchor: Element, ui: Element) => void)
}

export interface BaseMountFunctions {
  /**
   * Function that mounts or remounts the UI on the page.
   */
  mount: () => void

  /**
   * Function that removes the UI from the webpage.
   */
  remove: () => void
}

export interface MountFunctions extends BaseMountFunctions {
  /**
   * Call `ui.autoMount()` to automatically mount and remove the UI as the anchor is dynamically added/removed by the webpage.
   */
  autoMount: (options?: AutoMountOptions) => void
}

export interface AutoMountOptions {
  /**
   * When true, only mount and unmount a UI once.
   */
  once?: boolean
  /**
   * The callback triggered when `StopAutoMount` is called.
   */
  onStop?: () => void
}
export type StopAutoMount = () => void
export interface AutoMount {
  /**
   * Stop watching the anchor element for changes, but keep the UI mounted.
   */
  stopAutoMount: StopAutoMount
}
