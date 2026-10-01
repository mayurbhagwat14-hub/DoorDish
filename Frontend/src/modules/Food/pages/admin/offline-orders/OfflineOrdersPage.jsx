import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import io from "socket.io-client"
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  XCircle,
  Filter,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import { adminAPI } from "@food/api"
import { getSocketUrl } from "@food/utils/socketConfig"
import { toast } from "sonner"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Badge } from "@food/components/ui/badge"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"
import { TableSkeleton } from "@food/components/ui/loading-skeletons"

const formatINR = (value, digits = 0) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  })}`

const getStatusBadge = (orderStatus) => {
  const status = String(orderStatus || "").toLowerCase()
  if (status.includes("deliver")) {
    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Delivered</Badge>
  }
  if (status.includes("way") || status.includes("transit") || status.includes("picked")) {
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Food On The Way</Badge>
  }
  if (status.includes("process") || status.includes("prepar") || status.includes("ready")) {
    return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Preparing</Badge>
  }
  if (status.includes("accept") || status.includes("confirm")) {
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Accepted</Badge>
  }
  if (status.includes("cancel") || status.includes("reject")) {
    return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Canceled</Badge>
  }
  if (status.includes("creat") || status.includes("pend")) {
    return <Badge className="bg-sky-100 text-sky-800 border-sky-200">Pending</Badge>
  }
  return <Badge className="bg-slate-100 text-slate-800 border-slate-200">{orderStatus || "Pending"}</Badge>
}

export default function OfflineOrdersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all") // 'all', 'today', 'week', 'month'
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [totalOrders, setTotalOrders] = useState(0)

  const [selectedOrderForView, setSelectedOrderForView] = useState(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  const socketRef = useRef(null)

  // Fetch offline orders from backend
  const fetchOfflineOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        orderSource: "admin_offline",
      }

      if (statusFilter && statusFilter !== "all") {
        params.status = statusFilter
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }

      const response = await adminAPI.getOfflineOrders(params)
      const payload = response?.data?.data || response?.data || {}
      const rawOrders =
        payload?.orders ??
        payload?.docs ??
        payload?.data ??
        (Array.isArray(payload) ? payload : [])
      const list = Array.isArray(rawOrders) ? rawOrders : []
      const meta = payload?.meta || payload?.pagination || {}
      const totalCount = Number(meta.total ?? payload?.total ?? list.length) || list.length

      setOrders(list)
      setTotalOrders(totalCount)
    } catch (err) {
      console.error("Failed to fetch offline orders:", err)
      toast.error("Failed to load offline orders")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [currentPage, pageSize, statusFilter, searchQuery])

  useEffect(() => {
    fetchOfflineOrders()
  }, [fetchOfflineOrders])

  // Setup Real-time updates via Socket.IO
  useEffect(() => {
    let socket = null
    try {
      const socketUrl = getSocketUrl()
      const socketFn = typeof io === "function" ? io : io?.io || io?.default
      if (socketFn && socketUrl) {
        socket = socketFn(socketUrl, {
          path: "/socket.io",
          transports: ["websocket", "polling"],
          reconnection: true,
          timeout: 8000,
        })
        socketRef.current = socket

        socket.on("connect", () => {
          socket.emit("join_admin_orders")
        })

        socket.on("order_status_update", () => {
          fetchOfflineOrders(true)
        })

        socket.on("new_order", (payload) => {
          if (payload?.orderSource === "admin_offline" || payload?.order?.orderSource === "admin_offline") {
            fetchOfflineOrders(true)
          }
        })
      }
    } catch (err) {
      console.warn("Socket.io init failed:", err)
    }

    return () => {
      try {
        if (socket && typeof socket.disconnect === "function") {
          socket.disconnect()
        }
      } catch (_) {}
    }
  }, [fetchOfflineOrders])

  // Client-side date filtering if backend doesn't filter by date range
  const filteredOrders = useMemo(() => {
    if (dateFilter === "all") return orders

    const now = new Date()
    return orders.filter((o) => {
      const createdAt = new Date(o.createdAt || o.placedAt)
      if (isNaN(createdAt.getTime())) return true

      if (dateFilter === "today") {
        return createdAt.toDateString() === now.toDateString()
      }
      if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return createdAt >= weekAgo
      }
      if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return createdAt >= monthAgo
      }
      return true
    })
  }, [orders, dateFilter])

  // Stats calculation
  const stats = useMemo(() => {
    let delivered = 0
    let active = 0
    let totalRevenue = 0

    orders.forEach((o) => {
      const st = String(o.orderStatus || o.status || "").toLowerCase()
      const total = Number(o.pricing?.total ?? o.total ?? o.finalTotal ?? 0)
      if (st.includes("deliver")) {
        delivered++
        totalRevenue += total
      } else if (!st.includes("cancel") && !st.includes("reject")) {
        active++
      }
    })

    return {
      total: totalOrders || orders.length,
      active,
      delivered,
      revenue: totalRevenue,
    }
  }, [orders, totalOrders])

  const formatAddress = (addr) => {
    if (!addr) return "N/A"
    if (typeof addr === "string") return addr
    const parts = [
      addr.street,
      addr.additionalDetails,
      addr.area,
      addr.city,
      addr.state,
      addr.zipCode || addr.pincode,
    ].filter(Boolean)
    return parts.join(", ") || addr.formattedAddress || "Address on file"
  }

  const formatItemsList = (items) => {
    if (!Array.isArray(items) || items.length === 0) return "No items"
    return items
      .map((it) => `${it.quantity || 1} × ${it.name || it.itemName || "Item"}`)
      .join(", ")
  }

  const formatOrderDate = (dateString) => {
    if (!dateString) return "N/A"
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return "N/A"
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize) || 1)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Offline Orders</h1>
              <p className="text-sm text-slate-500 mt-0.5">Place and manage orders on behalf of customers.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOfflineOrders(true)}
            disabled={isRefreshing}
            className="border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin text-orange-600" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={() => navigate("/admin/food/offline-orders/new")}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm shadow-orange-600/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Order
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Offline</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">In Progress</p>
            <p className="text-2xl font-bold text-blue-600 mt-0.5">{stats.active}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Delivered</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.delivered}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Delivered Value</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{formatINR(stats.revenue)}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by Order ID, Customer, or Restaurant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 text-sm border border-slate-200 rounded-lg px-3 bg-white text-slate-700 outline-none focus:border-orange-500"
          >
            <option value="all">All Statuses</option>
            <option value="created">Created</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="processing">Processing</option>
            <option value="food-on-the-way">Food On The Way</option>
            <option value="delivered">Delivered</option>
            <option value="canceled">Canceled</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 text-sm border border-slate-200 rounded-lg px-3 bg-white text-slate-700 outline-none focus:border-orange-500"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Past 30 Days</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Offline Orders Found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all" || dateFilter !== "all"
                ? "Try adjusting your search query or filters to find orders."
                : "No offline orders have been placed yet. Click 'New Order' to place an order on behalf of a customer."}
            </p>
            <Button
              onClick={() => navigate("/admin/food/offline-orders/new")}
              className="mt-5 bg-orange-600 hover:bg-orange-700 text-white font-medium"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Offline Order
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Order ID</th>
                  <th className="py-3.5 px-4">Restaurant</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Delivery Address</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Delivery Fee</th>
                  <th className="py-3.5 px-4">Order Status</th>
                  <th className="py-3.5 px-4">Order / Payment Type</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const orderId = order.orderId || String(order._id).slice(-6).toUpperCase()
                  const restaurantName =
                    order.restaurant?.name ||
                    order.restaurant?.restaurantName ||
                    order.restaurantName ||
                    "Restaurant"
                  const customerName =
                    order.customerName ||
                    order.deliveryAddress?.name ||
                    order.deliveryAddress?.fullName ||
                    "Walk-in Customer"
                  const customerPhone =
                    order.customerPhone ||
                    order.deliveryAddress?.phone ||
                    order.user?.phone ||
                    "N/A"
                  const total =
                    order.pricing?.total ?? order.total ?? order.totalAmount ?? order.finalTotal ?? 0
                  const deliveryFee =
                    order.pricing?.deliveryFee ?? order.deliveryFee ?? order.deliveryCharge ?? 0

                  return (
                    <tr
                      key={order._id || order.id || orderId}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <span className="text-orange-600 hover:underline cursor-pointer block" onClick={() => {
                          setSelectedOrderForView(order)
                          setViewDialogOpen(true)
                        }}>
                          #{orderId}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-800 max-w-[160px] truncate" title={restaurantName}>
                        {restaurantName}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{customerName}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{customerPhone}</div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[200px]">
                        <p className="text-xs text-slate-600 line-clamp-2" title={formatAddress(order.deliveryAddress)}>
                          {formatAddress(order.deliveryAddress)}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 max-w-[180px]">
                        <p className="text-xs text-slate-700 line-clamp-2" title={formatItemsList(order.items)}>
                          {formatItemsList(order.items)}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatINR(total)}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                        {deliveryFee > 0 ? formatINR(deliveryFee) : "Free"}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(order.orderStatus || order.status)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Offline / COD
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatOrderDate(order.createdAt || order.placedAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOrderForView(order)
                            setViewDialogOpen(true)
                          }}
                          className="h-8 w-8 p-0 text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredOrders.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>
              Showing <span className="font-semibold text-slate-800">{filteredOrders.length}</span> of{" "}
              <span className="font-semibold text-slate-800">{totalOrders}</span> offline orders
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 border-slate-200 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-xs font-medium px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 border-slate-200 text-slate-600"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Order Dialog */}
      {selectedOrderForView && (
        <ViewOrderDialog
          order={selectedOrderForView}
          isOpen={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          onOrderUpdated={() => fetchOfflineOrders(true)}
        />
      )}
    </div>
  )
}
