import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { useDeliveryStore, resolveOrderKey, dedupeOrdersByIdentity } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { useOrderManager } from '@/modules/DeliveryV2/hooks/useOrderManager';
import { mapOrderLocations } from '@/modules/DeliveryV2/utils/orderMapping';
import { useDeliveryNotificationsContext } from '@/modules/DeliveryV2/components/DeliveryRealtimeShell';
import NewOrderCard from '@/modules/DeliveryV2/components/orders/NewOrderCard';
import AcceptedOrderCard from '@/modules/DeliveryV2/components/orders/AcceptedOrderCard';
import DeliveryBottomNav from '@/modules/DeliveryV2/components/DeliveryBottomNav';

export default function OrdersV2() {
  const navigate = useNavigate();
  const newOrders = useDeliveryStore((state) => state.newOrders);
  const visibleNewOrders = useMemo(() => dedupeOrdersByIdentity(newOrders), [newOrders]);
  const acceptedOrders = useDeliveryStore((state) => state.acceptedOrders);
  const focusedOrderId = useDeliveryStore((state) => state.focusedOrderId);
  const capacity = useDeliveryStore((state) => state.capacity);
  const addNewOrder = useDeliveryStore((state) => state.addNewOrder);
  const setAcceptedOrders = useDeliveryStore((state) => state.setAcceptedOrders);
  const setCapacity = useDeliveryStore((state) => state.setCapacity);
  const setFocusedOrder = useDeliveryStore((state) => state.setFocusedOrder);

  const { acceptOrder } = useOrderManager();
  const {
    isOrderAlertMuted,
    toggleOrderAlertMuted,
    clearNewOrder,
    stopSound,
    triggerOrderAlertFor10Sec,
    isConnected: isSocketConnected,
  } = useDeliveryNotificationsContext();

  const [activeTab, setActiveTab] = useState('new');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevNewCountRef = useRef(visibleNewOrders.length);
  const hasAutoSwitchedTabRef = useRef(false);

  const hydrateOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [currentRes, availableRes] = await Promise.all([
        deliveryAPI.getCurrentDelivery(),
        deliveryAPI.getOrders({ limit: 20, page: 1 }),
      ]);

      const currentPayload = currentRes?.data?.data || {};
      const activeOrders = Array.isArray(currentPayload.activeOrders)
        ? currentPayload.activeOrders
        : currentPayload.activeOrder
          ? [currentPayload.activeOrder]
          : [];

      if (currentPayload.capacity) {
        setCapacity(currentPayload.capacity);
      }

      if (activeOrders.length) {
        setAcceptedOrders(activeOrders.map(mapOrderLocations).filter(Boolean));
      } else {
        const currentAccepted = useDeliveryStore.getState().acceptedOrders;
        if (currentAccepted && currentAccepted.length > 0) {
          setAcceptedOrders([]);
        }
      }

      const availablePayload = availableRes?.data?.data || availableRes?.data || {};
      if (availablePayload.capacity) {
        setCapacity(availablePayload.capacity);
      }

      const offers = Array.isArray(availablePayload.newOffers)
        ? availablePayload.newOffers
        : [];

      offers.forEach((order) => addNewOrder(order));

      // Auto-select accepted tab on first load if partner has active assignments and no pending offers
      if (!hasAutoSwitchedTabRef.current) {
        hasAutoSwitchedTabRef.current = true;
        if (activeOrders.length > 0 && offers.length === 0) {
          setActiveTab('accepted');
        }
      }
    } catch (err) {
      console.warn('[OrdersV2] hydrate failed:', err?.message || err);
      setError('Unable to sync orders. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [addNewOrder, setAcceptedOrders, setCapacity]);

  useEffect(() => {
    void hydrateOrders();
  }, [hydrateOrders]);

  // When opening Orders tab, if unaccepted new orders exist and partner is free, ring for 10s
  useEffect(() => {
    if (visibleNewOrders.length > 0 && acceptedOrders.length === 0) {
      const firstOrder = visibleNewOrders[0];
      if (!isOrderAlertMuted(firstOrder)) {
        triggerOrderAlertFor10Sec?.(firstOrder);
      }
    }
  }, []);

  // When a live offer arrives: auto-switch to New Orders only if partner is free
  useEffect(() => {
    if (visibleNewOrders.length > prevNewCountRef.current) {
      if (acceptedOrders.length === 0) {
        setActiveTab('new');
        const latestOrder = visibleNewOrders[visibleNewOrders.length - 1];
        if (latestOrder && !isOrderAlertMuted(latestOrder)) {
          triggerOrderAlertFor10Sec?.(latestOrder);
        }
      }
    }
    prevNewCountRef.current = visibleNewOrders.length;
  }, [visibleNewOrders, acceptedOrders.length, isOrderAlertMuted, triggerOrderAlertFor10Sec]);

  // Drop expanded card if the order was claimed/removed
  useEffect(() => {
    if (!expandedOrderId) return;
    const stillExists = visibleNewOrders.some((order) => resolveOrderKey(order) === expandedOrderId);
    if (!stillExists) {
      setExpandedOrderId(null);
    }
  }, [visibleNewOrders, expandedOrderId]);

  const handleAccept = async (order) => {
    const orderId = resolveOrderKey(order);
    const isFirstAcceptedOrder = acceptedOrders.length === 0;

    // Stop alert instantly on tap — don't wait for API
    stopSound?.();

    try {
      await acceptOrder(order);
      clearNewOrder(order);
      setExpandedOrderId(null);

      if (isFirstAcceptedOrder) {
        setFocusedOrder(orderId);
        toast.success('Order accepted');
        navigate('/food/delivery/feed');
        return;
      }

      toast.success('Order accepted — added to your queue');
      setActiveTab('accepted');
    } catch {
      // useOrderManager already toasts
    }
  };

  const handleReject = async (order) => {
    const orderId = resolveOrderKey(order);
    if (!orderId) return;
    stopSound?.();
    try {
      await deliveryAPI.rejectOrder(orderId);
    } catch (error) {
      console.warn('[OrdersV2] reject failed:', error?.message || error);
    } finally {
      clearNewOrder(order);
      if (expandedOrderId === orderId) {
        setExpandedOrderId(null);
      }
    }
  };

  const handleSelectAccepted = (order) => {
    const orderId = resolveOrderKey(order);
    if (!orderId) return;
    setFocusedOrder(orderId);
    navigate('/food/delivery/feed');
  };

  const toggleExpanded = (orderId) => {
    setExpandedOrderId((current) => (current === orderId ? null : orderId));
  };

  const acceptDisabled = capacity.remaining <= 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-[#121212] text-white px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black uppercase tracking-tight">Orders</h1>
          <button
            type="button"
            onClick={hydrateOrders}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg active:scale-95 transition-all"
            aria-label="Refresh orders"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1 font-semibold">
          {capacity.active}/{capacity.max} active slots used
        </p>

        {!isSocketConnected && (
          <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-400/30 px-3 py-1.5 text-amber-300 text-[11px] font-semibold">
            <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span>Reconnecting to live dispatch... Updates will refresh automatically.</span>
          </div>
        )}

        <div className="mt-4 flex rounded-2xl bg-white/10 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`flex-1 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'new' ? 'bg-white text-gray-950 shadow' : 'text-white/70'
            }`}
          >
            New Orders
            {visibleNewOrders.length > 0 ? (
              <span
                className={`ml-1.5 inline-flex min-w-[20px] h-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none ${
                  activeTab === 'new'
                    ? '!bg-[#15498b] !text-white'
                    : '!bg-orange-500 !text-white shadow-sm ring-1 ring-white/25'
                }`}
              >
                {visibleNewOrders.length > 9 ? '9+' : visibleNewOrders.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accepted')}
            className={`flex-1 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'accepted' ? 'bg-white text-gray-950 shadow' : 'text-white/70'
            }`}
          >
            Active & Assigned
            {acceptedOrders.length > 0 ? (
              <span
                className={`ml-1.5 inline-flex min-w-[20px] h-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none ${
                  activeTab === 'accepted'
                    ? '!bg-[#15498b] !text-white'
                    : '!bg-orange-500 !text-white shadow-sm ring-1 ring-white/25'
                }`}
              >
                {acceptedOrders.length > 9 ? '9+' : acceptedOrders.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 mb-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={hydrateOrders}
              className="text-xs font-black uppercase tracking-wider text-red-800 underline hover:no-underline"
            >
              Tap to Retry
            </button>
          </div>
        ) : null}

        {isLoading && visibleNewOrders.length === 0 && acceptedOrders.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            <p className="text-xs font-semibold">Loading orders...</p>
          </div>
        ) : activeTab === 'new' ? (
          visibleNewOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No new order requests right now.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleNewOrders.map((order) => {
                const orderId = resolveOrderKey(order);
                return (
                  <NewOrderCard
                    key={orderId}
                    order={order}
                    expanded={expandedOrderId === orderId}
                    onToggle={() => toggleExpanded(orderId)}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    acceptDisabled={acceptDisabled}
                    isMuted={isOrderAlertMuted(order)}
                    onToggleMute={() => toggleOrderAlertMuted(order)}
                    disabledMessage={`All ${capacity.max} slots in use — complete an active order to accept more`}
                  />
                );
              })}
            </div>
          )
        ) : acceptedOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            No active or assigned orders right now.
          </div>
        ) : (
          <div className="space-y-3">
            {acceptedOrders.map((order) => (
              <AcceptedOrderCard
                key={resolveOrderKey(order)}
                order={order}
                focused={resolveOrderKey(order) === focusedOrderId}
                onSelect={handleSelectAccepted}
              />
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0">
        <DeliveryBottomNav currentTab="orders" />
      </div>
    </div>
  );
}
