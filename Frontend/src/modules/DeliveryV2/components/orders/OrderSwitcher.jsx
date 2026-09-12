import React from 'react';
import { resolveOrderKey } from '@/modules/DeliveryV2/store/useDeliveryStore';

export default function OrderSwitcher({ orders = [], focusedOrderId, onSelect }) {
  if (!Array.isArray(orders) || orders.length <= 1) return null;

  return (
    <div className="px-3 md:px-4 mt-2">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {orders.map((order) => {
          const orderId = resolveOrderKey(order);
          const label = order?.orderId || order?.displayOrderId || orderId;
          const isFocused = focusedOrderId === orderId;
          return (
            <button
              key={orderId}
              type="button"
              onClick={() => onSelect?.(orderId)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                isFocused
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-white/30'
                  : 'bg-white/10 text-white/70 border border-white/15 hover:bg-white/20'
              }`}
              aria-current={isFocused ? 'true' : undefined}
            >
              #{label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
