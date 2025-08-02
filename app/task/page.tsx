"use client"

import React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Star, Truck, Monitor, ShoppingCart, Info, Plus, Minus, Gift, Zap, Bell, RotateCcw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import {
  completeTask,
  logFilterCommit,
  logCartChange,
  logDistractionInteraction,
  logFocusEvent,
  getParticipantDocId,
} from "@/lib/firebase"
import laptops from "@/data/laptops"

interface Laptop {
  id: number
  title: string
  price: number
  rating: number
  deliveryTime: string
  ram: number
  image: string
  brand: string
  processor: string
  storage: string
  screenSize: string
  weight: string
}

const taskCriteria = [
  {
    id: 1,
    description: "Select 1 laptop under $1000, 16GB+ RAM, 4+ stars, Intel processor, under 3.5 lbs",
    check: (laptop: Laptop) =>
      laptop.price < 1000 &&
      laptop.ram >= 16 &&
      laptop.rating >= 4.0 &&
      laptop.processor.includes("Intel") &&
      Number.parseFloat(laptop.weight) < 3.5,
  },
  {
    id: 2,
    description: "Select 1 laptop under $500, 8GB RAM, 3.5+ rating, 15.6 inch screen, 256GB+ storage",
    check: (laptop: Laptop) =>
      laptop.price < 500 &&
      laptop.ram >= 8 &&
      laptop.rating >= 3.5 &&
      laptop.screenSize === "15.6 inch" &&
      (laptop.storage.includes("256GB") || laptop.storage.includes("512GB") || laptop.storage.includes("1TB")),
  },
  {
    id: 3,
    description: "Select 1 laptop from $1000-$2000, 32GB RAM, 4.5+ rating, AMD processor, 14 inch screen",
    check: (laptop: Laptop) =>
      laptop.price >= 1000 &&
      laptop.price <= 2000 &&
      laptop.ram >= 32 &&
      laptop.rating >= 4.5 &&
      laptop.processor.includes("AMD") &&
      laptop.screenSize === "14 inch",
  },
]

const distractionModals = [
  {
    id: 1,
    title: "🎉 Limited Time Offer!",
    content: "Get 25% off your first purchase when you sign up for our premium membership today!",
    buttons: [
      { text: "Join Premium Now", action: "join_premium" },
      { text: "Maybe Later", action: "dismiss" },
    ],
    icon: Gift,
  },
  {
    id: 2,
    title: "⚡ Flash Sale Alert!",
    content: "Lightning deal on gaming accessories! Only 2 hours left. Don't miss out on these incredible savings!",
    buttons: [
      { text: "Shop Flash Sale", action: "shop_sale" },
      { text: "Not Interested", action: "dismiss" },
    ],
    icon: Zap,
  },
  {
    id: 3,
    title: "🔔 Newsletter Subscription",
    content: "Stay updated with the latest tech deals and product launches. Join over 50,000 subscribers!",
    buttons: [
      { text: "Subscribe Now", action: "subscribe" },
      { text: "Skip", action: "dismiss" },
    ],
    icon: Bell,
  },
  {
    id: 4,
    title: "💳 Extended Warranty Available",
    content: "Protect your investment with our comprehensive 3-year extended warranty. Available for a limited time!",
    buttons: [
      { text: "Learn More", action: "warranty_info" },
      { text: "No Thanks", action: "dismiss" },
    ],
    icon: Info,
  },
  {
    id: 5,
    title: "🚚 Free Shipping Upgrade",
    content: "Upgrade to express shipping for FREE on orders over $500. Offer expires in 30 minutes!",
    buttons: [
      { text: "Upgrade Shipping", action: "upgrade_shipping" },
      { text: "Continue", action: "dismiss" },
    ],
    icon: Truck,
  },
]

