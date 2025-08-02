import { v4 as uuidv4 } from "uuid"

// Utility functions
export const generateUID = (): string => {
  return uuidv4()
}

export const getFirebaseStatusMessage = (): { status: "success" | "error" | "loading"; message: string } => {
  return { status: "loading", message: "Firebase initializing..." }
}

export const createParticipant = async (uid: string, consentGiven: boolean): Promise<string> => {
  console.log("Creating participant (mock):", uid)
  const participantDocId = `local_${Date.now()}`
  localStorage.setItem("participantDocId", participantDocId)
  return participantDocId
}

export const updateInfoPageEnd = async (participantDocId: string): Promise<void> => {
  console.log("Updating info page end (mock):", participantDocId)
}
