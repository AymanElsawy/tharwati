import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { ModuleKind, JsxEmit, transpileModule } from "typescript"

export type Node = { type: string; props: Record<string, any> }

/** Execute the real component with hook/SDK doubles, without a browser backend. */
export function componentHarness(
  file: string,
  overrides: Record<string, unknown>
) {
  const slots: unknown[] = []
  let cursor = 0
  let first = true
  const cleanups: (() => void)[] = []
  const hook = (create: () => unknown) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = create()
    return index
  }
  const react = {
    useState(initial: unknown) {
      const i = hook(() =>
        typeof initial === "function" ? initial() : initial
      )
      return [
        slots[i],
        (value: any) => {
          slots[i] = typeof value === "function" ? value(slots[i]) : value
        },
      ]
    },
    useRef(initial: unknown) {
      return slots[hook(() => ({ current: initial }))]
    },
    useCallback(fn: unknown) {
      hook(() => null)
      return fn
    },
    useEffect(fn: () => (() => void) | void) {
      hook(() => null)
      if (first) {
        const cleanup = fn()
        if (cleanup) cleanups.push(cleanup)
      }
    },
    useSyncExternalStore(_subscribe: unknown, getSnapshot: () => unknown) {
      hook(() => null)
      return getSnapshot()
    },
    useId() {
      return `field-${hook(() => null)}`
    },
  }
  const defaults = new Proxy({}, { get: (_, key) => String(key) })
  const exports: Record<string, (...args: any[]) => Node> = {}
  const source = transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
  }).outputText
  runInNewContext(source, {
    exports,
    queueMicrotask,
    console,
    require(name: string) {
      if (name === "react") return react
      if (name === "react/jsx-runtime")
        return {
          jsx: (type: string, props: Node["props"]) => ({ type, props }),
          jsxs: (type: string, props: Node["props"]) => ({ type, props }),
        }
      return overrides[name] ?? defaults
    },
    window: overrides.window,
  })
  return {
    render(name = "default", props?: unknown) {
      cursor = 0
      const result = exports[name](props)
      first = false
      return result
    },
    dispose() {
      cleanups.forEach((cleanup) => cleanup())
    },
  }
}

export function descendants(node: Node): Node[] {
  const children = [node.props?.children]
    .flat(Infinity)
    .filter((child): child is Node =>
      Boolean(child && typeof child === "object")
    )
  return [node, ...children.flatMap(descendants)]
}