export default function TaskPage() {
  const router = useRouter()
  const [startTime] = useState(Date.now())
  const [cartItems, setCartItems] = useState<number[]>([])
  const [filteredLaptops, setFilteredLaptops] = useState<Laptop[]>(laptops)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [participantDocId, setParticipantDocId] = useState<string | null>(null)

  // Filter states (these are for the UI controls)
  const [priceRange, setPriceRange] = useState([0, 3000])
  const [minRating, setMinRating] = useState([0])
  const [selectedDelivery, setSelectedDelivery] = useState<string[]>([])
  const [selectedRAM, setSelectedRAM] = useState<number[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedProcessors, setSelectedProcessors] = useState<string[]>([])
  const [selectedStorage, setSelectedStorage] = useState<string[]>([])
  const [selectedScreenSize, setSelectedScreenSize] = useState<string[]>([])
  const [weightRange, setWeightRange] = useState([0, 10])
  const [sortBy, setSortBy] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")

  // State to hold the *currently applied* filter values for the product list
  // This is what the filtering useEffect will depend on.
  const [appliedFilterSnapshot, setAppliedFilterSnapshot] = useState<any>(null)

  // Ref to store the last *committed* filter state to Firebase for deduplication
  const lastCommittedFilterRef = useRef<any>(null)

  // Distraction states
  const [currentModal, setCurrentModal] = useState<number | null>(null)
  const [modalCount, setModalCount] = useState(0)
  const [modalAppearanceTime, setModalAppearanceTime] = useState<number | null>(null)
  const lastMeaningfulActionTimeRef = useRef<number>(Date.now()) // For recovery latency

  // Cart attempt sequence
  const cartAttemptSequenceRef = useRef(0)

  // Helper to get the current filter state from UI controls
  const getNormalizedFilterState = useCallback(() => {
    // Normalize continuous sliders by bucketing or rounding
    const normalizedPrice = `${priceRange[0]}-${priceRange[1]}`
    const normalizedWeight = `${weightRange[0].toFixed(1)}-${weightRange[1].toFixed(1)}`
    const normalizedRating = minRating[0].toFixed(1)

    return {
      priceRange: normalizedPrice,
      minRating: normalizedRating,
      selectedDelivery: selectedDelivery.sort(),
      selectedRAM: selectedRAM.sort(),
      selectedBrands: selectedBrands.sort(),
      selectedProcessors: selectedProcessors.sort(),
      selectedStorage: selectedStorage.sort(),
      selectedScreenSize: selectedScreenSize.sort(),
      weightRange: normalizedWeight,
      sortBy,
      searchTerm,
    }
  }, [
    priceRange,
    minRating,
    selectedDelivery,
    selectedRAM,
    selectedBrands,
    selectedProcessors,
    selectedStorage,
    selectedScreenSize,
    weightRange,
    sortBy,
    searchTerm,
  ])

  // Initialize participant ID and scroll to top
  useEffect(() => {
    window.scrollTo(0, 0)

    const docId = getParticipantDocId()
    setParticipantDocId(docId)
    console.log("Task page loaded with participant ID:", docId)

    // Set initial meaningful action time
    lastMeaningfulActionTimeRef.current = Date.now()

    // Initialize appliedFilterSnapshot and lastCommittedFilterRef on mount
    const initialFilterState = getNormalizedFilterState()
    setAppliedFilterSnapshot(initialFilterState)
    lastCommittedFilterRef.current = initialFilterState // Initial state is considered committed

    // Add focus/blur event listeners
    const handleFocus = () => {
      if (docId) logFocusEvent(docId, "focus")
      lastMeaningfulActionTimeRef.current = Date.now()
    }
    const handleBlur = () => {
      if (docId) logFocusEvent(docId, "blur")
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("blur", handleBlur)

    return () => {
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("blur", handleBlur)
    }
  }, [participantDocId, getNormalizedFilterState])

  // Blocking modal every 20 seconds
  useEffect(() => {
    const modalTimer = setInterval(() => {
      const randomModal = Math.floor(Math.random() * distractionModals.length)
      setCurrentModal(randomModal)
      setModalCount((prev) => prev + 1)
      setModalAppearanceTime(Date.now()) // Record appearance time
    }, 20000)

    return () => clearInterval(modalTimer)
  }, [])

  // Filtering logic - now depends only on appliedFilterSnapshot
  useEffect(() => {
    if (!appliedFilterSnapshot) {
      // This should only happen on the very first render before initialFilterState is set
      setFilteredLaptops(laptops)
      return
    }

    const {
      priceRange: currentPriceRange,
      minRating: currentMinRating,
      selectedDelivery: currentSelectedDelivery,
      selectedRAM: currentSelectedRAM,
      selectedBrands: currentSelectedBrands,
      selectedProcessors: currentSelectedProcessors,
      selectedStorage: currentSelectedStorage,
      selectedScreenSize: currentSelectedScreenSize,
      weightRange: currentWeightRange,
      sortBy: currentSortBy,
      searchTerm: currentSearchTerm,
    } = appliedFilterSnapshot

    const [minPrice, maxPrice] = currentPriceRange.split("-").map(Number)
    const [minWeight, maxWeight] = currentWeightRange.split("-").map(Number)
    const minRatingVal = Number.parseFloat(currentMinRating)

    const filtered = laptops.filter((laptop) => {
      const priceMatch = laptop.price >= minPrice && laptop.price <= maxPrice
      const ratingMatch = laptop.rating >= minRatingVal
      const deliveryMatch =
        currentSelectedDelivery.length === 0 || currentSelectedDelivery.includes(laptop.deliveryTime)
      const ramMatch = currentSelectedRAM.length === 0 || currentSelectedRAM.includes(laptop.ram)
      const brandMatch = currentSelectedBrands.length === 0 || currentSelectedBrands.includes(laptop.brand)
      const processorMatch =
        currentSelectedProcessors.length === 0 || currentSelectedProcessors.includes(laptop.processor)
      const storageMatch = currentSelectedStorage.length === 0 || currentSelectedStorage.includes(laptop.storage)
      const screenMatch =
        currentSelectedScreenSize.length === 0 || currentSelectedScreenSize.includes(laptop.screenSize)
      const weightMatch = Number.parseFloat(laptop.weight) >= minWeight && Number.parseFloat(laptop.weight) <= maxWeight
      const searchMatch =
        currentSearchTerm === "" ||
        laptop.title.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
        laptop.brand.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
        laptop.processor.toLowerCase().includes(currentSearchTerm.toLowerCase())

      return (
        priceMatch &&
        ratingMatch &&
        deliveryMatch &&
        ramMatch &&
        brandMatch &&
        processorMatch &&
        storageMatch &&
        screenMatch &&
        weightMatch &&
        searchMatch
      )
    })

    // Apply sorting
    if (currentSortBy === "price_low") {
      filtered.sort((a, b) => a.price - b.price)
    } else if (currentSortBy === "price_high") {
      filtered.sort((a, b) => b.price - a.price)
    } else if (currentSortBy === "rating") {
      filtered.sort((a, b) => b.rating - a.rating)
    } else if (currentSortBy === "name") {
      filtered.sort((a, b) => a.title.localeCompare(b.title))
    }

    setFilteredLaptops(filtered)
  }, [appliedFilterSnapshot]) // Only re-run when appliedFilterSnapshot changes

  const handleApplyFilters = async () => {
    const currentFilterState = getNormalizedFilterState()
    // Deduplicate: only log and apply if the filter state has actually changed from the last committed state
    if (JSON.stringify(currentFilterState) !== JSON.stringify(lastCommittedFilterRef.current)) {
      setAppliedFilterSnapshot(currentFilterState) // Update the snapshot that triggers filtering
      lastCommittedFilterRef.current = currentFilterState // Update the last committed state for deduplication
      if (participantDocId) {
        await logFilterCommit(participantDocId, currentFilterState)
      }
      lastMeaningfulActionTimeRef.current = Date.now() // Meaningful action
    }
  }

  const resetFilters = () => {
    // Reset individual UI filter states
    setPriceRange([0, 3000])
    setMinRating([0])
    setSelectedDelivery([])
    setSelectedRAM([])
    setSelectedBrands([])
    setSelectedProcessors([])
    setSelectedStorage([])
    setSelectedScreenSize([])
    setWeightRange([0, 10])
    setSortBy("")
    setSearchTerm("")

    // Immediately apply these reset filters and log them
    // This will call getNormalizedFilterState with the reset values
    // and then handleApplyFilters will log it if it's different from the last committed state.
    handleApplyFilters() // This will apply the reset state and log if different
  }

  const handleAddToCart = async (laptopId: number) => {
    if (cartItems.length >= 3) {
      return // Cart limit reached
    }

    cartAttemptSequenceRef.current += 1
    setCartItems((prev) => [...prev, laptopId])
    if (participantDocId) {
      await logCartChange(participantDocId, laptopId, "add", cartAttemptSequenceRef.current)
    }
    lastMeaningfulActionTimeRef.current = Date.now() // Meaningful action
  }

  const handleRemoveFromCart = async (laptopId: number) => {
    cartAttemptSequenceRef.current += 1
    setCartItems((prev) => prev.filter((id) => id !== laptopId))
    if (participantDocId) {
      await logCartChange(participantDocId, laptopId, "remove", cartAttemptSequenceRef.current)
    }
    lastMeaningfulActionTimeRef.current = Date.now() // Meaningful action
  }

  const handleModalAction = async (action: string, modalId: number) => {
    const dismissalTime = Date.now()
    const responseTime = modalAppearanceTime ? dismissalTime - modalAppearanceTime : 0
    const recoveryLatency = dismissalTime - lastMeaningfulActionTimeRef.current // Time from dismissal to last meaningful action

    if (participantDocId && modalAppearanceTime) {
      await logDistractionInteraction(
        participantDocId,
        modalId,
        action,
        modalAppearanceTime,
        dismissalTime,
        responseTime,
        recoveryLatency,
      )
    }

    setCurrentModal(null)
    setModalAppearanceTime(null)
    lastMeaningfulActionTimeRef.current = Date.now() // Meaningful action after modal dismissal
  }

  const validateSelection = (): {
    errors: string[]
    finalCartItems: { laptopId: number; matchedCriteria: boolean }[]
  } => {
    const errors: string[] = []
    const selectedLaptops = laptops.filter((laptop) => cartItems.includes(laptop.id))
    const finalCartItems: { laptopId: number; matchedCriteria: boolean }[] = []

    if (selectedLaptops.length !== 3) {
      errors.push(`You must select exactly 3 laptops (currently selected: ${selectedLaptops.length})`)
    }

    const criteriaMetFlags = {
      1: false,
      2: false,
      3: false,
    }

    selectedLaptops.forEach((laptop) => {
      let laptopMatchedAnyCriteria = false
      taskCriteria.forEach((criteria) => {
        if (criteria.check(laptop)) {
          criteriaMetFlags[criteria.id as 1 | 2 | 3] = true
          laptopMatchedAnyCriteria = true
        }
      })
      finalCartItems.push({ laptopId: laptop.id, matchedCriteria: laptopMatchedAnyCriteria })
    })

    if (!criteriaMetFlags[1]) {
      errors.push("Missing: 1 laptop under $1000, 16GB+ RAM, 4+ stars, Intel processor, under 3.5 lbs")
    }
    if (!criteriaMetFlags[2]) {
      errors.push("Missing: 1 laptop under $500, 8GB RAM, 3.5+ rating, 15.6 inch screen, 256GB+ storage")
    }
    if (!criteriaMetFlags[3]) {
      errors.push("Missing: 1 laptop from $1000-$2000, 32GB RAM, 4.5+ rating, AMD processor, 14 inch screen")
    }

    return { errors, finalCartItems }
  }

  const handleSubmit = async () => {
    const { errors, finalCartItems } = validateSelection()
    setValidationErrors(errors)

    if (errors.length === 0) {
      try {
        const totalTaskDuration = Date.now() - startTime

        // Retrieve all logs from local storage for aggregate calculations
        const localParticipantData = JSON.parse(localStorage.getItem("participantData") || "{}")
        const allDistractionInteractions = localParticipantData.distractionInteractions || []
        const allCartChangeLogs = localParticipantData.cartChangeLog || []

        // Calculate convenience metrics
        const distractionCount = allDistractionInteractions.length
        const recoveryLatencies = allDistractionInteractions
          .filter((d: any) => d.recoveryLatency !== undefined)
          .map((d: any) => d.recoveryLatency)
        const averageRecoveryLatency =
          recoveryLatencies.length > 0
            ? recoveryLatencies.reduce((sum: number, val: number) => sum + val, 0) / recoveryLatencies.length
            : 0

        const cartAttemptCount = allCartChangeLogs.length // This is more accurate than cartAttemptSequenceRef.current if there were local storage issues

        // Prepare final filter snapshot
        const finalFilterSnapshot = {
          filters: getNormalizedFilterState(),
          timestamp: new Date().toISOString(),
          type: "final_snapshot" as const,
        }

        // Complete task in Firebase
        if (participantDocId) {
          await completeTask(participantDocId, {
            finalCartItems,
            validationErrors: errors,
            totalTaskDuration,
            taskCompleted: true,
            finalFilters: finalFilterSnapshot,
            distractionCount,
            averageRecoveryLatency: Number.parseFloat(averageRecoveryLatency.toFixed(2)),
            cartAttemptCount,
          })
          console.log("✅ Task completed and saved to Firebase")
        }

        // Save locally for analysis page (always do this)
        const completeTaskData = {
          participantId: participantDocId || `local_${Date.now()}`,
          taskStartTime: localStorage.getItem("taskStartTime"),
          taskEndTime: Date.now(),
          totalTimeSpent: totalTaskDuration,
          selectedLaptops: cartItems, // Keep for local display if needed
          selectedLaptopDetails: laptops.filter((laptop) => cartItems.includes(laptop.id)), // Keep for local display
          finalCartItems, // New structured field
          totalModalsShown: distractionCount, // Renamed from totalModalsShown to distractionCount for consistency
          averageRecoveryLatency: Number.parseFloat(averageRecoveryLatency.toFixed(2)),
          cartAttemptCount,
          validationErrors: errors,
          taskCompleted: true,
          finalFilters: finalFilterSnapshot,
          completedAt: new Date().toISOString(),
        }

        localStorage.setItem("taskCompletionData", JSON.stringify(completeTaskData))

        // Redirect to UEQ-S page
        router.push("/ueq-s")
      } catch (error) {
        console.error("Error in task submission:", error)

        // Still allow progression - data is saved locally
        alert("There was an issue saving final task data to Firebase. Data saved locally. Please continue.")
        router.push("/ueq-s")
      }
    }
  }

  const deliveryOptions = ["1-2 days", "2-3 days", "2-4 days", "3-4 days", "3-5 days", "1-3 days"]
  const ramOptions = [8, 16, 18, 32]
  const brandOptions = ["Apple", "Dell", "HP", "Lenovo", "ASUS", "Acer", "Microsoft"]
  const processorOptions = [
    "Intel i3",
    "Intel i5",
    "Intel i7",
    "AMD Ryzen 3",
    "AMD Ryzen 5",
    "AMD Ryzen 7",
    "AMD Ryzen 9",
    "M3 Pro",
  ]
  const storageOptions = ["256GB SSD", "512GB SSD", "1TB SSD"]
  const screenSizeOptions = ["13.3 inch", "13.4 inch", "13.5 inch", "14 inch", "15.6 inch", "16 inch"]

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Monitor className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">TechMart</span>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant="secondary" className="text-sm">
                  Research Study Active
                </Badge>
                <Button variant="outline" size="sm">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Cart ({cartItems.length}/3)
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">
            {/* Sidebar Filters */}
            <div className="w-80 flex-shrink-0 space-y-6">
              {/* Task Instructions */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-blue-800 text-lg">Your Task</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-blue-700 font-medium mb-3">
                    Find and add exactly 3 laptops to your cart that meet these criteria, then click Submit Task:
                  </p>
                  {taskCriteria.map((criteria) => (
                    <div key={criteria.id} className="text-xs text-blue-600 p-2 bg-white rounded border">
                      <div className="flex items-start">
                        <span className="font-bold mr-1">{criteria.id}.</span>
                        <span>{criteria.description}</span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
                    <strong>Instructions:</strong> Use filters and search to find laptops. Click "Add to Cart" for each
                    laptop that meets the criteria. You can remove items from your cart if needed. Once you have exactly
                    3 correct laptops, click "Submit Task".
                  </div>
                </CardContent>
              </Card>

              {/* Cart Summary */}
              {cartItems.length > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-green-800 text-lg">Your Cart ({cartItems.length}/3)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {cartItems.map((laptopId) => {
                      const laptop = laptops.find((l) => l.id === laptopId)
                      return laptop ? (
                        <div
                          key={laptopId}
                          className="flex items-center justify-between p-2 bg-white rounded border text-xs"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-green-900 truncate">{laptop.title}</div>
                            <div className="text-green-700">
                              ${laptop.price} • {laptop.ram}GB RAM
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromCart(laptopId)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-100"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : null
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Enhanced Filters */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Search & Filters</CardTitle>
                  <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs bg-transparent">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Search */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Search</label>
                    <Input
                      placeholder="Search laptops..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                      }}
                    />
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Sort By</label>
                    <Select
                      value={sortBy}
                      onValueChange={(value) => {
                        setSortBy(value)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sorting..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price_low">Price: Low to High</SelectItem>
                        <SelectItem value="price_high">Price: High to Low</SelectItem>
                        <SelectItem value="rating">Rating: High to Low</SelectItem>
                        <SelectItem value="name">Name: A to Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Filter - Fixed slider */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Price Range</label>
                    <Slider
                      value={priceRange}
                      onValueChange={(value) => {
                        setPriceRange(value)
                      }}
                      max={3000}
                      min={0}
                      step={50}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>${priceRange[0]}</span>
                      <span>${priceRange[1]}</span>
                    </div>
                  </div>

                  {/* Rating Filter - Fixed slider */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Minimum Rating</label>
                    <Slider
                      value={minRating}
                      onValueChange={(value) => {
                        setMinRating(value)
                      }}
                      max={5}
                      min={0}
                      step={0.2}
                      className="w-full"
                    />
                    <div className="flex items-center mt-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-gray-500 ml-1">{minRating[0].toFixed(1)}+</span>
                    </div>
                  </div>

                  {/* Weight Range - Fixed slider */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Weight Range (lbs)</label>
                    <Slider
                      value={weightRange}
                      onValueChange={(value) => {
                        setWeightRange(value)
                      }}
                      max={10}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{weightRange[0]} lbs</span>
                      <span>{weightRange[1]} lbs</span>
                    </div>
                  </div>

                  {/* Brand Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Brand</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {brandOptions.map((brand) => (
                        <div key={brand} className="flex items-center space-x-2">
                          <Checkbox
                            id={`brand-${brand}`}
                            checked={selectedBrands.includes(brand)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedBrands((prev) => [...prev, brand])
                              } else {
                                setSelectedBrands((prev) => prev.filter((b) => b !== brand))
                              }
                            }}
                          />
                          <label htmlFor={`brand-${brand}`} className="text-sm">
                            {brand}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Processor Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Processor</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {processorOptions.map((processor) => (
                        <div key={processor} className="flex items-center space-x-2">
                          <Checkbox
                            id={`processor-${processor}`}
                            checked={selectedProcessors.includes(processor)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProcessors((prev) => [...prev, processor])
                              } else {
                                setSelectedProcessors((prev) => prev.filter((p) => p !== processor))
                              }
                            }}
                          />
                          <label htmlFor={`processor-${processor}`} className="text-sm">
                            {processor}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RAM Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">RAM</label>
                    <div className="space-y-2">
                      {ramOptions.map((ram) => (
                        <div key={ram} className="flex items-center space-x-2">
                          <Checkbox
                            id={`ram-${ram}`}
                            checked={selectedRAM.includes(ram)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRAM((prev) => [...prev, ram])
                              } else {
                                setSelectedRAM((prev) => prev.filter((r) => r !== ram))
                              }
                            }}
                          />
                          <label htmlFor={`ram-${ram}`} className="text-sm">
                            {ram}GB
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Storage Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Storage</label>
                    <div className="space-y-2 max-h-24 overflow-y-auto">
                      {storageOptions.map((storage) => (
                        <div key={storage} className="flex items-center space-x-2">
                          <Checkbox
                            id={`storage-${storage}`}
                            checked={selectedStorage.includes(storage)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStorage((prev) => [...prev, storage])
                              } else {
                                setSelectedStorage((prev) => prev.filter((s) => s !== storage))
                              }
                            }}
                          />
                          <label htmlFor={`storage-${storage}`} className="text-sm">
                            {storage}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Screen Size Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Screen Size</label>
                    <div className="space-y-2 max-h-24 overflow-y-auto">
                      {screenSizeOptions.map((size) => (
                        <div key={size} className="flex items-center space-x-2">
                          <Checkbox
                            id={`screen-${size}`}
                            checked={selectedScreenSize.includes(size)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedScreenSize((prev) => [...prev, size])
                              } else {
                                setSelectedScreenSize((prev) => prev.filter((s) => s !== size))
                              }
                            }}
                          />
                          <label htmlFor={`screen-${size}`} className="text-sm">
                            {size}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Speed Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Delivery Speed</label>
                    <div className="space-y-2">
                      {deliveryOptions.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`delivery-${option}`}
                            checked={selectedDelivery.includes(option)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDelivery((prev) => [...prev, option])
                              } else {
                                setSelectedDelivery((prev) => prev.filter((d) => d !== option))
                              }
                            }}
                          />
                          <label htmlFor={`delivery-${option}`} className="text-sm">
                            {option}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleApplyFilters} className="w-full">
                    <Check className="h-4 w-4 mr-2" /> Apply Filters
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Laptops</h1>
                <p className="text-gray-600">
                  Showing {filteredLaptops.length} of {laptops.length} products
                </p>
                {cartItems.length > 0 && (
                  <Badge variant="outline" className="mt-2">
                    {cartItems.length}/3 laptops in cart
                  </Badge>
                )}
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {filteredLaptops.map((laptop) => {
                  const isInCart = cartItems.includes(laptop.id)
                  return (
                    <Card
                      key={laptop.id}
                      className={`hover:shadow-lg transition-shadow ${isInCart ? "ring-2 ring-blue-500" : ""}`}
                    >
                      <CardContent className="p-4">
                        <img
                          src={laptop.image || "/placeholder.svg"}
                          alt={laptop.title}
                          className="w-full h-48 object-cover rounded-md mb-4"
                        />

                        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{laptop.title}</h3>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-blue-600">${laptop.price.toLocaleString()}</span>
                            <div className="flex items-center">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm text-gray-600 ml-1">{laptop.rating}</span>
                            </div>
                          </div>

                          <div className="text-sm text-gray-600 space-y-1">
                            <div>
                              <strong>RAM:</strong> {laptop.ram}GB
                            </div>
                            <div>
                              <strong>Processor:</strong> {laptop.processor}
                            </div>
                            <div>
                              <strong>Storage:</strong> {laptop.storage}
                            </div>
                            <div>
                              <strong>Screen:</strong> {laptop.screenSize}
                            </div>
                            <div>
                              <strong>Weight:</strong> {laptop.weight}
                            </div>
                          </div>

                          <div className="flex items-center text-sm text-gray-600">
                            <Truck className="h-4 w-4 mr-1" />
                            <span>{laptop.deliveryTime}</span>
                          </div>
                        </div>

                        {isInCart ? (
                          <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => handleRemoveFromCart(laptop.id)}
                          >
                            <Minus className="h-4 w-4 mr-2" />
                            Remove from Cart
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            className="w-full"
                            onClick={() => handleAddToCart(laptop.id)}
                            disabled={cartItems.length >= 3}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Submit Button */}
              <div className="text-center">
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
                  onClick={handleSubmit}
                >
                  Submit Task ({cartItems.length}/3 selected)
                </Button>

                {/* Validation Errors - moved here */}
                {validationErrors.length > 0 && (
                  <Alert className="mt-6 border-red-200 bg-red-50 max-w-2xl mx-auto">
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium text-red-800 mb-2">Please fix the following issues:</p>
                        {validationErrors.map((error, index) => (
                          <div key={index} className="text-red-700">
                            • {error}
                          </div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Blocking Modal Distractions */}
        {currentModal !== null && (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                // User closed modal via X button or escape
                handleModalAction("dismiss_x_button", currentModal)
              }
            }}
          >
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  {React.createElement(distractionModals[currentModal].icon, { className: "h-5 w-5 mr-2" })}
                  {distractionModals[currentModal].title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p>{distractionModals[currentModal].content}</p>
                <div className="flex space-x-2">
                  {distractionModals[currentModal].buttons.map((button, index) => (
                    <Button
                      key={index}
                      className={index === 0 ? "flex-1" : ""}
                      variant={index === 0 ? "default" : "outline"}
                      onClick={() => handleModalAction(button.action, currentModal)}
                    >
                      {button.text}
                    </Button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  )
}
