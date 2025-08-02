// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app"
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  getDocs,
  query,
  type Timestamp,
} from "firebase/firestore"
import { getAnalytics } from "firebase/analytics"
import { v4 as uuidv4 } from "uuid"

// ====================================================================================================
// IMPORTANT: FIREBASE FIRESTORE SETUP REQUIRED!
// If you are seeing "Service firestore is not available" or "Firebase not initialized for data storage" errors,
// you MUST ensure Firestore is correctly set up and accessible in your Firebase project console.
//
// 1. ENABLE FIRESTORE DATABASE:
//    - Go to Firebase Console (console.firebase.google.com)
//    - Select your project: 'adhd-study' (based on your new config)
//    - In the left navigation, under 'Build', click 'Firestore Database'.
//    - If prompted, click 'Create database' and follow the steps (choose production or test mode, select location).
//
// 2. SET FIRESTORE SECURITY RULES (for Development/Testing):
//    - In the Firestore Database section, go to the 'Rules' tab.
//    - Replace your existing rules with the following to allow read/write access for development:
//      \`\`\`
//      rules_version = '2';
//      service cloud.firestore {
//        match /databases/{database}/documents {
//          match /{document=**} {
//            allow read, write: if true; // This is CRUCIAL for development access
//          }
//        }
//      }
//      \`\`\`
//    - Click 'Publish' to apply the changes.
//
// WARNING: 'allow read, write: if true;' is INSECURE for production. Implement proper authentication
// and authorization rules before deploying to a live environment.
// ====================================================================================================

// Your new Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAldIIuYdz3l3R0sQ7g1pQhiLoXeHJ6QkI",
  authDomain: "adhd-study.firebaseapp.com",
  projectId: "adhd-study",
  storageBucket: "adhd-study.appspot.com", // <-- Corrected this line
  messagingSenderId: "68259268549",
  appId: "1:68259268549:web:9f3cf78bdcd881e2a0edac",
  measurementId: "G-P9LX55C5LN",
}

// Initialize Firebase app and services
let app: any = null
let db: any = null
let analytics: any = null
let firebaseInitialized = false // Overall flag for critical services (Firestore in this case)
let initializationError: string | null = null
let firestoreAvailable = false // Specific flag for Firestore

// Initialize Firebase only in browser environment
if (typeof window !== "undefined") {
  try {
    console.log("🔥 Initializing Firebase app...")
    console.log("🔥 Attempting to initialize Firebase app for projectId:", firebaseConfig.projectId)
    // Initialize Firebase app (only if not already initialized)
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
    console.log("✅ Firebase app initialized.")

    try {
      console.log("Attempting to initialize Firestore with app instance:", !!app) // Log if app instance exists
      db = getFirestore(app)
      firestoreAvailable = true
      console.log("✅ Firestore initialized successfully.")
    } catch (firestoreErr: any) {
      console.error("❌ Firestore initialization failed:", firestoreErr.message)
      initializationError = `Firestore not available: ${firestoreErr.message}`
      db = null
      firestoreAvailable = false
    }

    try {
      console.log("Attempting to initialize Analytics...")
      // Analytics is optional and might not be needed for all projects
      analytics = getAnalytics(app)
      console.log("✅ Analytics initialized successfully.")
    } catch (analyticsError: any) {
      console.warn("⚠️ Analytics initialization failed (non-critical):", analyticsError.message)
      // Analytics failure does not prevent overall FirebaseInitialized if Firestore is okay
    }

    // Overall Firebase is considered initialized if Firestore (the critical service for this app) is available
    firebaseInitialized = firestoreAvailable

    if (firebaseInitialized) {
      console.log("🎉 Firebase services ready for use.")
    } else {
      console.warn("⚠️ Firebase services partially or fully unavailable. Check console for details.")
    }
  } catch (error: any) {
    console.error("❌ Overall Firebase app initialization failed:", error.message)
    initializationError = `Overall Firebase initialization failed: ${error.message}`
    app = null
    db = null
    analytics = null
    firebaseInitialized = false
    firestoreAvailable = false
  }
} else {
  console.log("🔧 Server environment detected - Firebase will initialize on client")
}

