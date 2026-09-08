import { describe, expect, it } from "vitest"
import { ProfileRequestGuard } from "./profile-request-guard"

describe("ProfileRequestGuard", () => {
  it("does not allow a stale User A request to overwrite User B", () => {
    const guard = new ProfileRequestGuard("user-a")
    const userARequest = guard.begin("user-a")
    guard.setActiveUser("user-b")
    const userBRequest = guard.begin("user-b")
    expect(guard.isCurrent(userARequest)).toBe(false)
    expect(guard.isCurrent(userBRequest)).toBe(true)
  })

  it("keeps the latest current-user refresh valid", () => {
    const guard = new ProfileRequestGuard("user-a")
    const request = guard.begin("user-a")
    expect(guard.isCurrent(request)).toBe(true)
  })

  it("does not let a stale callback reactivate User A after User B is active", () => {
    const guard = new ProfileRequestGuard("user-a")
    guard.setActiveUser("user-b")
    const staleUserARefresh = guard.begin("user-a")
    const userBRefresh = guard.begin("user-b")
    expect(guard.isCurrent(staleUserARefresh)).toBe(false)
    expect(guard.isCurrent(userBRefresh)).toBe(true)
  })

  it("invalidates pending requests on unmount or effect cleanup", () => {
    const guard = new ProfileRequestGuard("user-a")
    const request = guard.begin("user-a")
    guard.invalidate()
    expect(guard.isCurrent(request)).toBe(false)
  })
})
