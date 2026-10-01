import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Search,
  Store,
  MapPin,
  Phone,
  User,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Truck,
  CreditCard,
  ShoppingBag,
  Info,
  Edit2,
  Check,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react"
import { adminAPI, restaurantAPI } from "@food/api"
import { toast } from "sonner"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Badge } from "@food/components/ui/badge"
import { normalizeImageUrl } from "@food/utils/common"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"

const resolveRestaurantImage = (restaurant) => {
  if (!restaurant) return ""
  const profile =
    typeof restaurant.profileImage === "string"
      ? restaurant.profileImage
      : restaurant.profileImage?.url || restaurant.profileImageUrl?.url
  if (profile) return normalizeImageUrl(profile)

  const logo = typeof restaurant.logo === "string" ? restaurant.logo : restaurant.logo?.url
  if (logo) return normalizeImageUrl(logo)

  if (Array.isArray(restaurant.coverImages) && restaurant.coverImages.length > 0) {
    const firstCover = restaurant.coverImages.find(Boolean)
    const coverUrl = typeof firstCover === "string" ? firstCover : firstCover?.url
    if (coverUrl) return normalizeImageUrl(coverUrl)
  }

  if (Array.isArray(restaurant.menuImages) && restaurant.menuImages.length > 0) {
    const firstMenu = restaurant.menuImages.find(Boolean)
    const menuUrl = typeof firstMenu === "string" ? firstMenu : firstMenu?.url
    if (menuUrl) return normalizeImageUrl(menuUrl)
  }

  const otherImg = restaurant.restaurantImage || restaurant.image
  if (otherImg) return normalizeImageUrl(typeof otherImg === "string" ? otherImg : otherImg?.url)

  return ""
}