export { db, analytics, firebaseInitialized, initializationError }

// Participant data structure interface (aligned with new schema)
export interface ParticipantData {
  // Session Metadata
  uid: string
  instructionPageStartTime?: Timestamp | string
  instructionPageEndTime?: Timestamp | string
  asrsStartTime?: Timestamp | string
  asrsEndTime?: Timestamp | string
  asrsResponses?: { [key: string]: string }
  asrsScore?: number
  isADHD?: boolean
  taskStartTime?: Timestamp | string
  taskEndTime?: Timestamp | string
  totalTaskDuration?: number // Milliseconds spent on the main task

  // Committed filter decisions
  filtersUsed?: Array<{
    filters: { [key: string]: any } // Normalized filter set
    timestamp: Timestamp | string
    trigger: "apply_button"
  }>
  finalFilters?: {
    filters: { [key: string]: any } // Normalized filter set
    timestamp: Timestamp | string
    type: "final_snapshot"
  }

  // Distraction logging
  distractionInteractions?: Array<{
    modalId: number | string
    action: string // e.g., dismissed, ignored, join_premium
    appearanceTimestamp: Timestamp | string
    dismissalTimestamp: Timestamp | string
    responseTime: number // duration between appearance and dismissal
    recoveryLatency: number // time from dismissal to next meaningful action
  }>

  // Attention shifts
  focusEvents?: Array<{
    type: "blur" | "focus"
    timestamp: Timestamp | string
  }>

  // Cart behavior
  cartChangeLog?: Array<{
    laptopId: number | string
    action: "add" | "remove"
    timestamp: Timestamp | string
    attemptSequence: number // global attempt sequence number
  }>
  finalCartItems?: Array<{
    laptopId: number | string
    matchedCriteria: boolean
  }>
  validationErrors?: string[]
  taskCompleted?: boolean

  // Post-task subjective experience (UEQ-S)
  ueqSStartTime?: Timestamp | string
  ueqSEndTime?: Timestamp | string
  ueqSResponses?: {
    efficient: number
    clear: number
    supportive: number
    easy: number
    exciting: number
    inventive: number
    captivating: number
    pleasant: number
  }
  ueqSPragmaticScore?: number
  ueqSHedonicScore?: number
  ueqSTotalScore?: number

  // Convenience summary metrics (optional but preferred)
  distractionCount?: number
  averageRecoveryLatency?: number
  cartAttemptCount?: number

  // Standard timestamps
  createdAt: Timestamp | string
  updatedAt: Timestamp | string
}

