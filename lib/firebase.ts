// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app"
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  getDoc,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore"
import { v4 as uuidv4 } from "uuid"

// ==================== CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyDkYRbtCSKO8twFpdQ7gzQMYECquKbNTDI",
  authDomain: "adhd-vercel.firebaseapp.com",
  projectId: "adhd-vercel",
}

// ==================== INITIALIZATION ====================
let app: any = null
let db: any = null
let firebaseInitialized = false
let initializationError: string | null = null

if (typeof window !== "undefined") {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
    db = getFirestore(app)
    firebaseInitialized = true
    console.log("✅ Firebase initialized")
  } catch (e: any) {
    initializationError = e.message
    console.warn("⚠️ Firebase init failed:", e.message)
    db = null
    firebaseInitialized = false
  }
} else {
  console.log("🔧 Server environment detected; Firebase will initialize on client")
}

// ==================== TYPES ====================
export interface ParticipantData {
  uid: string
  // ASRS
  asrsStartTime?: Timestamp
  asrsEndTime?: Timestamp
  asrsResponses?: Record<string, string>
  asrsScore?: number
  isADHD?: boolean

  // Task
  taskStartTime?: Timestamp
  taskEndTime?: Timestamp
  totalTaskDuration?: number

  // Filters
  filtersUsed?: Array<{
    filters: Record<string, any>
    timestamp: string
    trigger: string
  }>
  finalFilters?: {
    filters: Record<string, any>
    timestamp: string
    type: "final_snapshot"
  }

  // Cart
  cartChangeLog?: Array<{
    laptopId: string | number
    action: "add" | "remove"
    timestamp: string
    attemptSequence: number
  }>
  finalCartItems?: Array<{
    laptopId: string | number
    matchedCriteria: boolean
  }>
  validationErrors?: string[]
  taskCompleted?: boolean

  // Distractions & focus
  distractionInteractions?: Array<{
    modalId: string | number
    action: string
    appearanceTimestamp: string
    dismissalTimestamp: string
    responseTime: number
    recoveryLatency: number | null
  }>
  focusEvents?: Array<{
    type: "blur" | "focus"
    timestamp: string
  }>

  // UEQ-S
  ueqSStartTime?: Timestamp
  ueqSEndTime?: Timestamp
  ueqSResponses?: Record<string, number>
  ueqSPragmaticScore?: number
  ueqSHedonicScore?: number
  ueqSTotalScore?: number

  // Summary
  distractionCount?: number
  averageRecoveryLatency?: number
  cartAttemptCount?: number

  // Meta
  updatedAt?: Timestamp
  createdAt?: Timestamp
}

