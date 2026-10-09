import React from 'react';
import { ChevronRight, Package, MapPin, Store, Navigation } from 'lucide-react';
import {
  resolveOrderKey,
  mapDeliveryPhaseToTripStatus,
  useDeliveryStore,
} from '@/modules/DeliveryV2/store/useDeliveryStore';

const phaseLabel = (order, session) => {
  const tripStatus = session?.tripStatus || mapDeliveryPhaseToTripStatus(order);
  switch (tripStatus) {
    case 'REACHED_PICKUP':
      return { text: 'At Restaurant (Pickup)', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'PICKED_UP':
      return { text: 'Delivering to Customer', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    case 'REACHED_DROP':
      return { text: 'At Customer (Drop)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'COMPLETED':
      return { text: 'Delivered', color: 'text-gray-700 bg-gray-50 border-gray-200' };
    default:
      return { text: 'Heading to Pickup', color: 'text-orange-700 bg-orange-50 border-orange-200' };
  }
};

export default function AcceptedOrderCard({ order, focused = false, onSelect }) {
  const orderId = resolveOrderKey(order);
  const session = useDeliveryStore((state) =>
    orderId ? state.orderSessions[orderId] : null,
  );
  const displayId = order?.orderId || order?.displayOrderId || orderId;
  const restaurantName =
    order?.restaurantName ||
    order?.restaurantId?.restaurantName ||
    order?.restaurantId?.name ||
    'Restaurant';
  const customerAddress =
    order?.customerAddress ||
    order?.customer_address ||
    order?.deliveryAddress?.street ||
    order?.deliveryAddress?.area ||
    order?.deliveryAddress?.city ||
    'Drop address provided';
  const earnings =
    order?.riderEarning ||
    order?.earnings ||
    order?.pricing?.deliveryFee ||
    0;
  const isDirectAssignment =
    order?.dispatch?.status === 'assigned' ||
    order?.isDirectAssignment === true;

  const phase = phaseLabel(order, session);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(order)}
      className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.98] ${
        focused
          ? 'border-[#15498b]/50 bg-[#e7effa] shadow-md shadow-[#15498b]/15 ring-1 ring-[#15498b]/30'
          : 'border-gray-200/80 bg-white hover:border-gray-300 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 !bg-[#15498b] !text-white shadow-sm mt-0.5">
            <Package className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Order #{displayId}
              </span>
              {isDirectAssignment && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300/60 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Admin Assigned
                </span>
              )}
              {focused && (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300/60 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Active On Map
                </span>
              )}
            </div>

            <p className="text-sm font-bold text-gray-950 truncate mt-0.5">{restaurantName}</p>

            <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{customerAddress}</span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-black/5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${phase.color}`}>
                {phase.text}
              </span>
              {Number(earnings) > 0 && (
                <span className="text-xs font-extrabold text-emerald-700">
                  ₹{Number(earnings).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
          <ChevronRight
            className={`w-5 h-5 ${focused ? '!text-[#15498b]' : 'text-gray-300'}`}
          />
          <span className="text-[10px] font-bold text-[#15498b] flex items-center gap-1 opacity-80 hover:opacity-100">
            <Navigation className="w-3 h-3" /> View
          </span>
        </div>
      </div>
    </button>
  );
}
