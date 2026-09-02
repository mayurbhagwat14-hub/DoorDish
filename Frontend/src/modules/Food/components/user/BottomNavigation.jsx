import { useLocation, useNavigate } from "react-router-dom"
import { Home, Compass, ShoppingBag, Tag, ShoppingCart } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { useCart } from "@food/context/CartContext"
import { subscribeBottomNavShow } from "@food/utils/bottomNavEvents"

const HIDE_LOCK_MS = 900

export default function BottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const { getCartCount } = useCart()
  const cartCount = getCartCount ? getCartCount() : 0

  const [isVisible, setIsVisible] = useState(true)
  const lastScrollYRef = useRef(typeof window !== "undefined" ? window.scrollY : 0)
  const accumulatedScrollUpRef = useRef(0)
  const accumulatedScrollDownRef = useRef(0)
  const isVisibleRef = useRef(true)
  const hideLockUntilRef = useRef(0)

  const showNavAtTop = useCallback((lockMs = 0) => {
    accumulatedScrollDownRef.current = 0
    accumulatedScrollUpRef.current = 0
    if (typeof window !== "undefined") {
      lastScrollYRef.current = window.scrollY
    }
    if (lockMs > 0) {
      hideLockUntilRef.current = Date.now() + lockMs
    }
    if (!isVisibleRef.current) {
      isVisibleRef.current = true
      setIsVisible(true)
    }
  }, [])

  useEffect(() => {
    showNavAtTop(HIDE_LOCK_MS)
  }, [pathname, showNavAtTop])

  useEffect(() => {
    return subscribeBottomNavShow((e) => {
      const lockMs = Number(e?.detail?.lockMs) || HIDE_LOCK_MS
      showNavAtTop(lockMs)
    })
  }, [showNavAtTop])

  useEffect(() => {
    const SHOW_THRESHOLD = 150
    const HIDE_THRESHOLD = 80

    const controlNavbar = () => {
      const currentScrollY = window.scrollY
      const lastScrollY = lastScrollYRef.current

      if (Date.now() < hideLockUntilRef.current) {
        lastScrollYRef.current = currentScrollY
        if (!isVisibleRef.current) {
          isVisibleRef.current = true
          setIsVisible(true)
        }
        return
      }

      if (currentScrollY <= 50) {
        showNavAtTop()
        return
      }

      if (currentScrollY > lastScrollY) {
        const delta = currentScrollY - lastScrollY
        accumulatedScrollDownRef.current += delta
        accumulatedScrollUpRef.current = 0

        if (accumulatedScrollDownRef.current > HIDE_THRESHOLD && currentScrollY > 100) {
          if (isVisibleRef.current) {
            isVisibleRef.current = false
            setIsVisible(false)
          }
        }
      } else {
        const delta = lastScrollY - currentScrollY
        accumulatedScrollUpRef.current += delta
        accumulatedScrollDownRef.current = 0

        if (accumulatedScrollUpRef.current > SHOW_THRESHOLD) {
          if (!isVisibleRef.current) {
            isVisibleRef.current = true
            setIsVisible(true)
          }
        }
      }

      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener("scroll", controlNavbar, { passive: true })
    return () => window.removeEventListener("scroll", controlNavbar)
  }, [showNavAtTop])

  const normalizedPath = pathname.replace(/\/$/, "") || "/"

  const isHome =
    normalizedPath === "/food" ||
    normalizedPath === "/food/user" ||
    normalizedPath === "/user" ||
    normalizedPath === "/"

  const isExplore =
    normalizedPath.startsWith("/food/user/categories") ||
    normalizedPath.startsWith("/food/user/category") ||
    normalizedPath.startsWith("/food/user/search")

  const isOrders = normalizedPath.startsWith("/food/user/orders")
  const isOffers = normalizedPath.startsWith("/food/user/offers")
  const isCart = normalizedPath.startsWith("/food/user/cart")

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      to: "/food/user",
      active: isHome,
    },
    {
      id: "explore",
      label: "Explore",
      icon: Compass,
      to: "/food/user/categories",
      active: isExplore,
    },
    {
      id: "orders",
      label: "Orders",
      icon: ShoppingBag,
      to: "/food/user/orders",
      active: isOrders,
      isRaisedCenter: true,
    },
    {
      id: "offers",
      label: "Offers",
      icon: Tag,
      to: "/food/user/offers",
      active: isOffers,
    },
    {
      id: "cart",
      label: "Cart",
      icon: ShoppingCart,
      to: "/food/user/cart",
      active: isCart,
      badge: cartCount > 0 ? (cartCount > 99 ? "99+" : cartCount) : null,
    },
  ]

  const handleTabClick = (e, item) => {
    e.preventDefault()
    e.stopPropagation()

    showNavAtTop(HIDE_LOCK_MS)
    const current = normalizedPath
    const target = item.to.replace(/\/$/, "") || "/"
    navigate(item.to, { replace: current === target })
  }

  return (
    <motion.div
      initial={false}
      animate={{ y: isVisible ? 0 : 120 }}
      transition={{
        type: "tween",
        ease: [0.22, 1, 0.36, 1],
        duration: 0.25,
      }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-[11000] pointer-events-none"
      aria-hidden={!isVisible}
    >
      <div className="relative max-w-md mx-auto pointer-events-auto">
        <div className="bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex items-center justify-between px-3 pt-2 pb-3.5 relative rounded-t-3xl">
          {navItems.map((item) => {
            const Icon = item.icon

            if (item.isRaisedCenter) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => handleTabClick(e, item)}
                  className="flex flex-col items-center justify-center -mt-7 relative group touch-manipulation focus:outline-none"
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 active:scale-95 ${
                      item.active
                        ? "bg-[#FF5A1F] text-white shadow-[#FF5A1F]/30 ring-4 ring-[#FFF7F2]"
                        : "bg-[#FF5A1F] text-white shadow-[#FF5A1F]/25 hover:bg-[#E64A0F]"
                    }`}
                  >
                    <Icon className="h-6 w-6 stroke-[2.2]" />
                  </div>
                  <span
                    className={`text-[10px] font-bold mt-1 transition-colors ${
                      item.active ? "text-[#FF5A1F]" : "text-gray-500"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              )
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={(e) => handleTabClick(e, item)}
                className={`flex flex-col items-center justify-center py-1 px-3 min-w-[56px] relative transition-colors duration-200 touch-manipulation focus:outline-none ${
                  item.active ? "text-[#FF5A1F]" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`h-5 w-5 transition-transform duration-200 ${
                      item.active ? "scale-110 stroke-[2.5]" : "stroke-[1.8]"
                    }`}
                  />
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-2.5 bg-[#FF5A1F] text-white text-[9px] font-black h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold mt-1 tracking-tight ${
                    item.active ? "font-bold text-[#FF5A1F]" : "text-gray-500"
                  }`}
                >
                  {item.label}
                </span>
                {item.active && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#FF5A1F]"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
