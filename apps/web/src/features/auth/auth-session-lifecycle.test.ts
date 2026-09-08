import type { Session } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { canPreserveAuthenticatedTree } from "./auth-session-lifecycle"

const session = (id: string) => ({ user: { id } }) as Session

describe("canPreserveAuthenticatedTree", () => {
  it("preserves an open workflow for a refresh of the same user", () => {
    expect(canPreserveAuthenticatedTree("user-a", session("user-a"))).toBe(true)
  })

  it("reconciles a changed or signed-out user", () => {
    expect(canPreserveAuthenticatedTree("user-a", session("user-b"))).toBe(false)
    expect(canPreserveAuthenticatedTree("user-a", null)).toBe(false)
  })
})
