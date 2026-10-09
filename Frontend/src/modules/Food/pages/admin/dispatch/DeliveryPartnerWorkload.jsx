import { useState, useEffect, useMemo, useCallback } from "react"
import io from "socket.io-client"
import {
  Truck,
  Users,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  Package,
  Eye,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Activity,
  ArrowUpDown,
  Filter,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react"
import { adminAPI } from "@food/api"
import { getSocketUrl } from "@food/utils/socketConfig"
import { toast } from "sonner"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"

export default function DeliveryPartnerWorkload() {
  const [partners, setPartners] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    online: 0,
    available: 0,
    busy: 0,
    offline: 0,
    totalActiveAssignments: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // 'all' | 'available' | 'busy' | 'offline' | 'online'
  const [sortBy, setSortBy] = useState("activeOrders") // 'activeOrders' | 'name' | 'completed'
  const [sortDirection, setSortDirection] = useState("desc")
  const [expandedPartnerId, setExpandedPartnerId] = useState(null)

  // Order viewing modal state
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false)
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false)

  const fetchWorkload = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const response = await adminAPI.getDeliveryPartnersWorkload({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
        limit: 200,
      })

      if (response?.data?.success && response.data.data) {
        const data = response.data.data
        const rawPartners = data.partners || []
        const counts = data.counts || data.summary || {}

        const normalized = rawPartners.map((p) => {
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
          }
        })

        const onlineComputed = normalized.filter((p) => p.isOnline).length
        const availableComputed = normalized.filter((p) => p.isOnline && p.workloadStatus === "available").length
        const busyComputed = normalized.filter((p) => p.isOnline && p.workloadStatus === "busy").length
        const offlineComputed = normalized.filter((p) => !p.isOnline).length

        setPartners(normalized)
        setSummary({
          total: counts.total ?? normalized.length,
          online: counts.online ?? onlineComputed,
          available: counts.available ?? availableComputed,
          busy: counts.busy ?? busyComputed,
          offline: counts.offline ?? offlineComputed,
          totalActiveAssignments: counts.totalActiveAssignments ?? normalized.reduce((acc, p) => acc + (p.activeOrdersCount || 0), 0),
        })
      } else {
        setPartners([])
      }
    } catch (error) {
      console.error("Error fetching delivery partner workload:", error)
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to fetch partner workload")
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    fetchWorkload(false)
  }, [fetchWorkload])

  // Live updates via Socket.IO
  useEffect(() => {
    const socketUrl = getSocketUrl()
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
    })

    socket.on("connect", () => {
      socket.emit("join-admin-orders")
    })

    const handleRealtimeUpdate = (payload = {}) => {
      // Refresh fleet data silently
      fetchWorkload(true)
    }

    socket.on("admin_dispatch_updated", handleRealtimeUpdate)
    socket.on("admin_order_status_update", handleRealtimeUpdate)
    socket.on("order_status_update", handleRealtimeUpdate)
    socket.on("admin_new_order", handleRealtimeUpdate)

    return () => {
      socket.off("admin_dispatch_updated", handleRealtimeUpdate)
      socket.off("admin_order_status_update", handleRealtimeUpdate)
      socket.off("order_status_update", handleRealtimeUpdate)
      socket.off("admin_new_order", handleRealtimeUpdate)
      socket.disconnect()
    }
  }, [fetchWorkload])

  // Handle viewing order details
  const handleInspectOrder = async (orderSummary) => {
    const orderIdToFetch = orderSummary.id || orderSummary._id || orderSummary.orderId
    if (!orderIdToFetch) return

    setLoadingOrderDetails(true)
    try {
      const response = await adminAPI.getOrderById(orderIdToFetch)
      if (response?.data?.success && response.data.data) {
        const fetchedOrder = response.data.data.order || response.data.data
        setSelectedOrder(fetchedOrder)
        setIsViewOrderOpen(true)
      } else {
        // Fallback to basic summary object
        setSelectedOrder(orderSummary)
        setIsViewOrderOpen(true)
      }
    } catch (error) {
      console.error("Error fetching order details:", error)
      // Still open with summary info
      setSelectedOrder(orderSummary)
      setIsViewOrderOpen(true)
    } finally {
      setLoadingOrderDetails(false)
    }
  }

  // Sorting
  const sortedPartners = useMemo(() => {
    const list = [...partners]
    list.sort((a, b) => {
      let aVal = 0
      let bVal = 0
      if (sortBy === "activeOrders") {
        aVal = a.activeOrdersCount || 0
        bVal = b.activeOrdersCount || 0
      } else if (sortBy === "completed") {
        aVal = a.completedOrdersCount || 0
        bVal = b.completedOrdersCount || 0
      } else if (sortBy === "name") {
        aVal = (a.name || "").toLowerCase()
        bVal = (b.name || "").toLowerCase()
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal
    })
    return list
  }, [partners, sortBy, sortDirection])

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortDirection("desc")
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Delivery Fleet Workload & Operations
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Monitoring
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time delivery partner status, multi-order assignment distribution, and active fleet capacity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchWorkload(false)}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-semibold text-xs shadow-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-orange-600" : ""}`} />
          Refresh Fleet
        </button>
      </div>

      {/* KPI Workload Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Fleet */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Fleet</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{summary.total || 0}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Registered partners</p>
          </div>
        </div>

        {/* Online Partners */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Online Now</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-600">{summary.online || 0}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {summary.total > 0
                ? `${Math.round(((summary.online || 0) / summary.total) * 100)}% of fleet`
                : "0% active"}
            </p>
          </div>
        </div>

        {/* Available Partners */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-700">{summary.available || 0}</span>
            <p className="text-[11px] text-emerald-600 mt-0.5">0 Active Deliveries</p>
          </div>
        </div>

        {/* Busy Partners */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Busy Fleet</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-amber-700">{summary.busy || 0}</span>
            <p className="text-[11px] text-amber-600 mt-0.5">Active Deliveries Assigned</p>
          </div>
        </div>

        {/* Offline Partners */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Offline</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-600">{summary.offline || 0}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Disconnected</p>
          </div>
        </div>

        {/* Total Active Assignments */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 bg-indigo-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-semibold uppercase tracking-wider">In-Flight Orders</span>
            <Truck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-indigo-700">
              {summary.totalActiveAssignments || 0}
            </span>
            <p className="text-[11px] text-indigo-600 mt-0.5">Live active trips</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search partners by name, phone, vehicle plate..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { key: "all", label: `All (${summary.total || 0})` },
            { key: "available", label: `Available (${summary.available || 0})` },
            { key: "busy", label: `Busy (${summary.busy || 0})` },
            { key: "online", label: `Online (${summary.online || 0})` },
            { key: "offline", label: `Offline (${summary.offline || 0})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === tab.key
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Partner Workload Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading delivery fleet workload...</p>
          </div>
        ) : sortedPartners.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No delivery partners found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery
                ? "No partners match the current search term."
                : "No delivery partners match this workload filter category."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  <th
                    className="py-3.5 px-6 cursor-pointer hover:text-slate-800 transition-colors"
                    onClick={() => toggleSort("name")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Delivery Partner</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-6">Presence</th>
                  <th className="py-3.5 px-6">Workload Status</th>
                  <th
                    className="py-3.5 px-6 cursor-pointer hover:text-slate-800 transition-colors"
                    onClick={() => toggleSort("activeOrders")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Active Orders</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-6 cursor-pointer hover:text-slate-800 transition-colors"
                    onClick={() => toggleSort("completed")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Completed</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-6">Vehicle</th>
                  <th className="py-3.5 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedPartners.map((partner) => {
                  const isExpanded = expandedPartnerId === partner.id
                  const isBusy = partner.workloadStatus === "busy"
                  const isOnline = partner.isOnline
                  const activeCount = partner.activeOrdersCount || 0
                  const activeOrders = partner.activeOrders || []

                  return (
                    <tr
                      key={partner.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isExpanded ? "bg-slate-50/50" : ""
                      }`}
                    >
                      <td colSpan={7} className="p-0">
                        {/* Partner Row Header */}
                        <div className="flex items-center justify-between py-4 px-6 gap-4">
                          {/* Partner identity */}
                          <div className="flex items-center gap-3 min-w-[220px]">
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shadow-sm">
                                {partner.name ? partner.name.slice(0, 2).toUpperCase() : "DP"}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                  isOnline ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                              />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 leading-tight">
                                {partner.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                {partner.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {partner.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Presence */}
                          <div className="min-w-[100px]">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Offline
                              </span>
                            )}
                          </div>

                          {/* Workload */}
                          <div className="min-w-[130px]">
                            {isBusy ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Layers className="w-3 h-3 text-amber-600" />
                                Busy ({activeCount})
                              </span>
                            ) : isOnline ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Available
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Offline
                              </span>
                            )}
                          </div>

                          {/* Active Orders count */}
                          <div className="min-w-[100px]">
                            <span
                              className={`text-sm font-bold ${
                                activeCount > 0 ? "text-amber-600" : "text-slate-400"
                              }`}
                            >
                              {activeCount} {activeCount === 1 ? "order" : "orders"}
                            </span>
                          </div>

                          {/* Completed count */}
                          <div className="min-w-[100px]">
                            <span className="text-sm font-medium text-slate-700">
                              {partner.completedOrdersCount || 0}
                            </span>
                          </div>

                          {/* Vehicle info */}
                          <div className="min-w-[140px] text-xs text-slate-600">
                            {partner.vehicle ? (
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {partner.vehicle.type || "Bike"}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {partner.vehicle.plateNumber || partner.vehicle.model || ""}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Not set</span>
                            )}
                          </div>

                          {/* Inspector expand button */}
                          <div className="text-right shrink-0">
                            {activeOrders.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedPartnerId(isExpanded ? null : partner.id)
                                }
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 shadow-sm"
                              >
                                <span>Inspect ({activeOrders.length})</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium px-2">
                                No active trips
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Active Orders Inspection Sub-Panel */}
                        {isExpanded && activeOrders.length > 0 && (
                          <div className="bg-slate-50/90 border-t border-slate-200 px-6 py-4 space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                              <span className="flex items-center gap-1.5">
                                <Package className="w-4 h-4 text-orange-500" />
                                Active Deliveries Assigned to {partner.name}
                              </span>
                              <span>Total Active: {activeOrders.length}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {activeOrders.map((ord) => (
                                <div
                                  key={ord.id || ord.orderId}
                                  className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors"
                                >
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-sm text-slate-900">
                                        Order {ord.orderId || ord.id}
                                      </span>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                                        {ord.status || "In Delivery"}
                                      </span>
                                    </div>
                                    <p className="text-xs font-medium text-slate-700 mt-1 truncate">
                                      {ord.restaurantName || "Restaurant"}
                                    </p>
                                    {ord.createdAt && (
                                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(ord.createdAt).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleInspectOrder(ord)}
                                      className="px-2.5 py-1 rounded text-xs font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50 transition-colors flex items-center gap-1"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      View Order
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Dialog */}
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
        onOrderUpdated={() => fetchWorkload(true)}
      />
    </div>
  )
}
