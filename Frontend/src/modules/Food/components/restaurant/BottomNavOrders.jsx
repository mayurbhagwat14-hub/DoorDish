import { useNavigate, useLocation } from "react-router-dom"
import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText,
  Package,
  MessageSquare,
  Compass,
} from "lucide-react"
import useNotificationInbox from "@food/hooks/useNotificationInbox"
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications"
import { DINING_ENABLED } from "@food/config/featureFlags"

const getOrdersTabs = (basePath = "/food/restaurant") => [
  { id: "orders", label: "Orders", icon: FileText, route: `${basePath}` },
  { id: "inventory", label: "Inventory", icon: Package, route: `${basePath}/inventory` },
  { id: "feedback", label: "Feedback", icon: MessageSquare, route: `${basePath}/feedback` },
  { id: "explore", label: "Explore", icon: Compass, route: `${basePath}/explore` },
]

const findActiveTab = (tabs, pathname) =>
  tabs
    .slice()
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => pathname === tab.route || pathname.startsWith(tab.route + "/"))

export default function BottomNavOrders({ activeTabOverride }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()


  const basePath = pathname.includes("/food/restaurant")
    ? "/food/restaurant"
    : pathname.includes("/restaurant")
      ? "/food/restaurant"
      : "/food/restaurant"

  const { unreadCount } = useNotificationInbox("restaurant", { limit: 20, pollMs: 60 * 1000 })
  const { newOrder, newReservation } = useRestaurantNotifications();

  const tabs = useMemo(() => getOrdersTabs(basePath), [basePath])

  // Must be before any early return to avoid hooks order violation
  const activeTab = useMemo(() => {
    if (activeTabOverride) return activeTabOverride;
    const match = findActiveTab(tabs, pathname)
    return match?.id || "orders"
  }, [tabs, pathname, activeTabOverride])

  const isInternalPage = pathname.includes("/create-offers") || pathname.includes("/help-centre/support")
  if (isInternalPage) {
    return null
  }

  const handleTabClick = (tab) => {
    if (tab.route && tab.route !== pathname) {
      navigate(tab.route)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md items-end gap-2">
        <div className="flex-1 min-w-0">
          <div className="relative overflow-hidden rounded-[30px] bg-white/95 dark:bg-[#181818]/95 border-2 border-[#FA5300] p-1.5 shadow-lg backdrop-blur-md">
            <div className="relative flex items-center justify-around gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab)}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 transition-all duration-200 ${
                      isActive
                        ? "bg-[#FA5300] text-white shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 transition-colors duration-200 ${
                        isActive ? "text-white" : "text-gray-500 dark:text-gray-400"
                      }`}
                    />
                    {/* Notification Dot */}
                    {((tab.id === 'orders' && (newOrder || (DINING_ENABLED && newReservation))) ||
                      (tab.id === 'feedback' && unreadCount > 0)) && (
                        <span className={`absolute top-1.5 right-1/4 w-2 h-2 rounded-full z-20 animate-pulse ${
                          isActive ? "bg-white" : "bg-[#FA5300]"
                        }`} />
                      )}
                    <span
                      className={`whitespace-nowrap text-[11px] leading-none transition-colors duration-200 ${
                        isActive ? "text-white font-bold" : "text-gray-600 dark:text-gray-400 font-medium"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}







