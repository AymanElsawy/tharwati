import { describe, expect, it } from "vitest"

import { accountRecordsObserverOptions, observeAccountRecordsHistoryEnd } from "./account-records-infinite-scroll"

type ObserverCallback = (entries: ReadonlyArray<Pick<IntersectionObserverEntry, "isIntersecting">>) => void

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = []
  readonly observed: Element[] = []
  disconnected = false
  readonly callback: ObserverCallback
  readonly options?: IntersectionObserverInit

  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.options = options
    TestIntersectionObserver.instances.push(this)
  }

  observe(target: Element) { this.observed.push(target) }
  disconnect() { this.disconnected = true }
  fire(isIntersecting = true) { this.callback([{ isIntersecting }]) }
}

describe("Account Records infinite scroll observer", () => {
  it("triggers page 2 when the first history sentinel approaches the viewport", () => {
    TestIntersectionObserver.instances = []
    let requests = 0
    observeAccountRecordsHistoryEnd({} as Element, () => true, () => { requests += 1 }, TestIntersectionObserver)

    TestIntersectionObserver.instances[0]?.fire()
    expect(requests).toBe(1)
    expect(TestIntersectionObserver.instances[0]?.options).toEqual(accountRecordsObserverOptions)
  })

  it("re-arms the observer after an appended page when more history remains", () => {
    TestIntersectionObserver.instances = []
    let requests = 0
    const firstCleanup = observeAccountRecordsHistoryEnd({} as Element, () => true, () => { requests += 1 }, TestIntersectionObserver)
    TestIntersectionObserver.instances[0]?.fire()
    firstCleanup()
    observeAccountRecordsHistoryEnd({} as Element, () => true, () => { requests += 1 }, TestIntersectionObserver)
    TestIntersectionObserver.instances[1]?.fire()

    expect(requests).toBe(2)
    expect(TestIntersectionObserver.instances[0]?.disconnected).toBe(true)
  })

  it("does not request duplicate pages while a request is in flight", () => {
    TestIntersectionObserver.instances = []
    let requests = 0
    let isInFlight = false
    observeAccountRecordsHistoryEnd(
      {} as Element,
      () => !isInFlight,
      () => { isInFlight = true; requests += 1 },
      TestIntersectionObserver
    )

    TestIntersectionObserver.instances[0]?.fire()
    TestIntersectionObserver.instances[0]?.fire()
    expect(requests).toBe(1)
  })
})