const formatINR = (value, digits = 0) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  })}`

const STEPS = [
  { id: 1, title: "Select Restaurant", icon: Store },
  { id: 2, title: "Select Menu Items", icon: ShoppingBag },
  { id: 3, title: "Customer & Address", icon: User },
  { id: 4, title: "Delivery Charge", icon: Truck },
  { id: 5, title: "Review & Place Order", icon: CheckCircle },
]

export default function NewOfflineOrderPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)

  // STEP 1: Restaurants state
  const [restaurants, setRestaurants] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [restaurantSearch, setRestaurantSearch] = useState("")
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)

  // STEP 2: Menu & Items state
  const [menuSections, setMenuSections] = useState([])
  const [loadingMenu, setLoadingMenu] = useState(false)
  const [menuSearch, setMenuSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [cart, setCart] = useState({}) // { [cartKey]: { item, variant, quantity, price } }

  // STEP 3: Customer Details state
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    houseFlat: "",
    area: "",
    landmark: "",
    city: "",
    state: "Maharashtra",
    pincode: "",
    lat: "",
    lng: "",
  })

  // STEP 4: Delivery Charge state
  const [calculatingFee, setCalculatingFee] = useState(false)
  const [autoCalculatedFee, setAutoCalculatedFee] = useState(null)
  const [distanceKm, setDistanceKm] = useState(null)
  const [overrideDeliveryFee, setOverrideDeliveryFee] = useState(false)
  const [customDeliveryFee, setCustomDeliveryFee] = useState("")
  const [deliveryCalculationError, setDeliveryCalculationError] = useState("")

  // STEP 5: Order Submission state
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderNote, setOrderNote] = useState("")
  const [restaurantNote, setRestaurantNote] = useState("")

  // SUCCESS state
  const [createdOrder, setCreatedOrder] = useState(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  // Load restaurants on mount
  useEffect(() => {
    async function loadRestaurants() {
      try {
        setLoadingRestaurants(true)
        const response = await adminAPI.getRestaurants({ limit: 1000 })
        const data = response?.data?.data || response?.data || {}
        const list = Array.isArray(data?.restaurants)
          ? data.restaurants
          : Array.isArray(data)
          ? data
          : []
        setRestaurants(list)
      } catch (err) {
        console.error("Failed to load restaurants:", err)
        toast.error("Failed to fetch restaurants")
      } finally {
        setLoadingRestaurants(false)
      }
    }
    loadRestaurants()
  }, [])

  // Filter restaurants by search and approval
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const name = String(r.restaurantName || r.name || "").toLowerCase()
      const search = restaurantSearch.toLowerCase().trim()
      const isApproved = String(r.status || "").toLowerCase() === "approved"
      return isApproved && (!search || name.includes(search))
    })
  }, [restaurants, restaurantSearch])

  const loadMenuForRestaurant = useCallback(async (restaurant) => {
    if (!restaurant) return
    const restId = String(restaurant._id || restaurant.id)
    setLoadingMenu(true)
    try {
      let sections = []
      // 1. User panel public restaurant menu API (same as user app)
      try {
        const publicMenuRes = await restaurantAPI.getMenuByRestaurantId(restId, { noCache: true })
        const menuObj = publicMenuRes?.data?.data?.menu || publicMenuRes?.data?.menu || publicMenuRes?.data?.data
        if (Array.isArray(menuObj?.sections) && menuObj.sections.length > 0) {
          sections = menuObj.sections
        }
      } catch (err) {
        console.warn("Public restaurant menu fetch failed, falling back to admin menu:", err)
      }

      // 2. Fallback to Admin Menu API if needed
      if (!sections.length) {
        try {
          const adminMenuRes = await adminAPI.getRestaurantMenuById(restId)
          const menuData = adminMenuRes?.data?.data?.menu || adminMenuRes?.data?.data || adminMenuRes?.data || {}
          sections = Array.isArray(menuData?.sections) ? menuData.sections : []
        } catch (err) {
          console.warn("Admin menu fetch fallback failed:", err)
        }
      }

      setMenuSections(sections)
    } catch (err) {
      console.error("Failed to load menu:", err)
      toast.error("Failed to load restaurant menu")
    } finally {
      setLoadingMenu(false)
    }
  }, [])

  // When restaurant is selected, fetch menu
  const handleSelectRestaurant = async (restaurant) => {
    setSelectedRestaurant(restaurant)
    setCart({})
    setSelectedCategory("all")
    setMenuSearch("")
    setCurrentStep(2)

    // Pre-fill city and state from restaurant if customer hasn't typed any yet
    if (restaurant.city && !customerForm.city) {
      setCustomerForm((prev) => ({
        ...prev,
        city: restaurant.city || "",
        state: restaurant.state || prev.state,
      }))
    }

    await loadMenuForRestaurant(restaurant)
  }

  // Auto-load menu if restaurant is selected and menu hasn't loaded yet
  useEffect(() => {
    if (selectedRestaurant && menuSections.length === 0 && !loadingMenu) {
      loadMenuForRestaurant(selectedRestaurant)
    }
  }, [selectedRestaurant, menuSections.length, loadingMenu, loadMenuForRestaurant])

  // Cart operations
  const addToCart = (item, variant = null) => {
    const itemId = String(item._id || item.id)
    const variantId = variant ? String(variant._id || variant.id) : "base"
    const cartKey = `${itemId}_${variantId}`

    const unitPrice = variant
      ? Number(variant.price || variant.basePrice || 0)
      : Number(item.price || item.basePrice || 0)

    setCart((prev) => {
      const existing = prev[cartKey]
      const currentQty = existing ? existing.quantity : 0
      return {
        ...prev,
        [cartKey]: {
          item,
          variant,
          cartKey,
          quantity: currentQty + 1,
          price: unitPrice,
        },
      }
    })
    toast.success(`Added ${item.name || item.itemName} to order`)
  }

  const updateQuantity = (cartKey, delta) => {
    setCart((prev) => {
      const existing = prev[cartKey]
      if (!existing) return prev
      const newQty = existing.quantity + delta
      if (newQty <= 0) {
        const next = { ...prev }
        delete next[cartKey]
        return next
      }
      return {
        ...prev,
        [cartKey]: {
          ...existing,
          quantity: newQty,
        },
      }
    })
  }

  const removeFromCart = (cartKey) => {
    setCart((prev) => {
      const next = { ...prev }
      delete next[cartKey]
      return next
    })
  }

  const cartItemsList = useMemo(() => Object.values(cart), [cart])

  const cartSubtotal = useMemo(() => {
    return cartItemsList.reduce((sum, entry) => sum + entry.quantity * entry.price, 0)
  }, [cartItemsList])

  // Flattened menu items
  const allMenuItems = useMemo(() => {
    const list = []
    const toArray = (v) => (Array.isArray(v) ? v : [])

    menuSections.forEach((sec) => {
      const secName = sec.name || sec.categoryName || sec.title || "General"

      // Direct section items
      toArray(sec.items).forEach((it) => {
        list.push({
          ...it,
          id: String(it.id || it._id || ""),
          _id: String(it._id || it.id || ""),
          sectionName: secName,
        })
      })

      // Subsection items
      toArray(sec.subsections).forEach((sub) => {
        const subName = sub.name || sub.title || secName
        toArray(sub.items).forEach((it) => {
          list.push({
            ...it,
            id: String(it.id || it._id || ""),
            _id: String(it._id || it.id || ""),
            sectionName: subName,
            parentSectionName: secName,
          })
        })
      })
    })
    return list
  }, [menuSections])

  // Category list with counts
  const categoryList = useMemo(() => {
    const map = new Map()
    allMenuItems.forEach((item) => {
      const cat = item.sectionName || "General"
      map.set(cat, (map.get(cat) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [allMenuItems])

  const filteredMenuItems = useMemo(() => {
    return allMenuItems.filter((it) => {
      const name = String(it.name || it.itemName || "").toLowerCase()
      const search = menuSearch.toLowerCase().trim()
      const matchSearch = !search || name.includes(search)
      const matchCat =
        selectedCategory === "all" || it.sectionName === selectedCategory
      return matchSearch && matchCat
    })
  }, [allMenuItems, menuSearch, selectedCategory])

  // STEP 4: Calculate Delivery Fee from backend
  const calculateDeliveryCharge = useCallback(async () => {
    if (!selectedRestaurant) return
    setCalculatingFee(true)
    setDeliveryCalculationError("")

    try {
      const rCoords = selectedRestaurant.location?.coordinates
      const customerCoords =
        customerForm.lng && customerForm.lat
          ? [Number(customerForm.lng), Number(customerForm.lat)]
          : rCoords || [73.8567, 18.5204]

      const payload = {
        restaurantId: selectedRestaurant._id || selectedRestaurant.id,
        subtotal: cartSubtotal,
        deliveryAddress: {
          street: customerForm.houseFlat,
          area: customerForm.area,
          city: customerForm.city,
          state: customerForm.state,
          zipCode: customerForm.pincode,
          location: { coordinates: customerCoords },
        },
      }

      const response = await adminAPI.calculateDeliveryFee(payload)
      const data = response?.data?.data || response?.data || {}

      const fee = Number(data.deliveryFee ?? 25)
      const dist = data.distanceKm != null ? Number(data.distanceKm) : null

      setAutoCalculatedFee(fee)
      setDistanceKm(dist)
      setCustomDeliveryFee((prev) => (prev === "" ? String(fee) : prev))
    } catch (err) {
      console.error("Delivery charge calculation failed:", err)
      setDeliveryCalculationError(
        err?.response?.data?.message || "Could not automatically calculate distance. You can set a custom delivery charge."
      )
      setAutoCalculatedFee(25) // Fallback default
      setCustomDeliveryFee((prev) => (prev === "" ? "25" : prev))
    } finally {
      setCalculatingFee(false)
    }
  }, [selectedRestaurant, customerForm, cartSubtotal])

  // Trigger calculation when entering Step 4
  useEffect(() => {
    if (currentStep === 4) {
      calculateDeliveryCharge()
    }
  }, [currentStep, calculateDeliveryCharge])

  const effectiveDeliveryFee = useMemo(() => {
    if (customDeliveryFee !== "" && !isNaN(Number(customDeliveryFee))) {
      return Math.max(0, Number(customDeliveryFee))
    }
    return autoCalculatedFee != null ? autoCalculatedFee : 25
  }, [customDeliveryFee, autoCalculatedFee])

  const grandTotal = useMemo(() => {
    return Math.max(0, cartSubtotal + effectiveDeliveryFee)
  }, [cartSubtotal, effectiveDeliveryFee])

  // STEP 5: Place the Order
  const handlePlaceOrder = async () => {
    if (!selectedRestaurant) {
      toast.error("Please select a restaurant")
      setCurrentStep(1)
      return
    }
    if (cartItemsList.length === 0) {
      toast.error("Cart is empty. Please add items.")
      setCurrentStep(2)
      return
    }
    if (!customerForm.name.trim() || !customerForm.phone.trim()) {
      toast.error("Please fill in customer name and mobile number")
      setCurrentStep(3)
      return
    }
    if (!customerForm.houseFlat.trim() || !customerForm.city.trim()) {
      toast.error("Please enter the delivery address")
      setCurrentStep(3)
      return
    }

    setPlacingOrder(true)
    try {
      const itemsPayload = cartItemsList.map((entry) => ({
        itemId: entry.item._id || entry.item.id,
        name: entry.item.name || entry.item.itemName,
        quantity: entry.quantity,
        variantId: entry.variant ? entry.variant._id || entry.variant.id : undefined,
        variantName: entry.variant ? entry.variant.name : undefined,
      }))

      const rCoords = selectedRestaurant.location?.coordinates
      const customerCoords =
        customerForm.lng && customerForm.lat
          ? [Number(customerForm.lng), Number(customerForm.lat)]
          : rCoords || [73.8567, 18.5204]

      const payload = {
        restaurantId: selectedRestaurant._id || selectedRestaurant.id,
        customerName: customerForm.name.trim(),
        customerPhone: customerForm.phone.trim(),
        items: itemsPayload,
        deliveryFeeOverride: effectiveDeliveryFee,
        deliveryFee: effectiveDeliveryFee,
        deliveryAddress: {
          name: customerForm.name.trim(),
          phone: customerForm.phone.trim(),
          street: customerForm.houseFlat.trim(),
          additionalDetails: customerForm.landmark.trim(),
          area: customerForm.area.trim(),
          city: customerForm.city.trim(),
          state: customerForm.state.trim() || "Maharashtra",
          zipCode: customerForm.pincode.trim(),
          location: { coordinates: customerCoords },
        },
        note: orderNote.trim(),
        restaurantNote: restaurantNote.trim(),
      }

      const response = await adminAPI.createOfflineOrder(payload)
      const data = response?.data?.data || response?.data || {}
      const order = data.order || data

      setCreatedOrder(order)
      toast.success("Offline order placed successfully!")
    } catch (err) {
      console.error("Failed to place offline order:", err)
      const msg = err?.response?.data?.message || err?.message || "Failed to place order"
      toast.error(msg)
    } finally {
      setPlacingOrder(false)
    }
  }

  // If order is created successfully, display success screen
  if (createdOrder) {
    const orderId = createdOrder.orderId || String(createdOrder._id || "").slice(-6).toUpperCase()
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
              Admin Offline Order
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-3">Order Created Successfully!</h1>
            <p className="text-slate-500 text-sm mt-1">
              The order has been placed into the live system. The restaurant has received the new order notification.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left max-w-md mx-auto space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Order ID:</span>
              <span className="font-bold text-orange-600 text-base">#{orderId}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Restaurant:</span>
              <span className="font-semibold text-slate-800">
                {selectedRestaurant?.restaurantName || selectedRestaurant?.name}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Customer:</span>
              <span className="font-semibold text-slate-800">{customerForm.name} ({customerForm.phone})</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Delivery Address:</span>
              <span className="font-semibold text-slate-800 text-right truncate max-w-[200px]">
                {customerForm.houseFlat}, {customerForm.city}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-3">
              <span className="text-slate-700 font-medium">Grand Total:</span>
              <span className="font-bold text-slate-900 text-lg">{formatINR(grandTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
              <span>Payment Type:</span>
              <span className="font-semibold">Cash on Delivery (COD)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setViewDialogOpen(true)
              }}
              className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Order Details
            </Button>

            <Button
              onClick={() => navigate("/admin/food/offline-orders")}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-medium"
            >
              Back to Offline Orders
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setCreatedOrder(null)
                setSelectedRestaurant(null)
                setCart({})
                setCustomerForm({
                  name: "",
                  phone: "",
                  houseFlat: "",
                  area: "",
                  landmark: "",
                  city: "",
                  state: "Maharashtra",
                  pincode: "",
                  lat: "",
                  lng: "",
                })
                setCurrentStep(1)
              }}
              className="w-full sm:w-auto text-slate-500 hover:text-slate-800"
            >
              Create Another Order
            </Button>
          </div>
        </div>

        {viewDialogOpen && createdOrder && (
          <ViewOrderDialog
            order={createdOrder}
            isOpen={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            onOrderUpdated={(updated) => {
              if (updated) setCreatedOrder(updated)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/food/offline-orders")}
            className="h-9 w-9 p-0 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Offline Order</h1>
            <p className="text-xs text-slate-500">Create an order on behalf of a customer with live restaurant flow</p>
          </div>
        </div>

        {selectedRestaurant && (() => {
          const restHeaderImg = resolveRestaurantImage(selectedRestaurant)
          return (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-xs">
              {restHeaderImg ? (
                <img
                  src={restHeaderImg}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                />
              ) : (
                <Store className="w-4 h-4 text-orange-600" />
              )}
              <span className="font-semibold text-orange-900">
                {selectedRestaurant.restaurantName || selectedRestaurant.name}
              </span>
            </div>
          )
        })()}
      </div>

      {/* Wizard Progress Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-5 gap-2">
          {STEPS.map((s) => {
            const Icon = s.icon
            const isActive = currentStep === s.id
            const isDone = currentStep > s.id

            return (
              <div
                key={s.id}
                onClick={() => {
                  if (s.id < currentStep) setCurrentStep(s.id)
                }}
                className={`flex flex-col items-center text-center p-2 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? "bg-orange-50/80 border border-orange-300 text-orange-600 font-semibold"
                    : isDone
                    ? "text-emerald-700 hover:bg-slate-50"
                    : "text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 text-xs ${
                    isActive
                      ? "bg-orange-600 text-white"
                      : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="text-xs hidden md:inline">{s.title}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* STEP 1: Select Restaurant */}
      {currentStep === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select Restaurant</h2>
              <p className="text-xs text-slate-500">
                Choose an active restaurant to load its real-time menu and items
              </p>
            </div>

            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search restaurant by name..."
                value={restaurantSearch}
                onChange={(e) => setRestaurantSearch(e.target.value)}
                className="pl-9 h-10 border-slate-200"
              />
            </div>
          </div>

          {loadingRestaurants ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
              <p className="text-sm">Loading available restaurants...</p>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No restaurants found</p>
              <p className="text-xs text-slate-400 mt-1">Try a different search term or verify restaurant status</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRestaurants.map((restaurant) => {
                const restName = restaurant.restaurantName || restaurant.name || "Restaurant"
                const image = resolveRestaurantImage(restaurant)
                const isAccepting = restaurant.isAcceptingOrders !== false && restaurant.isActive !== false
                const isSelected = selectedRestaurant?._id === restaurant._id

                return (
                  <div
                    key={restaurant._id || restaurant.id}
                    onClick={() => handleSelectRestaurant(restaurant)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-4 items-center ${
                      isSelected
                        ? "border-orange-500 bg-orange-50/50 shadow-sm"
                        : "border-slate-200 hover:border-orange-200 hover:shadow-md"
                    }`}
                  >
                    <div className="w-16 h-16 rounded-lg bg-orange-50/60 flex-shrink-0 overflow-hidden relative border border-slate-200">
                      {image ? (
                        <img
                          src={image}
                          alt={restName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = "flex"
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-600"
                        style={{ display: image ? "none" : "flex" }}
                      >
                        <Store className="w-8 h-8" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-slate-900 truncate" title={restName}>
                          {restName}
                        </h3>
                        {isAccepting ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300" title="Offline" />
                        )}
                      </div>

                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {restaurant.area || restaurant.city || "Available"}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700"
                        >
                          {restaurant.cuisine || "Multi-cuisine"}
                        </Badge>
                        {isAccepting ? (
                          <span className="text-[10px] text-emerald-600 font-medium">Ready</span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium">Busy / Offline</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Restaurant Menu & Items Selection */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Menu Items Area */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedRestaurant?.restaurantName || selectedRestaurant?.name} Menu
                </h2>
                <p className="text-xs text-slate-500">Add dishes to the customer's order</p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search dishes..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="pl-9 h-9 text-xs border-slate-200"
                />
              </div>
            </div>

            {/* Categories filter tabs */}
            {categoryList.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === "all"
                      ? "bg-orange-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All ({allMenuItems.length})
                </button>
                {categoryList.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat.name
                        ? "bg-orange-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>
            )}

            {loadingMenu ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
                <p className="text-sm">Loading restaurant menu...</p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No dishes available</p>
                <p className="text-xs text-slate-400 mt-1">This restaurant does not have any items matching your filter.</p>
                {allMenuItems.length === 0 && selectedRestaurant && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMenuForRestaurant(selectedRestaurant)}
                    className="mt-3 text-xs"
                  >
                    Retry Loading Menu
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMenuItems.map((dish) => {
                  const dishId = dish._id || dish.id
                  const dishName = dish.name || dish.itemName || "Dish"
                  const dishPrice = Number(dish.price || dish.basePrice || 0)
                  const hasVariants = Array.isArray(dish.variants) && dish.variants.length > 0
                  const isVeg =
                    String(dish.foodType || dish.vegNonVeg || "").toLowerCase().includes("veg") &&
                    !String(dish.foodType || dish.vegNonVeg || "").toLowerCase().includes("non")

                  const dishImage = normalizeImageUrl(
                    (typeof dish.image === "string" ? dish.image : dish.image?.url) ||
                    dish.imageUrl ||
                    (Array.isArray(dish.images) && dish.images.length > 0 ? (typeof dish.images[0] === "string" ? dish.images[0] : dish.images[0]?.url) : "")
                  )

                  return (
                    <div
                      key={dishId}
                      className="border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden relative border border-slate-200">
                          {dishImage ? (
                            <img
                              src={dishImage}
                              alt={dishName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = "none"
                                if (e.currentTarget.nextElementSibling) {
                                  e.currentTarget.nextElementSibling.style.display = "flex"
                                }
                              }}
                            />
                          ) : null}
                          <div
                            className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"
                            style={{ display: dishImage ? "none" : "flex" }}
                          >
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2.5 h-2.5 rounded-sm border ${
                                isVeg ? "border-emerald-600 bg-emerald-500" : "border-rose-600 bg-rose-500"
                              }`}
                            />
                            <h4 className="font-bold text-sm text-slate-900 truncate" title={dishName}>
                              {dishName}
                            </h4>
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {dish.description || dish.sectionName}
                          </p>

                          <div className="font-semibold text-sm text-slate-900 mt-1">
                            {formatINR(dishPrice)}
                          </div>
                        </div>
                      </div>

                      {/* Add Button or Variants list */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        {hasVariants ? (
                          <div className="space-y-1.5 w-full">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Options:
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {dishPrice > 0 && (
                                <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
                                  <span className="truncate pr-1">Regular: {formatINR(dishPrice)}</span>
                                  {cart[`${dishId}_base`] ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => updateQuantity(`${dishId}_base`, -1)}
                                        className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700"
                                      >
                                        -
                                      </button>
                                      <span className="font-bold px-1">{cart[`${dishId}_base`].quantity}</span>
                                      <button
                                        onClick={() => updateQuantity(`${dishId}_base`, 1)}
                                        className="w-5 h-5 rounded bg-orange-600 text-white flex items-center justify-center font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => addToCart(dish, null)}
                                      className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-[11px] font-semibold"
                                    >
                                      Add
                                    </button>
                                  )}
                                </div>
                              )}
                              {dish.variants.map((v) => {
                                const vKey = `${dishId}_${v._id || v.id}`
                                const inCart = cart[vKey]
                                return (
                                  <div
                                    key={v._id || v.id}
                                    className="flex items-center justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs"
                                  >
                                    <span className="truncate pr-1">{v.name}: {formatINR(v.price)}</span>
                                    {inCart ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => updateQuantity(vKey, -1)}
                                          className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700"
                                        >
                                          -
                                        </button>
                                        <span className="font-bold px-1">{inCart.quantity}</span>
                                        <button
                                          onClick={() => updateQuantity(vKey, 1)}
                                          className="w-5 h-5 rounded bg-orange-600 text-white flex items-center justify-center font-bold"
                                        >
                                          +
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => addToCart(dish, v)}
                                        className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-[11px] font-semibold"
                                      >
                                        Add
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs text-slate-400">Regular</span>
                            {cart[`${dishId}_base`] ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateQuantity(`${dishId}_base`, -1)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-bold text-sm text-slate-900 px-1">
                                  {cart[`${dishId}_base`].quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(`${dishId}_base`, 1)}
                                  className="w-7 h-7 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center font-bold"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => addToCart(dish, null)}
                                className="h-8 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-3"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add to Order
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cart / Order Items Sidebar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 h-fit lg:sticky lg:top-6 self-start">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-slate-900">Current Order ({cartItemsList.length})</h3>
              </div>
              {cartItemsList.length > 0 && (
                <button
                  onClick={() => setCart({})}
                  className="text-xs text-rose-600 hover:underline font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {cartItemsList.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs mt-1">Click "+ Add to Order" on items to start building the order.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1 space-y-2">
                  {cartItemsList.map((entry) => {
                    const itemTotal = entry.quantity * entry.price
                    return (
                      <div key={entry.cartKey} className="pt-2 flex items-center justify-between text-xs">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-semibold text-slate-900 truncate">
                            {entry.item.name || entry.item.itemName}
                          </p>
                          {entry.variant && (
                            <span className="text-[10px] text-slate-500">{entry.variant.name}</span>
                          )}
                          <p className="text-slate-500 mt-0.5">
                            {formatINR(entry.price)} × {entry.quantity} = {formatINR(itemTotal)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(entry.cartKey, -1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                          >
                            -
                          </button>
                          <span className="font-bold px-1">{entry.quantity}</span>
                          <button
                            onClick={() => updateQuantity(entry.cartKey, 1)}
                            className="w-6 h-6 rounded bg-orange-600 text-white flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(entry.cartKey)}
                            className="w-6 h-6 rounded text-rose-500 hover:bg-rose-50 flex items-center justify-center ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
            )}

            {/* Subtotal & Next Step Button */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Items Subtotal:</span>
                <span className="font-bold text-slate-900 text-base">{formatINR(cartSubtotal)}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 border-slate-200 text-slate-600"
                >
                  Change Restaurant
                </Button>
                <Button
                  disabled={cartItemsList.length === 0}
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                >
                  Next: Customer
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Customer Details & Address */}
      {currentStep === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Customer & Delivery Address</h2>
            <p className="text-xs text-slate-500">
              Enter customer details for this offline order. Delivery partner will deliver to this address.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="h-10 border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="10-digit mobile number"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="h-10 border-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                House / Flat / Building No. <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Flat 402, Sunshine Heights"
                value={customerForm.houseFlat}
                onChange={(e) => setCustomerForm({ ...customerForm, houseFlat: e.target.value })}
                className="h-10 border-slate-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Area / Locality</label>
                <Input
                  placeholder="e.g. Shivaji Nagar"
                  value={customerForm.area}
                  onChange={(e) => setCustomerForm({ ...customerForm, area: e.target.value })}
                  className="h-10 border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Landmark (Optional)</label>
                <Input
                  placeholder="e.g. Near Metro Station"
                  value={customerForm.landmark}
                  onChange={(e) => setCustomerForm({ ...customerForm, landmark: e.target.value })}
                  className="h-10 border-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Pune"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                  className="h-10 border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                <Input
                  placeholder="e.g. Maharashtra"
                  value={customerForm.state}
                  onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                  className="h-10 border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                <Input
                  placeholder="6-digit pincode"
                  value={customerForm.pincode}
                  onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value })}
                  className="h-10 border-slate-200"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-orange-600" />
                Delivery Coordinates (Optional, used for driving distance)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Latitude (e.g. 18.5204)"
                  value={customerForm.lat}
                  onChange={(e) => setCustomerForm({ ...customerForm, lat: e.target.value })}
                  className="h-8 text-xs bg-white border-slate-200"
                />
                <Input
                  placeholder="Longitude (e.g. 73.8567)"
                  value={customerForm.lng}
                  onChange={(e) => setCustomerForm({ ...customerForm, lng: e.target.value })}
                  className="h-8 text-xs bg-white border-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="border-slate-200 text-slate-600"
            >
              Back to Menu
            </Button>

            <Button
              onClick={() => {
                if (!customerForm.name.trim() || !customerForm.phone.trim()) {
                  toast.error("Customer name and phone number are required")
                  return
                }
                if (!customerForm.houseFlat.trim() || !customerForm.city.trim()) {
                  toast.error("House/flat and city are required for delivery")
                  return
                }
                setCurrentStep(4)
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
            >
              Next: Delivery Charge
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Delivery Charge Preview & Override */}
      {currentStep === 4 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Delivery Charge Calculation</h2>
            <p className="text-xs text-slate-500">
              Calculated using the existing platform distance rules. You can also override the charge.
            </p>
          </div>

          {calculatingFee ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
              <p className="text-sm">Calculating distance and delivery fee...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Distance card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-orange-600" />
                    <span className="font-semibold text-sm text-slate-800">
                      {selectedRestaurant?.restaurantName || selectedRestaurant?.name}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Pickup</span>
                </div>

                <div className="border-l-2 border-dashed border-orange-300 ml-2 pl-4 py-1 text-xs text-slate-500">
                  {distanceKm != null ? (
                    <span className="font-semibold text-orange-600">{distanceKm} km driving distance</span>
                  ) : (
                    <span>Standard zone calculation</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-sm text-slate-800">
                      {customerForm.houseFlat}, {customerForm.city}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Delivery</span>
                </div>
              </div>

              {/* Fee display and adjustment */}
              <div className="p-5 rounded-xl border border-slate-200 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                      Calculated Default Charge
                    </span>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">
                      {formatINR(autoCalculatedFee || 25)}
                      <span className="text-xs text-slate-400 font-normal ml-1.5">
                        (Platform zone & distance rate)
                      </span>
                    </p>
                  </div>

                  {Number(customDeliveryFee) !== Number(autoCalculatedFee || 25) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomDeliveryFee(String(autoCalculatedFee || 25))}
                      className="border-slate-200 text-slate-600 text-xs hover:bg-slate-100"
                    >
                      Reset to Default
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Set / Adjust Delivery Charge (₹)
                    </label>
                    <span className="text-xs text-slate-500">
                      Charge for this order:{" "}
                      <strong className="text-orange-600 font-bold">
                        {effectiveDeliveryFee === 0 ? "Free (₹0)" : formatINR(effectiveDeliveryFee)}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative max-w-xs flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={customDeliveryFee}
                        onChange={(e) => setCustomDeliveryFee(e.target.value)}
                        className="pl-7 h-10 border-orange-300 focus:border-orange-500 bg-white font-semibold text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-medium text-slate-500">Quick Presets:</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Free (₹0)", value: "0" },
                        { label: "₹20", value: "20" },
                        { label: "₹30", value: "30" },
                        { label: "₹40", value: "40" },
                        { label: "₹50", value: "50" },
                        {
                          label: `Default (${formatINR(autoCalculatedFee || 25)})`,
                          value: String(autoCalculatedFee || 25),
                        },
                      ].map((preset) => {
                        const isSelected = String(customDeliveryFee) === String(preset.value);
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setCustomDeliveryFee(preset.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              isSelected
                                ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                                : "bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    💡 <strong>Admin Control:</strong> By default, the distance-based platform rate is applied. You can click any preset above or type any custom amount (enter 0 for Free Delivery).
                  </p>
                </div>
              </div>

              {/* Total preview */}
              <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200 flex justify-between items-center text-sm">
                <div>
                  <span className="text-slate-600">Subtotal + Delivery Charge:</span>
                  <p className="text-xs text-slate-500">
                    {formatINR(cartSubtotal)} + {effectiveDeliveryFee === 0 ? "₹0 (Free)" : formatINR(effectiveDeliveryFee)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Payable:</span>
                  <span className="font-bold text-xl text-slate-900">{formatINR(grandTotal)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(3)}
              className="border-slate-200 text-slate-600"
            >
              Back to Customer Details
            </Button>

            <Button
              onClick={() => setCurrentStep(5)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
            >
              Next: Order Summary
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: Order Summary & Review */}
      {currentStep === 5 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Order Summary & Confirmation</h2>
              <p className="text-xs text-slate-500">Review complete details before submitting order</p>
            </div>
            <Badge className="bg-orange-100 text-orange-800 border-orange-200">
              Offline Order / Admin Placed
            </Badge>
          </div>

          <div className="space-y-4">
            {/* Restaurant & Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="font-bold text-slate-700 uppercase tracking-wider">Restaurant:</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">
                  {selectedRestaurant?.restaurantName || selectedRestaurant?.name}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {selectedRestaurant?.area || selectedRestaurant?.city || "Restaurant"}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-700 uppercase tracking-wider">Customer:</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">{customerForm.name}</p>
                <p className="text-slate-500 mt-0.5">{customerForm.phone}</p>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">Delivery Address:</span>
              <p className="text-slate-900 font-medium text-sm mt-0.5">
                {customerForm.houseFlat}, {customerForm.area && `${customerForm.area}, `}
                {customerForm.landmark && `Near ${customerForm.landmark}, `}
                {customerForm.city}, {customerForm.state} {customerForm.pincode && `- ${customerForm.pincode}`}
              </p>
            </div>

            {/* Items Breakdown */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 font-semibold text-xs text-slate-700 border-b border-slate-200">
                Ordered Items ({cartItemsList.length})
              </div>
              <div className="divide-y divide-slate-100 p-4 space-y-2 max-h-56 overflow-y-auto">
                {cartItemsList.map((entry) => {
                  const itemTotal = entry.quantity * entry.price
                  return (
                    <div key={entry.cartKey} className="pt-2 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">
                          {entry.quantity} × {entry.item.name || entry.item.itemName}
                        </span>
                        {entry.variant && (
                          <span className="text-[11px] text-slate-500 ml-1.5">({entry.variant.name})</span>
                        )}
                      </div>
                      <span className="font-semibold text-slate-900">{formatINR(itemTotal)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-medium text-slate-800">{formatINR(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  Delivery Charge:
                  {Number(effectiveDeliveryFee) !== Number(autoCalculatedFee || 25) && (
                    <span className="text-[10px] font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                      Custom
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {effectiveDeliveryFee === 0 ? "Free (₹0)" : formatINR(effectiveDeliveryFee)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="text-xs text-orange-600 hover:text-orange-700 underline font-medium"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-slate-900 font-bold text-base border-t border-slate-200 pt-2">
                <span>Grand Total:</span>
                <span className="text-orange-600 text-lg">{formatINR(grandTotal)}</span>
              </div>
              <div className="text-[11px] text-slate-400 text-right">
                Payment Method: Cash on Delivery (COD)
              </div>
            </div>

            {/* Optional Special Notes */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cooking / Restaurant Instructions (Optional)
                </label>
                <Input
                  placeholder="e.g. Less spicy, extra sauce"
                  value={restaurantNote}
                  onChange={(e) => setRestaurantNote(e.target.value)}
                  className="h-9 text-xs border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Delivery Partner Instructions (Optional)
                </label>
                <Input
                  placeholder="e.g. Ring bell twice, deliver to security guard"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="h-9 text-xs border-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={placingOrder}
              onClick={() => setCurrentStep(4)}
              className="border-slate-200 text-slate-600"
            >
              Back to Delivery Fee
            </Button>

            <Button
              disabled={placingOrder}
              onClick={handlePlaceOrder}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 shadow-sm shadow-orange-600/30"
            >
              {placingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Place Order ({formatINR(grandTotal)})
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
