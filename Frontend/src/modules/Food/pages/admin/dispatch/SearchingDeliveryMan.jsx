import { useState, useMemo, useEffect, useCallback } from "react"
import io from "socket.io-client"
import { getSocketUrl } from "@food/utils/socketConfig"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import DispatchOrdersTable from "@food/components/admin/orders/DispatchOrdersTable"
import DispatchFilterPanel from "@food/components/admin/orders/DispatchFilterPanel"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import AssignDeliveryPartnerModal from "@food/components/admin/orders/AssignDeliveryPartnerModal"
import { useGenericTableManagement } from "@food/components/admin/orders/useGenericTableManagement"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function SearchingDeliveryMan() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [visibleColumns, setVisibleColumns] = useState({
    sl: true,
    order: true,
    date: true,
    customer: true,
    restaurant: true,
    total: true,
    status: true,
    actions: true,
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchQuery])

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState(null)

  // Fetch orders from API
  const fetchOrders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const response = await adminAPI.getSearchingDeliverymanOrders({
        search: debouncedSearchQuery || undefined,
        limit: 1000 // Get all orders
      })

      if (response?.data?.success && response.data.data?.orders) {
        setOrders(response.data.data.orders)
      } else {
        setOrders([])
        if (response?.data?.message && !silent) {
          toast.error(response.data.message)
        }
      }
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.message || error.message || 'Failed to fetch orders')
      }
      setOrders([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [debouncedSearchQuery])

  useEffect(() => {
    fetchOrders(false)
  }, [fetchOrders])

  // Socket listener for live updates
  useEffect(() => {
    const socketUrl = getSocketUrl()
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
    })

    socket.on("connect", () => {
      socket.emit("join-admin-orders")
    })

    const handleUpdate = () => {
      fetchOrders(true)
    }

    socket.on("admin_dispatch_updated", handleUpdate)
    socket.on("admin_order_status_update", handleUpdate)
    socket.on("admin_new_order", handleUpdate)

    return () => {
      socket.off("admin_dispatch_updated", handleUpdate)
      socket.off("admin_order_status_update", handleUpdate)
      socket.off("admin_new_order", handleUpdate)
      socket.disconnect()
    }
  }, [fetchOrders])

  const {
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    filteredData,
    count,
    activeFiltersCount,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
  } = useGenericTableManagement(
    orders,
    "Searching For Deliverymen Orders",
    ["id", "customerName", "restaurant", "customerPhone"]
  )

  const resetColumns = () => {
    setVisibleColumns({
      sl: true,
      order: true,
      date: true,
      customer: true,
      restaurant: true,
      total: true,
      status: true,
      actions: true,
    })
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            Searching For Deliverymen Orders
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All orders that are currently searching for a deliveryman.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 border border-blue-100">
            Unassigned Orders: {count}
          </span>
        </div>
      </div>
      <OrdersTopbar 
        title="Searching For Deliverymen Orders" 
        count={count} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <DispatchFilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={{
          sl: "Serial Number",
          order: "Order",
          date: "Date",
          customer: "Customer",
          restaurant: "Restaurant",
          total: "Total Amount",
          status: "Order Status",
          actions: "Actions",
        }}
      />
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
        onAssignDeliveryPartner={(ord) => {
          setSelectedOrderForAssign(ord)
          setAssignModalOpen(true)
        }}
        onOrderUpdated={() => fetchOrders(true)}
      />
      <AssignDeliveryPartnerModal
        isOpen={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        order={selectedOrderForAssign}
        onAssigned={() => fetchOrders(true)}
      />
      <DispatchOrdersTable 
        orders={filteredData} 
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
        onAssignDeliveryPartner={(ord) => {
          setSelectedOrderForAssign(ord)
          setAssignModalOpen(true)
        }}
      />
    </div>
  )
}

