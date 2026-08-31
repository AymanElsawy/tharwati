import { supabase } from "../../lib/supabase"

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