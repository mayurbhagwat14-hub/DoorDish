import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { restaurantAPI } from "@food/api"

const normalizeZoneId = (value) => String(value || "").trim()

const resolveRestaurantZoneId = async (cartItem) => {
  const cachedZoneId = cartItem?.restaurantZoneId
  if (cachedZoneId) return normalizeZoneId(cachedZoneId)

  const restaurantId = cartItem?.restaurantId
  if (!restaurantId || typeof restaurantId === "object") return ""

  try {
    const response = await restaurantAPI.getRestaurantById(restaurantId)
    const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant
    return normalizeZoneId(restaurant?.zoneId)
  } catch {
    return ""
  }
}

/**
 * Clears cart when the active delivery zone changes while having items from a different zone.
 */
export function useCartZoneGuard(zoneId, zoneStatus) {
  const { cart, clearCart } = useCart()
  const { orderType } = useProfile()
  const validatingRef = useRef(false)
  const prevZoneIdRef = useRef(normalizeZoneId(zoneId))

  useEffect(() => {
    const currentZone = normalizeZoneId(zoneId)

    if (orderType === "takeaway" || orderType === "dining") {
      prevZoneIdRef.current = currentZone
      return
    }

    if (!cart.length) {
      prevZoneIdRef.current = currentZone
      return
    }

    if (zoneStatus === "loading" || !currentZone) return

    // On initial load or if prevZoneIdRef wasn't set, sync it with currentZone
    if (!prevZoneIdRef.current) {
      prevZoneIdRef.current = currentZone
      return
    }

    // Only run zone validation if the active delivery zone ID has actually CHANGED while cart has items
    if (prevZoneIdRef.current !== currentZone) {
      prevZoneIdRef.current = currentZone

      if (validatingRef.current) return
      let cancelled = false

      const validateCartZone = async () => {
        validatingRef.current = true
        try {
          const restaurantZoneId = await resolveRestaurantZoneId(cart[0])
          if (cancelled || !restaurantZoneId) return

          if (restaurantZoneId !== currentZone) {
            clearCart()
            toast.error("Cart cleared — location changed to an area outside this restaurant's delivery zone.")
          }
        } finally {
          validatingRef.current = false
        }
      }

      validateCartZone()
      return () => {
        cancelled = true
      }
    }
  }, [zoneId, zoneStatus, cart, clearCart, orderType])
}
