"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Brain } from "lucide-react"
import { useRouter } from "next/navigation"
import { updateASRSData, getParticipantDocId } from "@/lib/firebase"

interface ASRSQuestion {
  id: number
  question: string
}

const asrsQuestions: ASRSQuestion[] = [
  {
    id: 1,
    question:
      "How often do you have difficulty concentrating on what people say to you, even when they are speaking to you directly?",
  },
  {
    id: 2,
    question:
      "How often do you leave your seat in meetings or other situations in which you are expected to remain seated?",
  },
  {
    id: 3,
    question: "How often do you have difficulty unwinding and relaxing when you have time to yourself?",
  },
  {
    id: 4,
    question:
      "When you're in a conversation, how often do you find yourself finishing the sentences of the people you are talking to before they can finish them themselves?",
  },
  {
    id: 5,
    question: "How often do you put things off until the last minute?",
  },
  {
    id: 6,
    question: "How often do you depend on others to keep your life in order and attend to details?",
  },
]

const responseOptions = [
  { value: "never", label: "Never" },
  { value: "rarely", label: "Rarely" },
  { value: "sometimes", label: "Sometimes" },
  { value: "often", label: "Often" },
  { value: "very_often", label: "Very Often" },
]

export default function ADHDScreener() {
  const [responses, setResponses] = useState<Record<number, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0)
  }, [])

  const handleResponseChange = (questionId: number, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleSubmit = async () => {
    if (Object.keys(responses).length !== asrsQuestions.length) {
      alert("Please answer all questions before continuing.")
      return
    }

    setIsSubmitting(true)

    try {
      let participantDocId = getParticipantDocId()

      // If no participant doc ID, try to get from participantInfo
      if (!participantDocId) {
        const participantInfo = JSON.parse(localStorage.getItem("participantInfo") || "{}")
        participantDocId = participantInfo.participantDocId
      }

      // If still no ID, create a fallback (should ideally not happen if flow is followed)
      if (!participantDocId) {
        participantDocId = `asrs_fallback_${Date.now()}`
        localStorage.setItem("participantDocId", participantDocId)
        console.warn("No participant document ID found, created fallback:", participantDocId)
      }

      console.log("Submitting ASRS with participant ID:", participantDocId)

      // Convert responses to the format expected by Firebase
      const formattedResponses: { [key: string]: string } = {}
      Object.entries(responses).forEach(([questionId, response]) => {
        formattedResponses[`q${questionId}`] = response
      })

      // Update participant document with ASRS data
      await updateASRSData(participantDocId, formattedResponses)

      // Save to localStorage for the session (backup)
      const asrsData = {
        participantDocId,
        responses: formattedResponses,
        completedAt: new Date().toISOString(),
      }
      localStorage.setItem("asrsData", JSON.stringify(asrsData))

      console.log("✅ ASRS data saved successfully")
      router.push("/task-instructions")
    } catch (error: any) {
      console.error("Error saving ASRS data:", error)

      // Save locally and continue
      const asrsData = {
        participantDocId: getParticipantDocId() || `local_asrs_${Date.now()}`,
        responses,
        completedAt: new Date().toISOString(),
        error: error.message,
      }
      localStorage.setItem("asrsData", JSON.stringify(asrsData))

      console.log("Continuing with study - ASRS data saved locally")
      router.push("/task-instructions")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Brain className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">ADHD Screener</h1>
          </div>
          <p className="text-lg text-gray-600">Adult ADHD Self-Report Scale (ASRS)</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Please answer the following questions</CardTitle>
            <p className="text-gray-600">
              Select the response that best describes how you have felt and conducted yourself over the past 6 months.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {asrsQuestions.map((question) => (
              <div key={question.id} className="space-y-4">
                <h3 className="font-medium text-gray-900">
                  Question {question.id}: {question.question}
                </h3>
                <RadioGroup
                  value={responses[question.id] || ""}
                  onValueChange={(value) => handleResponseChange(question.id, value)}
                  className="space-y-3"
                >
                  {responseOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-3">
                      <RadioGroupItem value={option.value} id={`q${question.id}-${option.value}`} />
                      <Label htmlFor={`q${question.id}-${option.value}`} className="text-sm font-normal cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={Object.keys(responses).length !== asrsQuestions.length || isSubmitting}
            className="px-8 py-3"
          >
            {isSubmitting ? "Saving Responses..." : "Submit & Continue"}
          </Button>
        </div>
      </div>
    </div>
  )
}
