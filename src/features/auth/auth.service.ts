import { supabase } from "../../lib/supabase"

export const PASSWORD_UPDATE_SESSION_ERROR =
  "This reset link is invalid or has expired. Request a new reset link."
export const PASSWORD_UPDATE_GENERIC_ERROR =
  "We couldn't update your password. Please try again."
export const PASSWORD_UPDATE_WEAK_ERROR =
  "Your password must meet the listed requirements."
export const PASSWORD_MIN_LENGTH = 12

type AuthErrorLike = Error & { code?: string }

export function isWeakPasswordError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as AuthErrorLike).code === "weak_password"
  )
}

export function meetsPasswordRequirements(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  )
}

/** Maps recovery failures without exposing unrelated backend details. */
export function getPasswordUpdateErrorMessage(error: unknown): string {
  if (isWeakPasswordError(error)) {
    return PASSWORD_UPDATE_WEAK_ERROR
  }

  if (error instanceof Error && error.name === "AuthSessionMissingError") {
    return PASSWORD_UPDATE_SESSION_ERROR
  }

  return PASSWORD_UPDATE_GENERIC_ERROR
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

/**
 * Sends a password-recovery email. The link returns the user to
 * `${origin}/reset-password`, where `onAuthStateChange` fires a
 * `PASSWORD_RECOVERY` event and the app shows the reset form.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })

  if (error) {
    throw error
  }
}

/** Completes a recovery: sets a new password for the currently recovered session. */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    throw error
  }
}
