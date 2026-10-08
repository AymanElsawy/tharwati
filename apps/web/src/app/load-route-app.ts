// Public legal documents do not initialize Supabase or depend on auth startup.
export function loadRouteApp(pathname = window.location.pathname) {
  return /^\/(privacy|terms)\/?$/u.test(pathname)
    ? import("./PublicLegalApp")
    : import("./NormalApp")
}
