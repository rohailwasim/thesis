"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Smile, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { updateUEQSData, getParticipantDocId, type ParticipantData } from "@/lib/firebase"

interface UEQSItem {
  id: keyof ParticipantData["ueqSResponses"]
  positive: string
  negative: string
}

const ueqsItems: UEQSItem[] = [
  { id: "efficient", negative: "inefficient", positive: "efficient" },
  { id: "clear", negative: "confusing", positive: "clear" },
  { id: "supportive", negative: "unsupportive", positive: "supportive" },
  { id: "easy", negative: "difficult", positive: "easy" },
  { id: "exciting", negative: "boring", positive: "exciting" },
  { id: "inventive", negative: "conventional", positive: "inventive" },
  { id: "captivating", negative: "dull", positive: "captivating" },
  { id: "pleasant", negative: "unpleasant", positive: "pleasant" },
]

const responseScale = [1, 2, 3, 4, 5, 6, 7] // 7-point Likert scale

export default function UEQSPage() {
  const [responses, setResponses] = useState<Record<keyof ParticipantData["ueqSResponses"], number | undefined>>(
    {} as Record<keyof ParticipantData["ueqSResponses"], number | undefined>,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleResponseChange = (itemId: keyof ParticipantData["ueqSResponses"], value: string) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: Number.parseInt(value),
    }))
  }

  const handleSubmit = async () => {
    const allAnswered = ueqsItems.every((item) => responses[item.id] !== undefined)
    if (!allAnswered) {
      alert("Please answer all questions before continuing.")
      return
    }

    setIsSubmitting(true)

    try {
      const participantDocId = getParticipantDocId()
      if (!participantDocId) {
        throw new Error("Participant document ID not found for UEQ-S submission.")
      }

      await updateUEQSData(participantDocId, responses as ParticipantData["ueqSResponses"])

      console.log("✅ UEQ-S data saved successfully")
      router.push("/data-analysis")
    } catch (error: any) {
      console.error("Error saving UEQ-S data:", error)
      alert("There was an issue saving your responses. Data will be saved locally. Please continue.")
      // Fallback to local storage if Firebase fails
      const localUEQSData = {
        participantDocId: getParticipantDocId() || `local_ueqs_${Date.now()}`,
        responses,
        completedAt: new Date().toISOString(),
        error: error.message,
      }
      localStorage.setItem("ueqsData", JSON.stringify(localUEQSData))
      router.push("/data-analysis")
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
            <Smile className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">User Experience Questionnaire</h1>
          </div>
          <p className="text-lg text-gray-600">Short Form (UEQ-S)</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Please rate your experience with the shopping website</CardTitle>
            <p className="text-gray-600">
              For each pair of terms, select the option that best describes your experience.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {ueqsItems.map((item) => (
              <div key={item.id} className="space-y-4">
                <div className="flex items-center justify-between text-sm font-medium text-gray-900">
                  <span>{item.negative}</span>
                  <span>{item.positive}</span>
                </div>
                <RadioGroup
                  value={responses[item.id]?.toString() || ""}
                  onValueChange={(value) => handleResponseChange(item.id, value)}
                  className="flex justify-between w-full"
                >
                  {responseScale.map((scaleValue) => (
                    <div key={scaleValue} className="flex flex-col items-center space-y-1">
                      <RadioGroupItem value={scaleValue.toString()} id={`${item.id}-${scaleValue}`} />
                      <Label htmlFor={`${item.id}-${scaleValue}`} className="text-xs font-normal cursor-pointer">
                        {scaleValue}
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
            disabled={!ueqsItems.every((item) => responses[item.id] !== undefined) || isSubmitting}
            className="px-8 py-3"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Responses...
              </>
            ) : (
              "Submit & View Results"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