// ==================== HELPERS ====================
const isFirebaseReady = () => firebaseInitialized && db
const persistLocalBackup = (collectionName: string, participantDocId: string, data: any) => {
  try {
    const existing = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    existing.push({
      collection: collectionName,
      participantDocId,
      data,
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(existing))
  } catch (e) {
    console.warn("Failed to write local backup:", e)
  }
}

export const generateUID = () => uuidv4()
export const getParticipantDocId = () => {
  return typeof window !== "undefined" ? localStorage.getItem("participantDocId") : null
}
export const getParticipantUID = () => {
  return typeof window !== "undefined" ? localStorage.getItem("participantUID") : null
}

// ==================== CORE FUNCTIONS ====================

export const createParticipant = async (uid: string): Promise<string> => {
  try {
    if (!isFirebaseReady()) throw new Error("Firestore not ready")
    const participantData: Partial<ParticipantData> = {
      uid,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    }
    const docRef = await addDoc(collection(db, "participants"), participantData)
    localStorage.setItem("participantDocId", docRef.id)
    localStorage.setItem("participantUID", uid)
    return docRef.id
  } catch (e: any) {
    console.warn("createParticipant fallback to local", e.message)
    const localId = `local_${Date.now()}_${uid.slice(0, 8)}`
    localStorage.setItem("participantDocId", localId)
    localStorage.setItem("participantUID", uid)
    persistLocalBackup("participants", localId, {
      uid,
      error: e.message,
      createdAt: new Date().toISOString(),
    })
    return localId
  }
}

export const updateASRSData = async (participantDocId: string, asrsResponses: Record<string, string>) => {
  try {
    if (!isFirebaseReady() || participantDocId.startsWith("local_")) throw new Error("Firebase unavailable")

    // scoring map
    const scoreMap: Record<string, number> = {
      never: 0,
      rarely: 1,
      sometimes: 2,
      often: 3,
      very_often: 4,
    }

    let totalScore = 0
    Object.values(asrsResponses).forEach((v) => {
      totalScore += scoreMap[v as keyof typeof scoreMap] || 0
    })
    const isADHD = totalScore >= 14

    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      asrsResponses,
      asrsScore: totalScore,
      isADHD,
      asrsEndTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (e: any) {
    console.warn("updateASRSData fallback:", e.message)
    persistLocalBackup("asrs_updates", participantDocId, { asrsResponses, error: e.message })
  }
}

export const updateTaskStart = async (participantDocId: string) => {
  try {
    if (!isFirebaseReady() || participantDocId.startsWith("local_")) throw new Error("Firebase unavailable")
    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      taskStartTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (e: any) {
    console.warn("updateTaskStart fallback:", e.message)
    persistLocalBackup("task_start_updates", participantDocId, { error: e.message })
  }
}

// ====== FILTERS ======

const normalizeFilters = (raw: Record<string, any>): Record<string, any> => {
  const normalized: Record<string, any> = {}
  for (const key of Object.keys(raw)) {
    const value = raw[key]
    if (typeof value === "number") {
      if (key.toLowerCase().includes("price")) {
        normalized[key] = Math.round(value / 50) * 50
      } else {
        normalized[key] = value
      }
    } else if (Array.isArray(value)) {
      normalized[key] = [...value].sort()
    } else {
      normalized[key] = value
    }
  }
  return normalized
}

const deepEqual = (a: any, b: any) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export const logFilterCommit = async (participantDocId: string, filters: Record<string, any>) => {
  const normalized = normalizeFilters(filters)
  const entry = {
    filters: normalized,
    timestamp: new Date().toISOString(),
    trigger: "apply_button",
  }

  try {
    if (!isFirebaseReady() || participantDocId.startsWith("local_")) throw new Error("Firebase unavailable")

    const participantRef = doc(db, "participants", participantDocId)
    // Fetch existing to dedupe
    const existingSnap = await getDoc(participantRef)
    const existing = existingSnap.exists() ? (existingSnap.data() as any).filtersUsed || [] : []
    const last = existing.length ? existing[existing.length - 1].filters : null
    if (last && deepEqual(last, normalized)) {
      // skip duplicate
      return
    }

    await updateDoc(participantRef, {
      filtersUsed: arrayUnion({
        ...entry,
        serverTime: serverTimestamp(),
      }),
      updatedAt: serverTimestamp(),
    })
  } catch (e: any) {
    console.warn("logFilterCommit fallback:", e.message)
    persistLocalBackup("filtersUsed", participantDocId, { entry, error: e.message })
  }
}

// ====== CART ======

export const logCartChange = async (
  participantDocId: string,
  laptopId: string | number,
  action: "add" | "remove",
  attemptSequence: number
) => {
  const log = {
    laptopId,
    action,
    timestamp: new Date().toISOString(),
    attemptSequence,
  }
  try {
    if (!isFirebaseReady() || participantDocId.startsWith("local_")) throw new Error("Firebase unavailable")
    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      cartChangeLog: arrayUnion(log),
      updatedAt: serverTimestamp(),
    })
  } catch (e: any) {
    console.warn("logCartChange fallback:", e.message)
    persistLocalBackup("cart_changes", participantDocId, { log, error: e.message })
  }
}

// ====== DISTRACTIONS & FOCUS ======

export const logDistractionInteraction = async (
  participantDocId: string,
  modalId: string | number,
  action: string,
  appearanceTimestamp: string,
  dismissalTimestamp: string,
  responseTime: number,
  recoveryLatency: number | null
) => {
  const entry = {
    modalId,
    action,
    appearanceTimestamp,
    dismissalTimestamp,
    responseTime,
    recoveryLatency,
  }
  try {
    if (!isFirebaseReady() || participantDocId.startsWith("local_")) throw new Error("Firebase unavailable")
    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      distractionInteractions: arrayUnion(entry),
      updatedAt: serverTimestamp(),
    })
  } catch (e: any) {
    console.warn("logDistractionInteraction fallback:", e.message)
    persistLocalBackup("distraction_interactions", participantDocId, { entry, error: e.message })
  }
}

