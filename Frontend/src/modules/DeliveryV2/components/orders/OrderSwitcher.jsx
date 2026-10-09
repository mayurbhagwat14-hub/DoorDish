import React from 'react';
import { resolveOrderKey, mapDeliveryPhaseToTripStatus } from '@/modules/DeliveryV2/store/useDeliveryStore';

export default function OrderSwitcher({ orders = [], focusedOrderId, onSelect }) {
  if (!Array.isArray(orders) || orders.length <= 1) return null;

  return (
    <div className="px-3 md:px-4 mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-white/60">
          Active Orders ({orders.length})
        </span>
        <span className="text-[10px] text-white/40 font-medium">Tap to switch view</span>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {orders.map((order) => {
          const orderId = resolveOrderKey(order);
          const label = order?.orderId || order?.displayOrderId || orderId;
          const isFocused = focusedOrderId === orderId;
          const restName =
            order?.restaurantName ||
            order?.restaurantId?.restaurantName ||
            order?.restaurantId?.name ||
            'Order';
          const phase = mapDeliveryPhaseToTripStatus(order);
          const isDrop = phase === 'PICKED_UP' || phase === 'REACHED_DROP';

          return (
            <button
              key={orderId}
              type="button"
              onClick={() => onSelect?.(orderId)}
              className={`shrink-0 flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer active:scale-95 border ${
                isFocused
                  ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/30 ring-2 ring-white/30'
                  : 'bg-white/10 text-white/80 border-white/15 hover:bg-white/20'
              }`}
              aria-current={isFocused ? 'true' : undefined}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isDrop ? 'bg-emerald-400' : 'bg-amber-300'}`} />
              <span className="font-extrabold tracking-tight">#{label}</span>
              <span className="text-[10px] opacity-80 truncate max-w-[90px]">{restName}</span>
              <span
                className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-black tracking-wider ${
                  isFocused ? 'bg-black/25 text-white' : 'bg-white/10 text-white/70'
                }`}
              >
                {isDrop ? 'Drop' : 'Pickup'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
