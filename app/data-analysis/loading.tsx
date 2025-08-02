import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="text-lg font-medium text-gray-700">Loading data analysis...</p>
        <p className="text-sm text-gray-500">This might take a moment as we process your results.</p>
      </div>
    </div>
  )
}