export const logFocusEvent = async (participantDocId: string, type: "blur" | "focus") => {
  const entry = {
    type,
    timestamp: new Date().toISOString(),
  }
  try {
    if (!isFirebaseReady() || participantDocId.startsWith("local_")) throw new Error("Firebase unavailable")
    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      focusEvents: arrayUnion(entry),
      updatedAt: serverTimestamp(),
    })
  } catch (e: any) {
    console.warn("logFocusEvent fallback:", e.message)
    persistLocalBackup("focus_events", participantDocId, { entry, error: e.message })
  }
}

// ====== UEQ-S & COMPLETION ======

export const logUEQS = async (
  participantDocId: string,
  ueqSResponses: Record<string, number>,
  pragmaticScore: number,
  hedonicScore: number,
  totalScore: number
) => {
  try {
    if (!isFirebaseReady() || participantDocId.startsWith("local_")) throw new Error("Firebase unavailable")
    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      ueqSResponses,
      ueqSPragmaticScore: pragmaticScore,
      ueqSHedonicScore: hedonicScore,
      ueqSTotalScore: totalScore,
      ueqSEndTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (e: any) {
    console.warn("logUEQS fallback:", e.message)
    persistLocalBackup("ueqs_updates", participantDocId, { ueqSResponses, error: e.message })
  }
}

export const completeTask = async (
  participantDocId: string,
  finalCartItems: Array<{ laptopId: string | number; matchedCriteria: boolean }>,
  validationErrors: string[],
  filtersSnapshot: Record<string, any>,
  taskCompleted: boolean
) => {
  try {
    if (!isFirebaseReady() || participantDocId.startsWith("local_")) throw new Error("Firebase unavailable")

    const participantRef = doc(db, "participants", participantDocId)

    // Build summary fields
    await updateDoc(participantRef, {
      finalCartItems,
      validationErrors,
      taskCompleted,
      finalFilters: {
        filters: normalizeFilters(filtersSnapshot),
        timestamp: new Date().toISOString(),
        type: "final_snapshot" as const,
      },
      taskEndTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (e: any) {
    console.warn("completeTask fallback:", e.message)
    persistLocalBackup("task_completions", participantDocId, {
      finalCartItems,
      validationErrors,
      filtersSnapshot,
      taskCompleted,
      error: e.message,
    })
  }
}

// ==================== STATUS / UTIL ====================

export const checkFirebaseStatus = () => {
  return {
    initialized: firebaseInitialized,
    error: initializationError,
    firestore: !!db,
  }
}

export const getBackupData = () => {
  try {
    return JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
  } catch {
    return []
  }
}

export const getFirebaseStatusMessage = () => {
  if (!firebaseInitialized) {
    return {
      status: "error",
      message: `Firebase init failed: ${initializationError || "unknown"}. Using local fallback.`,
    }
  }
  return {
    status: "success",
    message: "Connected to Firestore successfully.",
  }
}
