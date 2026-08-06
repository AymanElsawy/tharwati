import { describe, expect, it } from "vitest"
import { emptyAccountFormValues } from "@/features/accounts/types/account-form"
import { hasMeaningfulAccountChanges, mergeWatchedAccountForm } from "./account-form-state"

describe("account form state", () => {
  it("treats untouched and reverted normalized values as clean", () => { expect(hasMeaningfulAccountChanges(emptyAccountFormValues, emptyAccountFormValues)).toBe(false); expect(hasMeaningfulAccountChanges({ ...emptyAccountFormValues, name: "  " }, emptyAccountFormValues)).toBe(false) })
  it("preserves exact decimal changes beyond safe integer precision", () => { expect(hasMeaningfulAccountChanges({ ...emptyAccountFormValues, openingBalance: "9007199254740993.01" }, emptyAccountFormValues)).toBe(true) })
  it("normalizes the partial watched shape emitted while a successful form unmounts", () => { const merged = mergeWatchedAccountForm({ name: "Created" }, emptyAccountFormValues); expect(() => hasMeaningfulAccountChanges(merged, emptyAccountFormValues)).not.toThrow(); expect(merged.openingBalance).toBe("0") })
})
