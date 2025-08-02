"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  ShoppingCart,
  List,
  Popcorn,
  Loader2,
  Star,
  Brain,
  Users,
} from "lucide-react"
import { getBackupData, getFirebaseStatusMessage, getAllParticipantsData, type ParticipantData } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import laptops from "@/data/laptops"

export default function DataAnalysisPage() {
  const [participantData, setParticipantData] = useState<ParticipantData | null>(null)
  const [allParticipants, setAllParticipants] = useState<ParticipantData[]>([])
  const [firebaseStatus, setFirebaseStatus] = useState<{ status: "success" | "error" | "loading"; message: string }>({
    status: "loading",
    message: "Initializing...",
  })
  const [backupData, setBackupData] = useState<any[]>([])
  const [showADHDOnly, setShowADHDOnly] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)

    // Load current participant's task completion data from local storage
    const storedData = localStorage.getItem("taskCompletionData")
    if (storedData) {
      setParticipantData(JSON.parse(storedData))
    }

    // Check Firebase status
    const status = getFirebaseStatusMessage()
    setFirebaseStatus(status)

    // Load backup data
    setBackupData(getBackupData())

    // Fetch all participants data for admin view
    const fetchAllData = async () => {
      const data = await getAllParticipantsData()
      setAllParticipants(data)
    }
    fetchAllData()
  }, [])

  const formatDuration = (ms: number | undefined | null) => {
    if (ms === undefined || ms === null) return "N/A"
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds}s`
  }

  const filteredParticipants = showADHDOnly ? allParticipants.filter((p) => p.isADHD) : allParticipants

  
  const safeNum = (n: any, fallback = 0) => {
    return typeof n === "number" && !isNaN(n) ? n : fallback
  }

  const calculateAggregates = (participants: ParticipantData[]) => {
    if (participants.length === 0) {
      return {
        count: 0,
        avgTaskDuration: "N/A",
        avgDistractionCount: "N/A",
        avgRecoveryLatency: "N/A",
        avgCartAttempts: "N/A",
        avgPragmaticScore: "N/A",
        avgHedonicScore: "N/A",
        completionRate: "N/A",
      }
    }

    const totalTaskDuration = participants.reduce((sum, p) => sum + safeNum(p.totalTaskDuration), 0)
    const totalDistractionCount = participants.reduce((sum, p) => sum + safeNum(p.distractionCount), 0)
    const recoveryLatencies = participants
      .map(p => p.averageRecoveryLatency)
      .filter(r => typeof r === "number")
    const totalRecoveryLatency = recoveryLatencies.reduce((sum, v) => sum + safeNum(v), 0)
    const validRecoveryCount = recoveryLatencies.length || 1

    const totalCartAttempts = participants.reduce((sum, p) => sum + safeNum(p.cartAttemptCount), 0)
    const pragmaticScores = participants
      .map(p => p.ueqSPragmaticScore)
      .filter(s => typeof s === "number")
    const totalPragmaticScore = pragmaticScores.reduce((sum, v) => sum + safeNum(v), 0)
    const validPragmaticCount = pragmaticScores.length || 1

    const hedonicScores = participants
      .map(p => p.ueqSHedonicScore)
      .filter(s => typeof s === "number")
    const totalHedonicScore = hedonicScores.reduce((sum, v) => sum + safeNum(v), 0)
    const validHedonicCount = hedonicScores.length || 1

    const completedCount = participants.filter((p) => p.taskCompleted).length

    return {
      count: participants.length,
      avgTaskDuration: formatDuration(totalTaskDuration / participants.length),
      avgDistractionCount: (totalDistractionCount / participants.length).toFixed(1),
      avgRecoveryLatency: (totalRecoveryLatency / validRecoveryCount).toFixed(2),
      avgCartAttempts: (totalCartAttempts / participants.length).toFixed(1),
      avgPragmaticScore: (totalPragmaticScore / validPragmaticCount).toFixed(2),
      avgHedonicScore: (totalHedonicScore / validHedonicCount).toFixed(2),
      completionRate: `${((completedCount / participants.length) * 100).toFixed(1)}%`,
    }
  }


  const allAggregates = calculateAggregates(allParticipants)
  const adhdAggregates = calculateAggregates(allParticipants.filter((p) => p.isADHD))
  const nonAdhdAggregates = calculateAggregates(allParticipants.filter((p) => !p.isADHD))

  if (!participantData && allParticipants.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Loading Data...</h2>
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mt-4 mx-auto" />
          <p className="text-gray-600 mt-2">Attempting to fetch participant data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Task Completion Analysis</h1>
          <p className="text-lg text-gray-600">Review of your shopping task performance and interactions.</p>
        </div>

        {/* Firebase Status Alert */}
        <Alert
          className={`mb-6 ${firebaseStatus.status === "success" ? "border-green-200 bg-green-50" : firebaseStatus.status === "error" ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}`}
        >
          <div className="flex items-center">
            {firebaseStatus.status === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
            {firebaseStatus.status === "error" && <AlertTriangle className="h-4 w-4 text-red-600" />}
            {firebaseStatus.status === "loading" && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
            <AlertDescription
              className={`ml-2 ${firebaseStatus.status === "success" ? "text-green-800" : firebaseStatus.status === "error" ? "text-red-800" : "text-blue-800"}`}
            >
              {firebaseStatus.message}
            </AlertDescription>
          </div>
        </Alert>

        {/* Current Participant Summary Cards */}
        {participantData && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Session Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Task Status</CardTitle>
                  {participantData.taskCompleted ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {participantData.taskCompleted ? "Completed Successfully" : "Incomplete / Errors"}
                  </div>
                  {participantData.validationErrors && participantData.validationErrors.length > 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      {participantData.validationErrors.length} validation error(s)
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
                  <Clock className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatDuration(participantData.totalTaskDuration)}</div>
                  <p className="text-xs text-gray-500">Total duration on task page</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Laptops Selected</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{participantData.finalCartItems?.length || 0} / 3</div>
                  <p className="text-xs text-gray-500">Items in final cart</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ADHD Classification</CardTitle>
                  <Brain className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {participantData.isADHD === true
                      ? "Likely ADHD"
                      : participantData.isADHD === false
                        ? "Not Likely ADHD"
                        : "N/A"}
                  </div>
                  <p className="text-xs text-gray-500">ASRS Score: {participantData.asrsScore || "N/A"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Distractions</CardTitle>
                  <Popcorn className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{participantData.distractionCount || 0}</div>
                  <p className="text-xs text-gray-500">Total modals shown</p>
                  <p className="text-xs text-gray-500">
                    Avg. Recovery: {participantData.averageRecoveryLatency?.toFixed(2) || "N/A"}ms
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cart Attempts</CardTitle>
                  <List className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{participantData.cartAttemptCount || 0}</div>
                  <p className="text-xs text-gray-500">Add/Remove actions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">UEQ-S Pragmatic Quality</CardTitle>
                  <Info className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{participantData.ueqSPragmaticScore?.toFixed(2) || "N/A"}</div>
                  <p className="text-xs text-gray-500">Efficiency, Clarity, Support, Ease</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">UEQ-S Hedonic Quality</CardTitle>
                  <Info className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{participantData.ueqSHedonicScore?.toFixed(2) || "N/A"}</div>
                  <p className="text-xs text-gray-500">Excitement, Inventiveness, Captivation, Pleasantness</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Detailed Analysis Tabs */}
        {participantData && (
          <Tabs defaultValue="selected-laptops" className="w-full mt-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="selected-laptops">
                <ShoppingCart className="h-4 w-4 mr-2" /> Selected Laptops
              </TabsTrigger>
              <TabsTrigger value="validation">
                <AlertTriangle className="h-4 w-4 mr-2" /> Validation
              </TabsTrigger>
              <TabsTrigger value="interactions">
                <List className="h-4 w-4 mr-2" /> Interactions Log
              </TabsTrigger>
              <TabsTrigger value="distractions">
                <Popcorn className="h-4 w-4 mr-2" /> Distractions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="selected-laptops" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Your Selected Laptops</CardTitle>
                  <p className="text-sm text-gray-600">Details of the laptops in your cart at submission.</p>
                </CardHeader>
                <CardContent>
                  {participantData.finalCartItems && participantData.finalCartItems.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {participantData.finalCartItems.map((item, index) => {
                        const laptop = laptops.find((l) => l.id === item.laptopId)
                        return laptop ? (
                          <Card key={index} className="p-4">
                            <h3 className="font-semibold text-lg">{laptop.title}</h3>
                            <p className="text-blue-600 font-bold">${laptop.price.toLocaleString()}</p>
                            <ul className="text-sm text-gray-600 mt-2 space-y-1">
                              <li>RAM: {laptop.ram}GB</li>
                              <li>Processor: {laptop.processor}</li>
                              <li>Storage: {laptop.storage}</li>
                              <li>Screen: {laptop.screenSize}</li>
                              <li>Weight: {laptop.weight}</li>
                              <li>
                                Rating: {laptop.rating}{" "}
                                <Star className="h-3 w-3 inline fill-yellow-400 text-yellow-400" />
                              </li>
                              <li>Delivery: {laptop.deliveryTime}</li>
                            </ul>
                            <div className="mt-2 text-xs font-medium">
                              {item.matchedCriteria ? (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Meets Criteria</span>
                              ) : (
                                <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                                  Does NOT Meet Criteria
                                </span>
                              )}
                            </div>
                          </Card>
                        ) : null
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500">No laptops were in your cart at the time of submission.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="validation" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Validation Results</CardTitle>
                  <p className="text-sm text-gray-600">Summary of whether your selection met the task criteria.</p>
                </CardHeader>
                <CardContent>
                  {participantData.validationErrors && participantData.validationErrors.length > 0 ? (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertDescription>
                        <div className="space-y-1">
                          <p className="font-medium text-red-800 mb-2">Your selection did not meet all criteria:</p>
                          {participantData.validationErrors.map((error, index) => (
                            <div key={index} className="text-red-700">
                              • {error}
                            </div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription>
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                          <span className="font-medium text-green-800">All task criteria were met!</span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="interactions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Interaction Log</CardTitle>
                  <p className="text-sm text-gray-600">A detailed log of your actions during the task.</p>
                </CardHeader>
                <CardContent>
                  <h3 className="text-md font-semibold mb-2">Cart Changes</h3>
                  {participantData.cartChangeLog && participantData.cartChangeLog.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border rounded-md p-4 bg-gray-50 text-sm mb-4">
                      {participantData.cartChangeLog.map((log, index) => (
                        <div key={index} className="mb-2 border-b pb-2 last:mb-0 last:border-b-0 last:pb-0">
                          <span className="font-mono text-xs text-gray-500">
                            [{new Date(log.timestamp as string).toLocaleTimeString()}]
                          </span>{" "}
                          <span className="font-medium text-gray-800">
                            Cart {log.action}: Laptop {log.laptopId} (Attempt: {log.attemptSequence})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 mb-4">No cart changes logged.</p>
                  )}

                  <h3 className="text-md font-semibold mb-2">Filter Commits</h3>
                  {participantData.filtersUsed && participantData.filtersUsed.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border rounded-md p-4 bg-gray-50 text-sm mb-4">
                      {participantData.filtersUsed.map((log, index) => (
                        <div key={index} className="mb-2 border-b pb-2 last:mb-0 last:border-b-0 last:pb-0">
                          <span className="font-mono text-xs text-gray-500">
                            [{new Date(log.timestamp as string).toLocaleTimeString()}]
                          </span>{" "}
                          <span className="font-medium text-gray-800">Filter Applied:</span>{" "}
                          <pre className="mt-1 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.filters, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 mb-4">No filters were explicitly applied.</p>
                  )}

                  <h3 className="text-md font-semibold mb-2">Focus Events</h3>
                  {participantData.focusEvents && participantData.focusEvents.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border rounded-md p-4 bg-gray-50 text-sm">
                      {participantData.focusEvents.map((log, index) => (
                        <div key={index} className="mb-2 border-b pb-2 last:mb-0 last:border-b-0 last:pb-0">
                          <span className="font-mono text-xs text-gray-500">
                            [{new Date(log.timestamp as string).toLocaleTimeString()}]
                          </span>{" "}
                          <span className="font-medium text-gray-800">Window {log.type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No focus events logged.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="distractions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Distraction Interactions</CardTitle>
                  <p className="text-sm text-gray-600">Summary of how you interacted with pop-up distractions.</p>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-gray-700">
                    Total distraction modals shown:{" "}
                    <span className="font-bold text-blue-600">{participantData.distractionCount || 0}</span>
                  </p>
                  <p className="mb-4 text-gray-700">
                    Average recovery latency:{" "}
                    <span className="font-bold text-blue-600">
                      {participantData.averageRecoveryLatency?.toFixed(2) || "N/A"}ms
                    </span>
                  </p>
                  {participantData.distractionInteractions && participantData.distractionInteractions.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto border rounded-md p-4 bg-gray-50 text-sm">
                      {participantData.distractionInteractions.map((log, index) => (
                        <div key={index} className="mb-2 border-b pb-2 last:mb-0 last:border-b-0 last:pb-0">
                          <span className="font-mono text-xs text-gray-500">
                            [{new Date(log.appearanceTimestamp as string).toLocaleTimeString()}]
                          </span>{" "}
                          <span className="font-medium text-gray-800">Modal {log.modalId}:</span>{" "}
                          <span className="text-gray-700">Action: {log.action}</span>
                          <div className="text-xs text-gray-600">
                            Response Time: {log.responseTime}ms, Recovery Latency: {log.recoveryLatency}ms
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No distraction interactions logged.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Admin / Verification View */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <Users className="h-6 w-6 mr-2" /> All Participants Data (Admin View)
          </h2>
          <div className="mb-4 flex items-center space-x-4">
            <Button variant={showADHDOnly ? "default" : "outline"} onClick={() => setShowADHDOnly(true)} size="sm">
              Show Only Likely ADHD
            </Button>
            <Button variant={!showADHDOnly ? "default" : "outline"} onClick={() => setShowADHDOnly(false)} size="sm">
              Show All Participants
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Aggregated Metrics (All Participants)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <strong>Total Participants:</strong> {allAggregates.count}
                </p>
                <p>
                  <strong>Avg. Task Duration:</strong> {allAggregates.avgTaskDuration}
                </p>
                <p>
                  <strong>Avg. Distractions:</strong> {allAggregates.avgDistractionCount}
                </p>
                <p>
                  <strong>Avg. Recovery Latency:</strong> {allAggregates.avgRecoveryLatency}ms
                </p>
                <p>
                  <strong>Avg. Cart Attempts:</strong> {allAggregates.avgCartAttempts}
                </p>
                <p>
                  <strong>Avg. UEQ-S Pragmatic:</strong> {allAggregates.avgPragmaticScore}
                </p>
                <p>
                  <strong>Avg. UEQ-S Hedonic:</strong> {allAggregates.avgHedonicScore}
                </p>
                <p>
                  <strong>Completion Rate:</strong> {allAggregates.completionRate}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Aggregated Metrics (Likely ADHD vs. Not Likely ADHD)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-blue-700">Likely ADHD ({adhdAggregates.count})</h4>
                    <p>Duration: {adhdAggregates.avgTaskDuration}</p>
                    <p>Distractions: {adhdAggregates.avgDistractionCount}</p>
                    <p>Recovery: {adhdAggregates.avgRecoveryLatency}ms</p>
                    <p>Cart Attempts: {adhdAggregates.avgCartAttempts}</p>
                    <p>PQ: {adhdAggregates.avgPragmaticScore}</p>
                    <p>HQ: {adhdAggregates.avgHedonicScore}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700">Not Likely ADHD ({nonAdhdAggregates.count})</h4>
                    <p>Duration: {nonAdhdAggregates.avgTaskDuration}</p>
                    <p>Distractions: {nonAdhdAggregates.avgDistractionCount}</p>
                    <p>Recovery: {nonAdhdAggregates.avgRecoveryLatency}ms</p>
                    <p>Cart Attempts: {nonAdhdAggregates.avgCartAttempts}</p>
                    <p>PQ: {nonAdhdAggregates.avgPragmaticScore}</p>
                    <p>HQ: {nonAdhdAggregates.avgHedonicScore}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {showADHDOnly ? "Likely ADHD Participants" : "All Participants"}
          </h3>
          {filteredParticipants.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredParticipants.map((p) => (
                <Card key={p.uid} className="p-4">
                  <CardTitle className="text-lg font-semibold mb-2">Participant: {p.uid?.slice(0, 8)}...</CardTitle>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>ADHD Classification:</strong>{" "}
                      {p.isADHD === true ? "Likely ADHD" : p.isADHD === false ? "Not Likely ADHD" : "N/A"} (Score:{" "}
                      {p.asrsScore || "N/A"})
                    </p>
                    <p>
                      <strong>Task Status:</strong>{" "}
                      {p.taskCompleted ? "Completed" : p.validationErrors?.length ? "Errors" : "Incomplete"}
                    </p>
                    <p>
                      <strong>Task Duration:</strong> {formatDuration(p.totalTaskDuration)}
                    </p>
                    <p>
                      <strong>Distractions Shown:</strong> {p.distractionCount || 0}
                    </p>
                    <p>
                      <strong>Avg. Recovery Latency:</strong> {p.averageRecoveryLatency?.toFixed(2) || "N/A"}ms
                    </p>
                    <p>
                      <strong>Cart Attempts:</strong> {p.cartAttemptCount || 0}
                    </p>
                    <p>
                      <strong>UEQ-S Pragmatic Quality:</strong> {p.ueqSPragmaticScore?.toFixed(2) || "N/A"}
                    </p>
                    <p>
                      <strong>UEQ-S Hedonic Quality:</strong> {p.ueqSHedonicScore?.toFixed(2) || "N/A"}
                    </p>
                    <p>
                      <strong>Final Cart Items:</strong> {p.finalCartItems?.length || 0}
                    </p>
                    {p.validationErrors && p.validationErrors.length > 0 && (
                      <p className="text-red-600">
                        <strong>Errors:</strong> {p.validationErrors.join(", ")}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No participants found matching the criteria.</p>
          )}
        </div>

        {backupData.length > 0 && (
          <Card className="mt-8 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center text-yellow-800">
                <Info className="h-5 w-5 mr-2" /> Local Backup Data
              </CardTitle>
              <p className="text-sm text-yellow-700">
                The following data was saved locally due to Firebase connection issues and will be attempted to be
                synced later.
              </p>
            </CardHeader>
            <CardContent>
              <pre className="max-h-60 overflow-y-auto text-xs bg-yellow-100 p-3 rounded-md text-yellow-900">
                {JSON.stringify(backupData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
