export type RecoveryStatus = "idle" | "checking" | "valid" | "invalid" | "ended"
type Marker = "checking" | "active" | "ended"
type MarkerStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

/** Only a phase marker is persisted. Supabase remains the session owner. */
export class RecoveryLifecycle {
  private status: RecoveryStatus = "idle"
  private marker: Marker | null = null
  private readonly listeners = new Set<() => void>()
  private readonly storage: MarkerStorage
  readonly projectUrl: string
  readonly key: string

  constructor(
    storage: MarkerStorage,
    projectUrl: string,
    location?: Pick<Location, "pathname" | "hash" | "search">
  ) {
    this.storage = storage
    this.projectUrl = projectUrl
    this.key = `tharwati-recovery-v1:${new URL(projectUrl).origin}`
    const saved = storage.getItem(this.key)
    this.marker =
      saved === null
        ? null
        : saved === "ended"
          ? "ended"
          : saved === "active"
            ? "active"
            : "checking"
    this.status =
      this.marker === "ended" ? "ended" : this.marker ? "checking" : "idle"
    const params = new URLSearchParams(location?.hash.replace(/^#/, ""))
    const query = new URLSearchParams(location?.search)
    const hasCallback = [
      "access_token",
      "error",
      "error_code",
      "error_description",
      "code",
    ].some((key) => params.has(key) || query.has(key))
    if (
      (params.get("type") ?? query.get("type")) === "recovery" ||
      (location?.pathname === "/reset-password" &&
        (hasCallback || !this.marker))
    ) {
      // Written before createClient can exchange/persist an incoming session.
      this.write("checking")
      this.status = "checking"
    }
  }

  getSnapshot = (): RecoveryStatus => this.status
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  get isolatesSession() {
    return this.status !== "idle"
  }

  private set(status: RecoveryStatus) {
    if (this.status === status) return
    this.status = status
    this.listeners.forEach((listener) => listener())
  }
  private write(marker: Marker) {
    this.storage.setItem(this.key, marker)
    this.marker = marker
  }

  onAuthEvent(event: string, hasSession: boolean, recoveryOrigin = false) {
    if (event === "PASSWORD_RECOVERY" && this.marker !== "ended") {
      try {
        this.write("active")
        this.set(hasSession ? "valid" : "invalid")
      } catch {
        this.set("invalid")
      }
    } else if (
      event === "SIGNED_IN" &&
      this.marker === "active" &&
      !recoveryOrigin
    ) {
      // An in-flight ordinary login must not replace the reset target.
      try {
        this.write("checking")
      } catch {
        this.marker = "checking"
      }
      this.set("invalid")
    } else if (
      event === "SIGNED_OUT" &&
      this.marker &&
      this.marker !== "ended"
    ) {
      this.set("invalid")
    }
  }

  observeSession(token?: string) {
    if (this.marker || !hasRecoveryOrigin(token)) return
    try {
      this.write("active")
      this.set("checking")
    } catch {
      this.set("invalid")
    }
  }

  async restore(hasSession: boolean, validate: () => Promise<boolean>) {
    if (!this.isolatesSession || this.marker === "ended") return
    if (!hasSession || this.marker !== "active") {
      this.set("invalid")
      return
    }
    try {
      const valid = await validate()
      // Cancellation/completion may have happened while validation was in flight.
      if (this.marker === "active") this.set(valid ? "valid" : "invalid")
    } catch {
      if (this.marker === "active") this.set("invalid")
    }
  }

  invalidate() {
    if (this.marker && this.marker !== "ended") {
      try {
        this.write("checking")
      } catch {
        this.marker = "checking"
      }
      this.set("invalid")
    }
  }

  rejectCallback() {
    this.write("checking")
    this.set("invalid")
  }

  async finish(cleanup: () => Promise<unknown>) {
    // Keep the tombstone until an explicit successful password login/signup.
    // Even failed SDK cleanup cannot resurrect this session after navigation.
    try {
      this.write("ended")
    } catch {
      this.marker = "ended"
    }
    this.set("checking")
    try {
      await cleanup()
    } catch {
      /* password-update success stays success */
    }
    this.set("ended")
  }

  acceptNormalSession() {
    if (this.marker !== "ended") return
    this.storage.removeItem(this.key)
    this.marker = null
    this.set("idle")
  }
}

/** Recovery provenance can reconstruct an older session's missing marker.
 * Decoding only adds isolation; getUser still validates against the project. */
export function hasRecoveryOrigin(token?: string): boolean {
  try {
    const payload = token!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const claims = JSON.parse(atob(payload)) as { amr?: { method?: string }[] }
    return (
      Array.isArray(claims.amr) &&
      claims.amr.some((entry) => entry.method === "recovery")
    )
  } catch {
    return false
  }
}

/** Untrusted issuer is only an early rejection guard, never authentication. */
export function callbackMatchesProject(
  hash: string,
  projectUrl: string
): boolean {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("access_token")
  if (!token) return true // PKCE is verified by the selected project's SDK.
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const { iss } = JSON.parse(atob(payload)) as { iss?: string }
    return iss === `${projectUrl.replace(/\/$/, "")}/auth/v1`
  } catch {
    return false
  }
}