// Create new participant document
export const createParticipant = async (uid: string): Promise<string> => {
  console.log("🔄 Creating participant with UID:", uid)

  try {
    if (typeof window === "undefined") {
      throw new Error("Not in browser environment")
    }

    if (!firebaseInitialized || !db) {
      throw new Error(`Firebase not initialized for data storage. Error: ${initializationError || "Unknown error"}`)
    }

    console.log("✅ Firebase is ready, creating Firestore document...")

    const participantData: Partial<ParticipantData> = {
      uid,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      // Initialize all array fields
      filtersUsed: [],
      distractionInteractions: [],
      focusEvents: [],
      cartChangeLog: [],
      finalCartItems: [],
      validationErrors: [],
    }

    const docRef = await addDoc(collection(db, "participants"), participantData)
    console.log("🎉 Participant created successfully with ID:", docRef.id)

    // Store participant document ID in localStorage for session
    localStorage.setItem("participantDocId", docRef.id)
    localStorage.setItem("participantUID", uid)

    // Also save to local backup for redundancy
    const localBackup = {
      participantDocId: docRef.id,
      uid,
      createdAt: new Date().toISOString(),
      firebaseSuccess: true,
      // Initialize arrays for local backup too
      filtersUsed: [],
      distractionInteractions: [],
      focusEvents: [],
      cartChangeLog: [],
      finalCartItems: [],
      validationErrors: [],
    }
    localStorage.setItem("participantData", JSON.stringify(localBackup))

    return docRef.id
  } catch (error: any) {
    console.error("❌ Firebase participant creation failed:", error.message)

    // Generate a local ID and save data locally
    const localId = `local_${Date.now()}_${uid.slice(0, 8)}`

    const localData = {
      uid,
      createdAt: new Date().toISOString(),
      firebaseError: error.message,
      firebaseInitialized,
      initializationError,
      // Initialize arrays for local backup too
      filtersUsed: [],
      distractionInteractions: [],
      focusEvents: [],
      cartChangeLog: [],
      finalCartItems: [],
      validationErrors: [],
    }

    // Store locally
    localStorage.setItem("participantDocId", localId)
    localStorage.setItem("participantUID", uid)
    localStorage.setItem("participantData", JSON.stringify(localData))

    const existingBackup = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    existingBackup.push({
      collection: "participants",
      data: localData,
      localId,
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(existingBackup))

    console.log("💾 Participant data saved locally with ID:", localId)
    return localId
  }
}

// Update participant with instruction page end time
export const updateInstructionPageTimes = async (participantDocId: string, type: "start" | "end"): Promise<void> => {
  console.log(`🔄 Updating instruction page ${type} time for participant:`, participantDocId)

  try {
    if (typeof window === "undefined") {
      throw new Error("Not in browser environment")
    }

    if (!firebaseInitialized || !db) {
      throw new Error(`Firebase not available for data storage. Error: ${initializationError || "Unknown error"}`)
    }

    if (participantDocId.startsWith("local_")) {
      throw new Error("Local participant ID detected, skipping Firebase update.")
    }

    const updateField = type === "start" ? "instructionPageStartTime" : "instructionPageEndTime"
    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      [updateField]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    console.log(`✅ Instruction page ${type} time updated in Firebase`)

    // Also update local backup
    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    existingData[updateField] = new Date().toISOString()
    existingData.lastFirebaseUpdate = new Date().toISOString()
    localStorage.setItem("participantData", JSON.stringify(existingData))
  } catch (error: any) {
    console.warn(`❌ Firebase instruction page ${type} update failed, using local storage:`, error.message)

    // Update local data as fallback
    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    const updateField = type === "start" ? "instructionPageStartTime" : "instructionPageEndTime"
    existingData[updateField] = new Date().toISOString()
    existingData.updateError = error.message
    localStorage.setItem("participantData", JSON.stringify(existingData))

    // Add to backup queue
    const backupData = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    backupData.push({
      collection: "instruction_page_updates",
      data: { participantDocId, [updateField]: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(backupData))
  }
}

// Update participant with ASRS data and compute scores
export const updateASRSData = async (
  participantDocId: string,
  asrsResponses: { [key: string]: string },
): Promise<void> => {
  console.log("🔄 Updating ASRS data for participant:", participantDocId)

  try {
    // Calculate ASRS score
    const scoreMap: { [key: string]: number } = {
      never: 0,
      rarely: 1,
      sometimes: 2,
      often: 3,
      very_often: 4,
    }

    let totalScore = 0
    Object.values(asrsResponses).forEach((response) => {
      totalScore += scoreMap[response] || 0
    })

    // Determine ADHD likelihood (threshold can be adjusted based on research)
    const isADHD = totalScore >= 14 // Common threshold for ASRS Part A

    const asrsData = {
      asrsStartTime: serverTimestamp(),
      asrsEndTime: serverTimestamp(),
      asrsResponses,
      asrsScore: totalScore,
      isADHD,
      updatedAt: serverTimestamp(),
    }

    if (typeof window === "undefined" || !firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, asrsData)

    console.log("✅ ASRS data updated in Firebase", { totalScore, isADHD })

    // Update local backup
    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    Object.assign(existingData, {
      asrsStartTime: new Date().toISOString(),
      asrsEndTime: new Date().toISOString(),
      asrsResponses,
      asrsScore: totalScore,
      isADHD,
    })
    existingData.lastFirebaseUpdate = new Date().toISOString()
    localStorage.setItem("participantData", JSON.stringify(existingData))
  } catch (error: any) {
    console.warn("❌ Firebase ASRS update failed, using local storage:", error.message)

    // Calculate score for local storage (redundant but ensures consistency)
    const scoreMap: { [key: string]: number } = {
      never: 0,
      rarely: 1,
      sometimes: 2,
      often: 3,
      very_often: 4,
    }

    let totalScore = 0
    Object.values(asrsResponses).forEach((response) => {
      totalScore += scoreMap[response] || 0
    })

    const isADHD = totalScore >= 14

    const asrsData = {
      asrsStartTime: new Date().toISOString(),
      asrsEndTime: new Date().toISOString(),
      asrsResponses,
      asrsScore: totalScore,
      isADHD,
      error: error.message,
    }

    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    Object.assign(existingData, asrsData)
    localStorage.setItem("participantData", JSON.stringify(existingData))

    // Add to backup queue
    const backupData = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    backupData.push({
      collection: "asrs_updates",
      data: { participantDocId, ...asrsData },
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(backupData))

    console.log("💾 ASRS data saved locally", { totalScore, isADHD })
  }
}

// Update participant with task start
export const updateTaskStart = async (participantDocId: string): Promise<void> => {
  console.log("🔄 Updating task start for participant:", participantDocId)

  try {
    if (typeof window === "undefined" || !firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      taskStartTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    console.log("✅ Task start time updated in Firebase")

    // Update local backup
    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    existingData.taskStartTime = new Date().toISOString()
    existingData.lastFirebaseUpdate = new Date().toISOString()
    localStorage.setItem("participantData", JSON.stringify(existingData))
  } catch (error: any) {
    console.warn("❌ Firebase task start update failed, using local storage:", error.message)

    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    existingData.taskStartTime = new Date().toISOString()
    existingData.updateError = error.message
    localStorage.setItem("participantData", JSON.stringify(existingData))

    // Add to backup queue
    const backupData = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    backupData.push({
      collection: "task_start_updates",
      data: { participantDocId, taskStartTime: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(backupData))
  }
}

// Log committed filter snapshot

// Normalization helper (can be expanded to include other filters)
const normalizeFilters = (raw: { [key: string]: any }) => {
  const normalized: { [key: string]: any } = {}

  for (const key of Object.keys(raw)) {
    const value = raw[key]
    if (typeof value === "number") {
      if (key.toLowerCase().includes("price")) {
        normalized[key] = Math.round(value / 50) * 50
      } else {
        normalized[key] = value
      }
    } else if (typeof value === "string") {
      normalized[key] = value
    } else if (Array.isArray(value)) {
      normalized[key] = value.slice().sort()
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

export const logFilterCommit = async (participantDocId: string, filters: { [key: string]: any }): Promise<void> => {
  const normalizedFilters = normalizeFilters(filters)
  const filterCommitData = {
    filters: normalizedFilters,
    timestamp: new Date().toISOString(),
    trigger: "apply_button" as const,
  }

  try {
    if (!firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    const participantRef = doc(db, "participants", participantDocId)

    // Fetch existing document for deduplication
    const { getDoc } = await import("firebase/firestore")
    const participantSnapshot = await getDoc(doc(db, "participants", participantDocId))
    let lastFilters: any = null
    if (participantSnapshot.exists()) {
      const data = participantSnapshot.data() as any
      const existing = data.filtersUsed || []
      if (existing.length) {
        lastFilters = existing[existing.length - 1].filters
      }
    }

    if (lastFilters && deepEqual(lastFilters, normalizedFilters)) {
      // skip duplicate
      console.log("⏭ Skipping duplicate filter commit")
      return
    }

    // Append new filter commit
    await updateDoc(participantRef, {
      filtersUsed: arrayUnion({
        ...filterCommitData,
        serverTime: serverTimestamp(),
      }),
      updatedAt: serverTimestamp(),
    })

    console.log("✅ Filter commit logged to Firebase", filterCommitData)
  } catch (error: any) {
    console.warn("💥 logFilterCommit failed, falling back to local storage:", error.message)

    const existingBackup = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    existingBackup.push({
      collection: "filtersUsed",
      participantDocId,
      data: filterCommitData,
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(existingBackup))
  }
}
): Promise<void> => {
  const filterCommitData = {
    filters,
    timestamp: new Date().toISOString(),
    trigger: "apply_button",
  }

  try {
    if (!firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      filtersUsed: arrayUnion({ ...filterCommitData, timestamp: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    })

    console.log("✅ Filter commit logged to Firebase (arrayUnion)", filterCommitData)
  } catch (error: any) {
    console.log("💾 Logging filter commit locally:", filterCommitData)

    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    if (!existingData.filtersUsed) existingData.filtersUsed = []
    existingData.filtersUsed.push(filterCommitData)
    existingData.updateError = error.message
    localStorage.setItem("participantData", JSON.stringify(existingData))

    const backupData = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    backupData.push({
      collection: "filter_commits",
      data: { participantDocId, ...filterCommitData },
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(backupData))
  }
}

// Log distraction interaction
export const logDistractionInteraction = async (
  participantDocId: string,
  modalId: number | string,
  action: string,
  appearanceTimestamp: number, // JS timestamp
  dismissalTimestamp: number, // JS timestamp
  responseTime: number,
  recoveryLatency: number,
): Promise<void> => {
  const distractionData = {
    modalId,
    action,
    appearanceTimestamp: new Date(appearanceTimestamp).toISOString(),
    dismissalTimestamp: new Date(dismissalTimestamp).toISOString(),
    responseTime,
    recoveryLatency,
    timestamp: new Date().toISOString(), // Overall log timestamp
  }

  try {
    if (!firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      distractionInteractions: arrayUnion({
        ...distractionData,
        appearanceTimestamp: new Date(appearanceTimestamp), // Convert back to Date for serverTimestamp
        dismissalTimestamp: new Date(dismissalTimestamp), // Convert back to Date for serverTimestamp
        timestamp: serverTimestamp(),
      }),
      updatedAt: serverTimestamp(),
    })

    console.log("✅ Distraction interaction logged to Firebase (arrayUnion)", distractionData)
  } catch (error: any) {
    console.log("💾 Logging distraction interaction locally:", distractionData)

    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    if (!existingData.distractionInteractions) existingData.distractionInteractions = []
    existingData.distractionInteractions.push(distractionData)
    existingData.updateError = error.message
    localStorage.setItem("participantData", JSON.stringify(existingData))

    const backupData = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    backupData.push({
      collection: "distraction_interactions",
      data: { participantDocId, ...distractionData },
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(backupData))
  }
}

// Log focus loss/gain events
export const logFocusEvent = async (participantDocId: string, type: "blur" | "focus"): Promise<void> => {
  const focusEventData = {
    type,
    timestamp: new Date().toISOString(),
  }

  try {
    if (!firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      focusEvents: arrayUnion({ ...focusEventData, timestamp: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    })

    console.log("✅ Focus event logged to Firebase (arrayUnion)", focusEventData)
  } catch (error: any) {
    console.log("💾 Logging focus event locally:", focusEventData)

    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    if (!existingData.focusEvents) existingData.focusEvents = []
    existingData.focusEvents.push(focusEventData)
    existingData.updateError = error.message
    localStorage.setItem("participantData", JSON.stringify(existingData))

    const backupData = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    backupData.push({
      collection: "focus_events",
      data: { participantDocId, ...focusEventData },
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(backupData))
  }
}

// Log every cart add/remove attempt
export const logCartChange = async (
  participantDocId: string,
  laptopId: number | string,
  action: "add" | "remove",
  attemptSequence: number,
): Promise<void> => {
  const cartChangeData = {
    laptopId,
    action,
    timestamp: new Date().toISOString(),
    attemptSequence,
  }

  try {
    if (!firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      cartChangeLog: arrayUnion({ ...cartChangeData, timestamp: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    })

    console.log("✅ Cart change logged to Firebase (arrayUnion)", cartChangeData)
  } catch (error: any) {
    console.log("💾 Logging cart change locally:", cartChangeData)

    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    if (!existingData.cartChangeLog) existingData.cartChangeLog = []
    existingData.cartChangeLog.push(cartChangeData)
    existingData.updateError = error.message
    localStorage.setItem("participantData", JSON.stringify(existingData))

    const backupData = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    backupData.push({
      collection: "cart_changes",
      data: { participantDocId, ...cartChangeData },
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(backupData))
  }
}

// Update participant with UEQ-S data and compute scores
export const updateUEQSData = async (
  participantDocId: string,
  ueqSResponses: ParticipantData["ueqSResponses"],
): Promise<void> => {
  console.log("🔄 Updating UEQ-S data for participant:", participantDocId)

  try {
    // UEQ-S scoring logic (transform 1-7 scale to -3 to +3 for calculation)
    const transformScore = (score: number) => score - 4

    const efficientScore = transformScore(ueqSResponses!.efficient)
    const clearScore = transformScore(ueqSResponses!.clear)
    const supportiveScore = transformScore(ueqSResponses!.supportive)
    const easyScore = transformScore(ueqSResponses!.easy)
    const excitingScore = transformScore(ueqSResponses!.exciting)
    const inventiveScore = transformScore(ueqSResponses!.inventive)
    const captivatingScore = transformScore(ueqSResponses!.captivating)
    const pleasantScore = transformScore(ueqSResponses!.pleasant)

    const ueqSPragmaticScore = (efficientScore + clearScore + supportiveScore + easyScore) / 4
    const ueqSHedonicScore = (excitingScore + inventiveScore + captivatingScore + pleasantScore) / 4
    const ueqSTotalScore = (ueqSPragmaticScore + ueqSHedonicScore) / 2

    const ueqSData = {
      ueqSStartTime: serverTimestamp(),
      ueqSEndTime: serverTimestamp(),
      ueqSResponses,
      ueqSPragmaticScore: Number.parseFloat(ueqSPragmaticScore.toFixed(2)),
      ueqSHedonicScore: Number.parseFloat(ueqSHedonicScore.toFixed(2)),
      ueqSTotalScore: Number.parseFloat(ueqSTotalScore.toFixed(2)),
      updatedAt: serverTimestamp(),
    }

    if (typeof window === "undefined" || !firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, ueqSData)

    console.log("✅ UEQ-S data updated in Firebase", {
      ueqSPragmaticScore,
      ueqSHedonicScore,
      ueqSTotalScore,
    })

    // Update local backup
    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    Object.assign(existingData, {
      ueqSStartTime: new Date().toISOString(),
      ueqSEndTime: new Date().toISOString(),
      ueqSResponses,
      ueqSPragmaticScore: Number.parseFloat(ueqSPragmaticScore.toFixed(2)),
      ueqSHedonicScore: Number.parseFloat(ueqSHedonicScore.toFixed(2)),
      ueqSTotalScore: Number.parseFloat(ueqSTotalScore.toFixed(2)),
    })
    existingData.lastFirebaseUpdate = new Date().toISOString()
    localStorage.setItem("participantData", JSON.stringify(existingData))
  } catch (error: any) {
    console.warn("❌ Firebase UEQ-S update failed, using local storage:", error.message)

    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    Object.assign(existingData, {
      ueqSStartTime: new Date().toISOString(),
      ueqSEndTime: new Date().toISOString(),
      ueqSResponses,
      error: error.message,
    })
    localStorage.setItem("participantData", JSON.stringify(existingData))

    const backupData = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    backupData.push({
      collection: "ueqs_updates",
      data: { participantDocId, ueqSResponses, timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(backupData))
  }
}

// Complete task and log final data
export const completeTask = async (
  participantDocId: string,
  finalData: {
    finalCartItems: ParticipantData["finalCartItems"]
    validationErrors: string[]
    totalTaskDuration: number
    taskCompleted: boolean
    finalFilters: ParticipantData["finalFilters"]
    distractionCount: number
    averageRecoveryLatency: number
    cartAttemptCount: number
  },
): Promise<void> => {
  console.log("🔄 Completing task for participant:", participantDocId)

  const taskCompletionData = {
    participantDocId,
    ...finalData,
    taskEndTime: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  }

  try {
    if (typeof window === "undefined" || !firebaseInitialized || !db || participantDocId.startsWith("local_")) {
      throw new Error("Firebase not available for data storage or local participant ID detected.")
    }

    // Update participant document with final task details
    const participantRef = doc(db, "participants", participantDocId)
    await updateDoc(participantRef, {
      taskEndTime: serverTimestamp(),
      taskCompleted: finalData.taskCompleted,
      finalCartItems: finalData.finalCartItems,
      validationErrors: finalData.validationErrors,
      totalTaskDuration: finalData.totalTaskDuration,
      finalFilters: { ...finalData.finalFilters, timestamp: serverTimestamp() },
      distractionCount: finalData.distractionCount,
      averageRecoveryLatency: finalData.averageRecoveryLatency,
      cartAttemptCount: finalData.cartAttemptCount,
      updatedAt: serverTimestamp(),
    })

    console.log("🎉 Task completed and logged to Firebase successfully!")

    // Update local backup
    const existingData = JSON.parse(localStorage.getItem("participantData") || "{}")
    Object.assign(existingData, taskCompletionData)
    existingData.lastFirebaseUpdate = new Date().toISOString()
    localStorage.setItem("participantData", JSON.stringify(existingData))
  } catch (error: any) {
    console.error("❌ Firebase task completion failed, using local storage:", error.message)

    // Save to local backup
    const existingBackup = JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
    existingBackup.push({
      collection: "task_completions",
      data: taskCompletionData,
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("firebaseBackup", JSON.stringify(existingBackup))

    console.log("💾 Task completion data saved locally")
  }
}

// Utility functions
export const generateUID = (): string => {
  return uuidv4()
}

export const getParticipantDocId = (): string | null => {
  return localStorage.getItem("participantDocId")
}

export const getParticipantUID = (): string | null => {
  return localStorage.getItem("participantUID")
}

// Helper function to check Firebase status
export const checkFirebaseStatus = () => {
  return {
    app: !!app,
    firestore: !!db,
    analytics: !!analytics,
    initialized: firebaseInitialized,
    error: initializationError,
    environment: typeof window !== "undefined" ? "client" : "server",
  }
}

// Helper function to get backup data
export const getBackupData = () => {
  try {
    return JSON.parse(localStorage.getItem("firebaseBackup") || "[]")
  } catch (error) {
    console.error("Error reading backup data:", error)
    return []
  }
}

// Function to display Firebase status to user
export const getFirebaseStatusMessage = (): { status: "success" | "error" | "loading"; message: string } => {
  if (typeof window === "undefined") {
    return { status: "loading", message: "Initializing..." }
  }

  if (firebaseInitialized && db) {
    return { status: "success", message: "Connected to Firebase - data will be saved to cloud database" }
  } else {
    return {
      status: "error",
      message: `Firebase connection failed: ${initializationError || "Unknown error"}. Data will be saved locally as backup.`,
    }
  }
}

// Admin function to get all participants data
export const getAllParticipantsData = async (): Promise<ParticipantData[]> => {
  try {
    if (!firebaseInitialized || !db) {
      throw new Error(`Firebase not available for data retrieval. Error: ${initializationError || "Unknown error"}`)
    }

    const participantsCol = collection(db, "participants")
    const q = query(participantsCol)
    const querySnapshot = await getDocs(q)

    const participants: ParticipantData[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data() as ParticipantData
      // Convert Firestore Timestamps to ISO strings for consistency with local data
      const convertTimestamps = (obj: any) => {
        for (const key in obj) {
          if (obj[key] && typeof obj[key].toDate === "function") {
            obj[key] = obj[key].toDate().toISOString()
          } else if (typeof obj[key] === "object" && obj[key] !== null) {
            convertTimestamps(obj[key])
          }
        }
      }
      convertTimestamps(data)
      participants.push(data)
    })
    console.log("✅ Fetched all participants data from Firebase.")
    return participants
  } catch (error: any) {
    console.error("❌ Error fetching all participants data:", error.message)
    return []
  }
}
