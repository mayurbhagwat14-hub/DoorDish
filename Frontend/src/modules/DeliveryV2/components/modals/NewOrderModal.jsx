import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, MapPin, FastForward, Clock, Phone, ChefHat, 
  ChevronDown, Volume2, VolumeX, Navigation, IndianRupee,
  ShoppingBag, Sparkles
} from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { computePickupMetrics } from '@/modules/DeliveryV2/utils/pickupMetrics';
import { PickupMetricsValue } from '@/modules/DeliveryV2/components/orders/NewOrderCard';
import { toast } from 'sonner';

export const NewOrderModal = ({ order, onAccept, onReject, onMinimize, isMuted = false, onToggleMute }) => {
  const { riderLocation } = useDeliveryStore();

  const metrics = useMemo(
    () => computePickupMetrics(order, riderLocation),
    [order, riderLocation],
  );

  if (!order) return null;

  const earnings = order.earnings || order.riderEarning || (order.orderAmount ? order.orderAmount * 0.1 : 0);
  const restaurantName = order.restaurantName || order.restaurant_name || (order.restaurantId?.name) || 'Restaurant';
  const restaurantAddress = order.restaurantAddress || order.restaurant_address || (order.restaurantId?.location?.address) || 'Address not available';
  const restaurantPhone =
    order.restaurantPhone ||
    order.restaurant_phone ||
    order.restaurantId?.primaryContactNumber ||
    order.restaurantId?.ownerPhone ||
    order.restaurantId?.phone ||
    '';
  const deliveryAddress = order?.deliveryAddress || {};

  const geoCoords =
    Array.isArray(deliveryAddress?.location?.coordinates) &&
    deliveryAddress.location.coordinates.length >= 2
      ? {
          lng: deliveryAddress.location.coordinates[0],
          lat: deliveryAddress.location.coordinates[1],
        }
      : null;

  const customerLocation = order.customerLocation || order.deliveryLocation || geoCoords || null;
  const customerName =
    order.customerName ||
    order.userId?.name ||
    order.user?.name ||
    order.deliveryAddress?.fullName ||
    order.deliveryAddress?.name ||
    'Customer';
  const customerPhone =
    order.customerPhone ||
    order.userPhone ||
    order.userId?.phone ||
    order.user?.phone ||
    order.deliveryAddress?.phone ||
    '';

  const addressPartsFromSchema = [
    deliveryAddress.street,
    deliveryAddress.additionalDetails,
    deliveryAddress.city,
    deliveryAddress.state,
    deliveryAddress.zipCode,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  const customerAddress =
    order.customerAddress ||
    order.customer_address ||
    (addressPartsFromSchema.length ? addressPartsFromSchema.join(', ') : '') ||
    (customerLocation?.lat != null && customerLocation?.lng != null
      ? `Lat ${Number(customerLocation.lat).toFixed(5)}, Lng ${Number(customerLocation.lng).toFixed(5)}`
      : 'Location not available');

  const handleCallRestaurant = () => {
    const num = String(restaurantPhone || '').replace(/\D/g, '');
    if (!num) {
      toast.error('Restaurant phone number not available');
      return;
    }
    window.location.href = `tel:${num}`;
  };

  const handleNavigateToRestaurant = () => {
    const restCoords = order.restaurantLocation || order.restaurantId?.location || null;
    const lat = parseFloat(restCoords?.lat ?? restCoords?.latitude);
    const lng = parseFloat(restCoords?.lng ?? restCoords?.longitude);
    let mapsUrl;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    } else if (restaurantAddress) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurantAddress)}&travelmode=driving`;
    } else {
      toast.error('Restaurant location not available');
      return;
    }
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCallCustomer = () => {
    const num = String(customerPhone || '').replace(/\D/g, '');
    if (!num) {
      toast.error('Customer phone number not available');
      return;
    }
    window.location.href = `tel:${num}`;
  };

  const handleNavigateToCustomer = () => {
    const lat = parseFloat(customerLocation?.lat ?? customerLocation?.latitude);
    const lng = parseFloat(customerLocation?.lng ?? customerLocation?.longitude);
    let mapsUrl;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    } else if (customerAddress) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customerAddress)}&travelmode=driving`;
    } else {
      toast.error('Customer location not available');
      return;
    }
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex items-end justify-center p-0 select-none"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-md sm:max-w-lg bg-white rounded-t-[28px] sm:rounded-t-[32px] overflow-hidden shadow-2xl flex flex-col pt-1.5 border border-slate-100"
      >
        {/* Handle / Minimize */}
        <div className="w-full flex justify-center pb-2 pt-1">
          <button 
            type="button"
            onClick={onMinimize} 
            className="p-1 hover:bg-slate-100 active:scale-95 transition-all rounded-full cursor-pointer"
            aria-label="Minimize offer"
          >
             <span className="w-12 h-1 bg-slate-300 rounded-full block" />
          </button>
        </div>

        {/* ─── MODERN HEADER BAR (LIGHT APPLE-STYLE) ─── */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-orange-600 bg-orange-100/70 px-2 py-0.5 rounded-full inline-block mb-1 border border-orange-200/50">
              Incoming Request {order.orderId ? `#${order.orderId}` : ''}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-emerald-600">₹</span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {Number(earnings || 0).toFixed(2)}
              </h2>
              <span className="text-[10px] text-slate-500 font-bold ml-1 uppercase">Rider Payout</span>
            </div>
          </div>

          {onToggleMute && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute();
              }}
              className={`rounded-xl p-2.5 transition-all border cursor-pointer active:scale-95 ${
                isMuted
                  ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:bg-slate-100'
              }`}
              aria-label={isMuted ? 'Unmute order alerts' : 'Mute order alerts'}
            >
              {isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
            </button>
          )}
        </div>

        {/* ─── JOURNEY BODY ─── */}
        <div className="p-4 sm:p-6 pb-6 sm:pb-8 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Timeline Route: Pickup ➔ Drop */}
          <div className="flex gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70">
            {/* Visual Stepper */}
            <div className="flex flex-col items-center py-1 shrink-0">
              <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-500/30" />
              <div className="w-0.5 flex-1 bg-gradient-to-b from-emerald-400 to-blue-500 my-1 rounded-full" />
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-500/30" />
            </div>

            <div className="flex-1 space-y-4 min-w-0">
              {/* Pickup Info */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 block mb-0.5">
                    Restaurant Pickup
                  </span>
                  <p className="text-slate-900 font-extrabold text-sm sm:text-base leading-snug truncate">
                    {restaurantName}
                  </p>
                  <p className="text-slate-500 text-xs font-medium line-clamp-2 mt-0.5 leading-relaxed">
                    {restaurantAddress}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCallRestaurant}
                    className="w-8.5 h-8.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200 active:scale-95 transition-all shadow-xs cursor-pointer"
                    aria-label="Call restaurant"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavigateToRestaurant}
                    className="w-8.5 h-8.5 rounded-xl bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-white active:scale-95 transition-all shadow-xs cursor-pointer"
                    aria-label="Navigate to restaurant"
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drop Info */}
              <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-200/60">
                <div className="min-w-0 flex-1">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-blue-700 block mb-0.5">
                    Customer Drop
                  </span>
                  <p className="text-slate-900 font-extrabold text-sm sm:text-base leading-snug truncate">
                    {customerName}
                  </p>
                  {customerPhone && (
                    <p className="text-slate-400 text-[11px] font-medium">{customerPhone}</p>
                  )}
                  <p className="text-slate-500 text-xs font-medium line-clamp-2 mt-0.5 leading-relaxed">
                    {customerAddress}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCallCustomer}
                    className="w-8.5 h-8.5 rounded-xl bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200 active:scale-95 transition-all shadow-xs cursor-pointer"
                    aria-label="Call customer"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavigateToCustomer}
                    className="w-8.5 h-8.5 rounded-xl bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-white active:scale-95 transition-all shadow-xs cursor-pointer"
                    aria-label="Navigate to customer"
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items Summary */}
          {Array.isArray(order?.items) && order.items.length > 0 && (
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
              <span className="text-[9.5px] text-slate-400 font-black uppercase tracking-wider block mb-1">
                Order Items ({order.items.length})
              </span>
              <p className="text-xs font-bold text-slate-800 line-clamp-2">
                {order.items.map((it) => `${it.quantity || 1}x ${it.name || it.itemName || 'Item'}`).join(', ')}
              </p>
            </div>
          )}

          {/* Metrics Pills: Time & Distance */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex items-center gap-2.5">
              <Clock className="w-4.5 h-4.5 text-orange-500 shrink-0" />
              <PickupMetricsValue metrics={metrics} label="Time" unit="min" />
            </div>
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex items-center gap-2.5">
              <MapPin className="w-4.5 h-4.5 text-slate-400 shrink-0" />
              <PickupMetricsValue metrics={metrics} label="Distance" unit="km" />
            </div>
          </div>

          {/* Action Area: Slider to Accept & Pass Task */}
          <div className="space-y-3 pt-2">
            <ActionSlider 
              label="Slide to Accept Order" 
              onConfirm={() => onAccept(order)} 
              color="bg-emerald-600"
              successLabel="Order Accepted ✓"
            />

            <button 
              type="button"
              onClick={() => onReject(order)}
              className="w-full text-slate-400 font-black text-[10px] uppercase tracking-wider hover:text-rose-600 transition-colors py-2 active:scale-95 cursor-pointer text-center"
            >
              Pass this task
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default NewOrderModal;
