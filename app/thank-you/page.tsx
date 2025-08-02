"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function ThankYouPage() {
  const router = useRouter()

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0)
  }, [])

  const handleGoHome = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900">Thank You for Participating!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg text-gray-700">
              Your participation in this research study is greatly appreciated. Your responses and interactions will
              provide valuable insights for understanding digital interface distractions and their impact on
              decision-making.
            </p>
            <p className="text-md text-gray-600">You can now close this tab or return to the study's starting page.</p>
            <div className="flex flex-col space-y-4">
              <Button size="lg" onClick={handleGoHome} className="px-8 py-3">
                Return to Start Page
              </Button>
              {/* Example for Prolific redirect - replace with actual Prolific completion URL */}
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  window.open("https://app.prolific.com/submissions/complete?cc=YOUR_COMPLETION_CODE", "_blank")
                }
                className="px-8 py-3"
              >
                Complete on Prolific <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
