"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertTriangle, Loader2, FileText, Users, Shield } from "lucide-react"
import { generateUID, getFirebaseStatusMessage, createParticipant, updateInstructionPageTimes } from "@/lib/firebase"

const Page = () => {
  const [consentGiven, setConsentGiven] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [firebaseStatus, setFirebaseStatus] = useState<{ status: "success" | "error" | "loading"; message: string }>({
    status: "loading",
    message: "Initializing...",
  })
  const router = useRouter()

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0)

    // Generate unique participant ID when page loads
    const uid = generateUID()
    localStorage.setItem("participantUID", uid)
    console.log("Generated participant UID:", uid)

    // Check Firebase status immediately on mount
    const status = getFirebaseStatusMessage()
    setFirebaseStatus(status)
    console.log("Firebase Status on page load:", status)

    // Log instruction page start time
    const participantDocId = localStorage.getItem("participantDocId")
    if (participantDocId) {
      updateInstructionPageTimes(participantDocId, "start")
    }
  }, [])

  const handleContinue = async () => {
    if (consentGiven && !isSubmitting) {
      setIsSubmitting(true)

      try {
        const uid = localStorage.getItem("participantUID") || generateUID()
        console.log("Creating participant with UID:", uid)

        // Create participant document in Firestore (or locally if Firebase fails)
        const participantDocId = await createParticipant(uid)
        console.log("Participant created with ID:", participantDocId)

        // Store consent info in localStorage for the session (minimal)
        localStorage.setItem(
          "participantInfo",
          JSON.stringify({
            uid,
            participantDocId,
            consentTimestamp: Date.now(),
          }),
        )

        // Update info page end time
        await updateInstructionPageTimes(participantDocId, "end")

        console.log("✅ Participant setup completed", { uid, participantDocId })

        // Navigate to next page
        router.push("/adhd-screener")
      } catch (error: any) {
        console.error("Error in participant setup:", error)

        // Create a fallback participant ID and continue
        const fallbackId = `fallback_${Date.now()}`
        localStorage.setItem("participantDocId", fallbackId)

        alert("There was a connection issue, but your data is being saved locally. You can continue with the study.")
        router.push("/adhd-screener")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Research Study Information</h1>
          <p className="text-lg text-gray-600">Measuring The Experience of People With ADHD</p>
        </div>

        {/* Information Sheet */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <FileText className="h-6 w-6 mr-2" />
              Information Sheet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-gray-700">
              Thank you for your interest in taking part in this research study. This information sheet provides details
              about the study, why the research is being conducted, what participating would mean for you and how we
              will use the information you provide.
            </p>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900">Purpose of the research</h3>
              <p className="text-gray-700">
                As part of my dissertation for my MSc Human-Centered Interactive Technologies, this study explores how
                digital interface distractions affect decision-making and task performance, particularly for individuals
                with ADHD. The findings will help inform inclusive interface design principles to make digital
                environments more ADHD-friendly.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Your participation
              </h3>
              <p className="text-gray-700 mb-3">You need to:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Be 18 years or older</li>
                <li>Use a laptop or desktop device (not a mobile phone)</li>
                <li>Have a stable internet connection</li>
                <li>Preferably be fluent in English</li>
              </ul>
              <p className="text-gray-700 mt-4">
                Your participation is completely voluntary. You are free to withdraw at any time, without having to
                provide a reason and without any negative consequences. If you wish to withdraw your data within a
                period of up to one week after participation, you can do so by contacting me (see contact details
                below).
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900">Overview of the study</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>You will complete this study online through a web-based platform hosted online.</li>
                <li>
                  The study consists of:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>A Consent form</li>
                    <li>A short Adult ADHD Self-Report Scale (ASRS) screener (6 questions)</li>
                    <li>
                      Main Task: A simulated e-commerce shopping experience where you will be asked to find and add
                      laptops meeting specific criteria to a shopping cart.
                    </li>
                    <li>A final submission screen confirming your responses.</li>
                  </ul>
                </li>
                <li>
                  During the shopping task, you may see pop-up messages or notifications. These are intentional and part
                  of the study.
                </li>
                <li>
                  You will not be asked to share personal information beyond what is necessary for research purposes.
                </li>
                <li>The entire study will take about 10 minutes to complete.</li>
                <li>
                  No video or audio recording will take place. The system will only record interaction data such as:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>Time taken to complete the task</li>
                    <li>Clicks and filter usage</li>
                    <li>Products added to the cart</li>
                    <li>Responses to the ADHD screener</li>
                  </ul>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Data Protection & Privacy
              </h3>
              <p className="text-gray-700 mb-3">
                There are no expected disadvantages or risks in taking part. Standard Prolific platform payment applies
                for your participation.
              </p>
              <p className="text-gray-700 mb-3">
                Any personal information, such as name or email, will be kept confidential and stored separately from
                the data set. The data will be anonymised, so you will not be directly identifiable from any reports or
                publications.
              </p>
              <p className="text-gray-700 mb-3">
                In accordance with data protection law, the University of York is the Data Controller for this project.
                This means that the University are responsible for making sure your personal information is kept secure,
                confidential and anonymous. The University will also ensure that the information is only used in the way
                you have been told it will be used. Your information will only be accessible in its original form to
                myself [Rohail Wasim], and my supervisor Joe Cutting.
              </p>
              <p className="text-gray-700">
                Information from this study will be stored on University of York's cloud storage systems. The
                University's cloud storage solution is provided by Google, which means that data can be located at any
                of Google's globally spread data centres. The University has data protection compliant arrangements in
                place with this provider. The University processes personal data for research purposes under Article 6
                (1) (e) of the General Data Protection Regulation (GDPR). The data will be kept until the final marks
                are formally approved for the module.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900">Contact Information</h3>
              <p className="text-gray-700">
                You are very welcome to ask any questions you have about this research, at any stage before, during or
                after the study. You can contact me Rohail Wasim (jpn521@york.ac.uk) or my supervisor Joe Cutting
                (joe.cutting@york.ac.uk) with any questions or concerns about this study.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Consent Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">Informed Consent Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-gray-700">
              Thank you very much for offering to take part in this study. Before you participate, please complete the
              following:
            </p>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900">Consent required to take part in this study:</h3>
              <p className="text-gray-700 mb-4">
                I confirm that I have read and understood the information sheet explaining this study and have had an
                opportunity to ask questions about it. I also confirm that I am over 18.
              </p>
              <p className="text-gray-700 mb-4">
                As explained in the information sheet, I understand that my participation is voluntary and I am free to
                withdraw at any time. I also understand that my personal information is confidential and that my data
                will be anonymised.
              </p>

              <div className="flex items-center space-x-2 mb-4">
                <Checkbox
                  id="consent"
                  checked={consentGiven}
                  onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                />
                <label
                  htmlFor="consent"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Based on the above, I agree to take part in this research activity.
                </label>
              </div>

              <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Continue Button */}
        <div className="text-center">
          <Button size="lg" onClick={handleContinue} disabled={!consentGiven || isSubmitting} className="px-8 py-3">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Participant...
              </>
            ) : (
              "Continue to ADHD Screener"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Page
