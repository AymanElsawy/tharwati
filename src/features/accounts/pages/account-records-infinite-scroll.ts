export const accountRecordsObserverOptions: IntersectionObserverInit = {
  root: null,
  rootMargin: "240px",
}

type HistoryObserver = Pick<IntersectionObserver, "observe" | "disconnect">
type HistoryObserverCallback = (entries: ReadonlyArray<Pick<IntersectionObserverEntry, "isIntersecting">>) => void

type ObserverFactory = new (
  callback: HistoryObserverCallback,
  options?: IntersectionObserverInit
) => HistoryObserver

/** Observes the current history sentinel and requests at most the next eligible page. */
export function observeAccountRecordsHistoryEnd(
  target: Element,
  canLoadNextPage: () => boolean,
  onLoadNextPage: () => void,
  Observer: ObserverFactory = IntersectionObserver
) {
  const observer = new Observer((entries) => {
    if (entries.some((entry) => entry.isIntersecting) && canLoadNextPage()) {
      onLoadNextPage()
    }
  }, accountRecordsObserverOptions)

  observer.observe(target)
  return () => observer.disconnect()
}
