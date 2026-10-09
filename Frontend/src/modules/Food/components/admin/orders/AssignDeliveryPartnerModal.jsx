import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"
import {
  Truck,
  Search,
  RefreshCw,
  User,
  Phone,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Loader2,
  X,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { io } from "socket.io-client"
import { getSocketUrl } from "@food/utils/socketConfig"

export default function AssignDeliveryPartnerModal({
  isOpen,
  onOpenChange,
  order,
  onAssigned
}) {
  const [partners, setPartners] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    online: 0,
    available: 0,
    busy: 0,
    offline: 0
  })
  const [loading, setLoading] = useState(false)
  const [assigningPartnerId, setAssigningPartnerId] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState("all") // 'all' | 'available' | 'busy' | 'offline'
  const [expandedPartnerId, setExpandedPartnerId] = useState(null)
  const [restaurantZone, setRestaurantZone] = useState({ id: null, name: "Restaurant Zone" })
  const [restaurantZonePartners, setRestaurantZonePartners] = useState([])
  const [otherZones, setOtherZones] = useState([])

  // Confirmation state for reassign or offline
  const [pendingPartner, setPendingPartner] = useState(null)
  const [confirmAllowOffline, setConfirmAllowOffline] = useState(false)
  const [reassignReason, setReassignReason] = useState("")

  const orderTargetId = useMemo(() => {
    if (!order) return null
    return order._id || order.id || order.orderId
  }, [order])

  const currentAssignedPartner = useMemo(() => {
    if (!order) return null
    const dp = order.dispatch?.deliveryPartnerId || order.deliveryPartnerId
    if (dp && typeof dp === "object") {
      return {
        id: dp._id || dp.id,
        name: dp.name || order.deliveryPartnerName,
        phone: dp.phone || order.deliveryPartnerPhone,
      }
    }
    if (order.deliveryPartnerName) {
      return {
        id: typeof dp === "string" ? dp : null,
        name: order.deliveryPartnerName,
        phone: order.deliveryPartnerPhone || "",
      }
    }
    return null
  }, [order])

  const normalizePartnersData = useCallback((data) => {
    const rawPartners = data.partners || []
    const counts = data.counts || data.summary || {}
    const rZone = data.restaurantZone || { id: null, name: data.order?.zoneName || "Restaurant Zone" }
    setRestaurantZone(rZone)

    const normalizePartner = (p) => {
      const id = String(p.id || p._id || "")
      const isOnline =
        p.isOnline === true ||
        p.presence === "online" ||
        p.presenceStatus === "online" ||
        p.availabilityStatus === "online"

      const activeCount = Number(p.activeOrdersCount ?? p.activeOrders?.length ?? 0)

      let workloadStatus = p.workloadStatus || p.workload
      if (!workloadStatus) {
        workloadStatus = isOnline ? (activeCount > 0 ? "busy" : "available") : "offline"
      }

      const vehicleObj = p.vehicle || {
        type: p.vehicleType || "",
        model: p.vehicleName || "",
        plateNumber: p.vehicleNumber || "",
      }

      const isCurrentAssigned = Boolean(
        p.isCurrentlyAssignedToThisOrder ||
        p.isAssignedToThisOrder ||
        (currentAssignedPartner?.id && String(currentAssignedPartner.id) === id)
      )

      return {
        ...p,
        id,
        _id: p._id || id,
        isOnline,
        presence: isOnline ? "online" : "offline",
        presenceStatus: isOnline ? "online" : "offline",
        workload: workloadStatus,
        workloadStatus,
        activeOrdersCount: activeCount,
        activeOrders: Array.isArray(p.activeOrders) ? p.activeOrders : [],
        vehicle: vehicleObj,
        vehicleType: p.vehicleType || vehicleObj.type || "",
        vehicleName: p.vehicleName || vehicleObj.model || "",
        vehicleNumber: p.vehicleNumber || vehicleObj.plateNumber || "",
        isCurrentlyAssignedToThisOrder: isCurrentAssigned,
        zoneName: p.zoneName || "Other",
        isRestaurantZone: Boolean(p.isRestaurantZone),
      }
    }

    const normalizedAll = rawPartners.map(normalizePartner)
    setPartners(normalizedAll)

    // Separate restaurant zone partners vs other zones
    if (Array.isArray(data.restaurantZonePartners)) {
      setRestaurantZonePartners(data.restaurantZonePartners.map(normalizePartner))
    } else {
      setRestaurantZonePartners(normalizedAll.filter((p) => p.isRestaurantZone))
    }

    if (Array.isArray(data.otherZones)) {
      setOtherZones(
        data.otherZones.map((group) => ({
          ...group,
          partners: (group.partners || []).map(normalizePartner),
        }))
      )
    } else {
      const groupsMap = new Map()
      normalizedAll
        .filter((p) => !p.isRestaurantZone)
        .forEach((p) => {
          const zName = p.zoneName || "Other"
          if (!groupsMap.has(zName)) {
            groupsMap.set(zName, {
              zoneId: p.zoneId || zName,
              zoneName: zName,
              partners: [],
            })
          }
          groupsMap.get(zName).partners.push(p)
        })
      setOtherZones(Array.from(groupsMap.values()))
    }

    const onlineComputed = normalizedAll.filter((p) => p.isOnline).length
    const availableComputed = normalizedAll.filter((p) => p.isOnline && p.workloadStatus === "available").length
    const busyComputed = normalizedAll.filter((p) => p.isOnline && p.workloadStatus === "busy").length
    const offlineComputed = normalizedAll.filter((p) => !p.isOnline).length

    setSummary({
      total: counts.total ?? normalizedAll.length,
      online: counts.online ?? onlineComputed,
      available: counts.available ?? availableComputed,
      busy: counts.busy ?? busyComputed,
      offline: counts.offline ?? offlineComputed,
    })
  }, [currentAssignedPartner])

  const fetchPartners = useCallback(async (silent = false) => {
    if (!orderTargetId) return
    if (!silent) setLoading(true)
    try {
      const response = await adminAPI.getOrderDeliveryPartners(orderTargetId)
      if (response?.data?.success && response.data.data) {
        normalizePartnersData(response.data.data)
      } else {
        // Fallback to general workload endpoint
        const fallbackRes = await adminAPI.getDeliveryPartnersWorkload({ orderId: orderTargetId })
        if (fallbackRes?.data?.success && fallbackRes.data.data) {
          normalizePartnersData(fallbackRes.data.data)
        }
      }
    } catch (error) {
      console.error("Error fetching delivery partners:", error)
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to fetch delivery partners")
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [orderTargetId, normalizePartnersData])

  useEffect(() => {
    if (isOpen && orderTargetId) {
      fetchPartners(false)
      setPendingPartner(null)
      setConfirmAllowOffline(false)
      setReassignReason("")
      setExpandedPartnerId(null)
      setSearchQuery("")
      setFilterTab("all")
    }
  }, [isOpen, orderTargetId, fetchPartners])

  // Real-time live presence and workload updates via Socket.IO
  useEffect(() => {
    if (!isOpen) return

    const socketUrl = getSocketUrl()
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
    })

    socket.on("connect", () => {
      socket.emit("join-admin-orders")
    })

    const handleRealtimeUpdate = () => {
      // Refresh fleet data silently so UI updates live
      fetchPartners(true)
    }

    socket.on("admin_dispatch_updated", handleRealtimeUpdate)
    socket.on("admin_order_status_update", handleRealtimeUpdate)
    socket.on("order_status_update", handleRealtimeUpdate)

    return () => {
      socket.off("admin_dispatch_updated", handleRealtimeUpdate)
      socket.off("admin_order_status_update", handleRealtimeUpdate)
      socket.off("order_status_update", handleRealtimeUpdate)
      socket.disconnect()
    }
  }, [isOpen, fetchPartners])

  // Partner predicate for filters
  const filterPartner = useCallback(
    (p) => {
      if (filterTab === "available" && (!p.isOnline || p.workloadStatus !== "available")) return false
      if (filterTab === "busy" && (!p.isOnline || p.workloadStatus !== "busy")) return false
      if (filterTab === "offline" && p.isOnline) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const name = (p.name || "").toLowerCase()
        const phone = (p.phone || "").toLowerCase()
        const email = (p.email || "").toLowerCase()
        const zone = (p.zoneName || "").toLowerCase()
        const vehicle = `${p.vehicle?.model || p.vehicleName || ""} ${p.vehicle?.plateNumber || p.vehicleNumber || ""} ${p.vehicle?.type || p.vehicleType || ""}`.toLowerCase()
        return name.includes(q) || phone.includes(q) || email.includes(q) || vehicle.includes(q) || zone.includes(q)
      }
      return true
    },
    [filterTab, searchQuery]
  )

  const filteredRestaurantZonePartners = useMemo(() => {
    return restaurantZonePartners.filter(filterPartner)
  }, [restaurantZonePartners, filterPartner])

  const filteredOtherZones = useMemo(() => {
    return otherZones
      .map((group) => ({
        ...group,
        partners: (group.partners || []).filter(filterPartner),
      }))
      .filter((group) => group.partners.length > 0)
  }, [otherZones, filterPartner])

  const totalFilteredCount = useMemo(() => {
    const inRest = filteredRestaurantZonePartners.length
    const inOther = filteredOtherZones.reduce((sum, g) => sum + g.partners.length, 0)
    return inRest + inOther
  }, [filteredRestaurantZonePartners, filteredOtherZones])

  const handleAssignClick = (partner) => {
    const isCurrentlyAssigned =
      partner.isCurrentlyAssignedToThisOrder ||
      (currentAssignedPartner?.id && String(currentAssignedPartner.id) === String(partner.id))

    if (isCurrentlyAssigned) {
      toast.info("This partner is already assigned to this order")
      return
    }

    const needsReassignPrompt = Boolean(currentAssignedPartner)
    const isOffline = !partner.isOnline

    // If reassign or offline, open confirmation sheet
    if (needsReassignPrompt || isOffline) {
      setPendingPartner(partner)
      setConfirmAllowOffline(true)
      return
    }

    // Direct assignment if available/busy and order unassigned
    executeAssignment(partner, { reassign: false, allowOffline: false })
  }

  const executeAssignment = async (partner, options = {}) => {
    if (!orderTargetId || !partner) return
    const partnerId = partner.id || partner._id

    setAssigningPartnerId(partnerId)
    try {
      const payload = {
        deliveryPartnerId: partnerId,
        reassign: Boolean(options.reassign),
        allowOffline: Boolean(options.allowOffline),
        notes: options.notes || undefined,
      }

      const response = await adminAPI.assignDeliveryPartner(orderTargetId, payload)
      if (response?.data?.success) {
        toast.success(
          response.data.message || `Order successfully assigned to ${partner.name}`
        )
        setPendingPartner(null)
        if (typeof onAssigned === "function") {
          onAssigned(order, partner, response.data.data)
        }
        onOpenChange(false)
      } else {
        toast.error(response?.data?.message || "Assignment failed")
      }
    } catch (error) {
      console.error("Assignment error:", error)
      const data = error.response?.data
      if (data?.code === "ALREADY_ASSIGNED") {
        toast.warning(data.message || "Order is already assigned. Please confirm reassignment.")
        setPendingPartner(partner)
      } else if (data?.code === "PARTNER_OFFLINE") {
        toast.warning(data.message || "Partner is offline. Please confirm to proceed.")
        setPendingPartner(partner)
        setConfirmAllowOffline(true)
      } else {
        toast.error(data?.message || "Failed to assign delivery partner")
      }
    } finally {
      setAssigningPartnerId(null)
    }
  }

  const renderPartnerCard = (partner, isRestaurantZone = false) => {
    const isCurrentlyAssigned =
      partner.isCurrentlyAssignedToThisOrder ||
      (currentAssignedPartner?.id && String(currentAssignedPartner.id) === String(partner.id))
    const isBusy = partner.workloadStatus === "busy"
    const isOffline = !partner.isOnline
    const isAvailable = partner.workloadStatus === "available" && partner.isOnline
    const isAssigningThis = assigningPartnerId === partner.id
    const isExpanded = expandedPartnerId === partner.id

    return (
      <div
        key={partner.id}
        className={`rounded-xl border transition-all ${
          isCurrentlyAssigned
            ? "border-emerald-300 bg-emerald-50/50 shadow-xs"
            : isBusy
            ? "border-amber-200 bg-amber-50/20 hover:border-amber-300"
            : isOffline
            ? "border-slate-200 bg-slate-50/60 opacity-90 hover:opacity-100"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
        }`}
      >
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Partner Identity & Status */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-sm text-slate-700">
                {partner.name ? partner.name.slice(0, 2).toUpperCase() : "DP"}
              </div>
              {/* Live Online Dot */}
              <span
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  partner.isOnline ? "bg-emerald-500 ring-2 ring-emerald-100" : "bg-slate-400"
                }`}
                title={partner.isOnline ? "Online" : "Offline"}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-slate-900 truncate">
                  {partner.name}
                </h4>

                {/* Zone Badge */}
                {isRestaurantZone ? (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-orange-600" />
                    Restaurant Zone
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    Zone: {partner.zoneName || "Other"}
                  </span>
                )}

                {/* Workload Badge */}
                {isCurrentlyAssigned ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Assigned to this order
                  </span>
                ) : isAvailable ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Available • 0 Active
                  </span>
                ) : isBusy ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-600" />
                    Busy • {partner.activeOrdersCount || 1} Active Orders
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    Offline
                  </span>
                )}

                {partner.distanceKm != null && (
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {Number(partner.distanceKm).toFixed(1)} km away
                  </span>
                )}
              </div>

              {/* Contact & Vehicle Info */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {partner.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {partner.phone}
                  </span>
                )}
                {partner.vehicle && (partner.vehicle.plateNumber || partner.vehicle.type || partner.vehicle.model) && (
                  <span className="flex items-center gap-1 text-slate-600">
                    <Truck className="w-3 h-3 text-slate-400" />
                    {partner.vehicle.type || "Vehicle"}{" "}
                    {partner.vehicle.plateNumber ? `(${partner.vehicle.plateNumber})` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions and Active Order Inspector */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {/* Expand Active Orders if any */}
            {partner.activeOrders && partner.activeOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setExpandedPartnerId(isExpanded ? null : partner.id)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1"
                title="Inspect active orders"
              >
                <span>{partner.activeOrders.length} active</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Main Assign Button */}
            {isCurrentlyAssigned ? (
              <button
                disabled
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default"
              >
                Assigned
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAssignClick(partner)}
                disabled={loading || assigningPartnerId !== null}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isBusy
                    ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                    : isOffline
                    ? "bg-slate-700 hover:bg-slate-800"
                    : "bg-gradient-to-r from-orange-500 to-emerald-600 hover:from-orange-600 hover:to-emerald-700"
                }`}
              >
                {isAssigningThis ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Assigning...
                  </>
                ) : isBusy ? (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    Assign (+1 Order)
                  </>
                ) : isOffline ? (
                  <>
                    <span>Assign (Offline)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Assign Partner
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Active Orders Drawer/Expansion */}
        {isExpanded && partner.activeOrders && partner.activeOrders.length > 0 && (
          <div className="border-t border-slate-200/80 bg-slate-50/70 p-3.5 rounded-b-xl space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              Current Active Deliveries ({partner.activeOrders.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {partner.activeOrders.map((act) => (
                <div
                  key={act.id || act.orderId}
                  className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span>Order {act.orderId || act.id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                      {act.status || "In Delivery"}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] mt-1 flex items-center justify-between">
                    <span className="truncate">{act.restaurantName || "Restaurant"}</span>
                    {act.createdAt && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!order) return null

  const orderDisplayId = order.orderId || order.id || `#${String(orderTargetId).slice(-6)}`
  const restaurantName = order.restaurant || order.restaurantName || order.restaurantId?.name || "Restaurant"
  const customerName = order.customerName || order.userId?.name || "Customer"

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <DialogHeader className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Assign Delivery Partner
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-0.5">
                  Order <span className="font-semibold text-orange-400">{orderDisplayId}</span> • {restaurantName}
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => fetchPartners(false)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60 flex items-center gap-1.5 text-xs font-medium"
              title="Refresh Partner List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-orange-400" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Restaurant Zone Badge & Current Assignment Notice */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center gap-2 text-xs text-orange-300">
              <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>
                Restaurant Zone: <strong className="text-white">{restaurantZone.name || "Configured Zone"}</strong>
              </span>
            </div>

            {currentAssignedPartner && (
              <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Currently assigned to <strong className="text-white">{currentAssignedPartner.name}</strong>
                  {currentAssignedPartner.phone && ` (${currentAssignedPartner.phone})`}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/30 text-amber-300 uppercase tracking-wider">
                  Reassign Mode
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Search & Workload Filter Bar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search partner by name, phone, or vehicle..."
              className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterTab === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              All Partners ({summary.total || partners.length})
            </button>
            <button
              onClick={() => setFilterTab("available")}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                filterTab === "available"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Available ({summary.available || 0})
            </button>
            <button
              onClick={() => setFilterTab("busy")}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                filterTab === "busy"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Busy ({summary.busy || 0})
            </button>
            <button
              onClick={() => setFilterTab("offline")}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                filterTab === "offline"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Offline ({summary.offline || 0})
            </button>
          </div>
        </div>

        {/* Partners List Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading delivery partners & workload...</p>
            </div>
          ) : totalFilteredCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Truck className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">No delivery partners found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {searchQuery
                  ? "No partners match your search query. Try clearing the search."
                  : "No delivery partners available under this status category."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION 1: RESTAURANT ZONE — SHOW FIRST */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-orange-200 bg-orange-50/60 -mx-2 px-3.5 py-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-orange-500 text-white shadow-xs">
                      Priority
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Restaurant Zone — {restaurantZone.name || "Configured Zone"}</span>
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200/60">
                    {filteredRestaurantZonePartners.length} {filteredRestaurantZonePartners.length === 1 ? "Partner" : "Partners"}
                  </span>
                </div>

                {filteredRestaurantZonePartners.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-orange-200 bg-orange-50/30 text-center">
                    <MapPin className="w-5 h-5 text-orange-400 mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-slate-700">
                      No delivery partners matching current filter in {restaurantZone.name || "the restaurant's zone"}.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      You can assign eligible delivery partners from other zones below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredRestaurantZonePartners.map((partner) => renderPartnerCard(partner, true))}
                  </div>
                )}
              </div>

              {/* SECTION 2: OTHER ZONES — SHOW BELOW */}
              <div className="space-y-4 pt-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Other Zones</h3>
                    <span className="text-xs text-slate-500">
                      (Cross-Zone Manual Assignment Permitted)
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {filteredOtherZones.reduce((sum, g) => sum + g.partners.length, 0)} Total
                  </span>
                </div>

                {filteredOtherZones.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
                    <p className="text-xs text-slate-400">
                      No delivery partners in other zones match current filters.
                    </p>
                  </div>
                ) : (
                  filteredOtherZones.map((group) => (
                    <div key={group.zoneId || group.zoneName} className="space-y-2.5 pl-1">
                      <div className="flex items-center justify-between text-xs text-slate-700 font-semibold bg-slate-100/80 px-3.5 py-1.5 rounded-lg border border-slate-200">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          Zone: {group.zoneName}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {group.partners.length} {group.partners.length === 1 ? "partner" : "partners"}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {group.partners.map((partner) => renderPartnerCard(partner, false))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal Sheet for Reassignment or Offline Partner */}
        {pendingPartner && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 text-white shrink-0 space-y-3 animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {currentAssignedPartner
                      ? `Reassign Order to ${pendingPartner.name}?`
                      : `Assign Order to ${pendingPartner.name}?`}
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {currentAssignedPartner ? (
                      <>
                        This order is already assigned to{" "}
                        <strong className="text-amber-300">{currentAssignedPartner.name}</strong>. Reassigning will notify the new partner.
                      </>
                    ) : pendingPartner.workloadStatus === "busy" ? (
                      <>
                        {pendingPartner.name} has {pendingPartner.activeOrdersCount || 1} active deliveries. This order will be queued for them.
                      </>
                    ) : !pendingPartner.isOnline ? (
                      <>
                        {pendingPartner.name} is currently offline. They will receive the order upon logging in.
                      </>
                    ) : (
                      "Please confirm your delivery partner assignment."
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingPartner(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If offline, checkbox confirmation */}
            {!pendingPartner.isOnline && (
              <label className="flex items-center gap-2.5 text-xs text-amber-200 cursor-pointer bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                <input
                  type="checkbox"
                  checked={confirmAllowOffline}
                  onChange={(e) => setConfirmAllowOffline(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-400"
                />
                <span>Acknowledge partner is offline and dispatch anyway (allowOffline)</span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingPartner(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigningPartnerId !== null || (!pendingPartner.isOnline && !confirmAllowOffline)}
                onClick={() =>
                  executeAssignment(pendingPartner, {
                    reassign: Boolean(currentAssignedPartner),
                    allowOffline: Boolean(!pendingPartner.isOnline && confirmAllowOffline),
                    notes: reassignReason || undefined,
                  })
                }
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-1.5"
              >
                {assigningPartnerId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {currentAssignedPartner ? "Confirm Reassignment" : "Confirm Assignment"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Online: <strong>{summary.online || 0}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Busy: <strong>{summary.busy || 0}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Offline: <strong>{summary.offline || 0}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-1.5 rounded-lg font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
