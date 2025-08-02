"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lightbulb, ArrowRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { updateTaskStart, getParticipantDocId } from "@/lib/firebase"

export default function TaskInstructions() {
  const router = useRouter()
  const [isStartingTask, setIsStartingTask] = useState(false)

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0)
  }, [])

  const handleStartTask = async () => {
    setIsStartingTask(true)
    try {
      const participantDocId = getParticipantDocId()
      if (participantDocId) {
        await updateTaskStart(participantDocId)
        localStorage.setItem("taskStartTime", Date.now().toString())
        console.log("✅ Task start time recorded.")
      } else {
        console.warn("No participant document ID found, task start time not recorded to Firebase.")
        localStorage.setItem("taskStartTime", Date.now().toString()) // Still record locally
      }
      router.push("/task")
    } catch (error) {
      console.error("Error starting task:", error)
      alert("There was an issue recording the task start. Your data will be saved locally. Please continue.")
      localStorage.setItem("taskStartTime", Date.now().toString()) // Still record locally
      router.push("/task")
    } finally {
      setIsStartingTask(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Lightbulb className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Task Instructions</h1>
          </div>
          <p className="text-lg text-gray-600">Please read carefully before starting the task.</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Shopping Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-gray-700">
            <p>
              You will be presented with a simulated e-commerce website where you need to find and add specific laptops
              to your shopping cart. Your goal is to select exactly **3 laptops** that meet the criteria provided on the
              task page.
            </p>

            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Key Instructions:</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  **Read the Criteria:** On the next page, you will see a "Your Task" card in the sidebar. This card
                  will list the exact specifications for the 3 laptops you need to find.
                </li>
                <li>
                  **Use Filters and Search:** The website provides various filters (e.g., price, RAM, brand, processor)
                  and a search bar to help you narrow down the product list. Utilize these tools efficiently.
                </li>
                <li>
                  **Add to Cart:** Once you identify a laptop that meets one of the criteria, click the "Add to Cart"
                  button for that product. You can only have a maximum of 3 items in your cart.
                </li>
                <li>
                  **Review Your Cart:** Your selected items will appear in a "Your Cart" summary in the sidebar. You can
                  remove items from your cart if you make a mistake or change your mind.
                </li>
                <li>
                  **Distractions:** During the task, you may encounter occasional pop-up messages or notifications.
                  These are intentional and part of the study. Please interact with them as you normally would.
                </li>
                <li>
                  **Submit Task:** Once you have exactly 3 laptops in your cart that collectively meet **all** the
                  specified criteria, click the "Submit Task" button at the bottom of the page. The system will validate
                  your selection.
                </li>
              </ul>
            </div>

            <p className="font-semibold text-gray-800">
              Your performance will be measured by the accuracy of your selection and the time taken to complete the
              task.
            </p>
            <p className="text-sm text-gray-600">
              Remember, there is no "right" or "wrong" way to interact with the distractions. Just proceed as you
              normally would.
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button size="lg" onClick={handleStartTask} disabled={isStartingTask} className="px-8 py-3">
            {isStartingTask ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Task...
              </>
            ) : (
              <>
                Start Shopping Task <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
