export interface DeleteAccountFlow {
  step: "closed" | "password" | "confirmation"
  password: string
  confirmation: string
}

export const closedDeleteAccountFlow: DeleteAccountFlow = { step: "closed", password: "", confirmation: "" }
export const openDeleteAccountFlow = (): DeleteAccountFlow => ({ step: "password", password: "", confirmation: "" })
export const confirmReauthentication = (password: string): DeleteAccountFlow => ({ step: "confirmation", password, confirmation: "" })
export const canPermanentlyDelete = (flow: DeleteAccountFlow, email: string) => flow.step === "confirmation" && flow.confirmation === email
export const resetDeleteAccountFlow = (): DeleteAccountFlow => ({ ...closedDeleteAccountFlow })
