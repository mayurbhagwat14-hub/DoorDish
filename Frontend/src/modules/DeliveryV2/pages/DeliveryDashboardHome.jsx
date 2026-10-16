import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  CheckCircle2,
  Package,
  IndianRupee,
  Wallet,
  TrendingUp,
  MapPin,
  Navigation2,
  Clock,
  ChevronRight,
  RefreshCw,
  Bell,
  Contact,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Store,
  CreditCard,
  PhoneCall,
  Sparkles,
  Layers,
  History,
  Check,
  HelpCircle,
  ExternalLink,
  User,
  Info
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { useDeliveryStore, dedupeOrdersByIdentity } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { useDeliveryNotificationsContext } from '@/modules/DeliveryV2/components/DeliveryRealtimeShell';
import useNotificationInbox from '@food/hooks/useNotificationInbox';
import { formatCurrency } from '@food/utils/currency';
import { toast } from 'sonner';

export default function DeliveryDashboardHome({ onNavigateTab }) {
  const navigate = useNavigate();

  // Zustand Store
  const {
    isOnline,
    toggleOnline,
    acceptedOrders,
    newOrders,
    capacity,
    getFocusedOrder,
  } = useDeliveryStore();

  const activeOrder = getFocusedOrder ? getFocusedOrder() : (acceptedOrders?.[0] || null);
  const activeOrdersCount = acceptedOrders?.length || 0;
  const visibleNewOrders = useMemo(() => dedupeOrdersByIdentity(newOrders || []), [newOrders]);
  const newOrdersCount = visibleNewOrders.length;

  // Realtime notification context
  const notificationsContext = useDeliveryNotificationsContext?.() || {};
  const isSocketConnected = notificationsContext.isConnected ?? true;

  const {
    items: broadcastItems = [],
    unreadCount: notificationUnreadCount = 0,
  } = useNotificationInbox('delivery', { limit: 10 });

  // Component Local State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  
  // Period filter: 'all' (Total Lifetime) or 'today'
  const [metricPeriod, setMetricPeriod] = useState('all');
  const [tripsTab, setTripsTab] = useState('all'); // 'all' or 'today'

  const [todaySummary, setTodaySummary] = useState({
    totalOrders: 0,
    totalEarnings: 0,
    orderEarning: 0,
    incentive: 0,
  });

  const [allTimeSummary, setAllTimeSummary] = useState({
    totalOrders: 0,
    totalEarnings: 0,
    orderEarning: 0,
    incentive: 0,
  });

  const [allTrips, setAllTrips] = useState([]);
  const [todayTrips, setTodayTrips] = useState([]);

  const [wallet, setWallet] = useState({
    totalBalance: 0,
    pocketBalance: 0,
    cashInHand: 0,
    totalCashLimit: 10000,
    availableCashLimit: 10000,
  });

  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyNumbers, setEmergencyNumbers] = useState({
    medicalEmergency: '',
    accidentHelpline: '',
    contactPolice: '',
    insurance: '',
  });

  // Format Helper for today's date
  const formatTodayDate = () => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Format Time & Date Helper
  const formatTripDateTime = (trip) => {
    const raw = trip?.date || trip?.deliveredAt || trip?.completedAt || trip?.createdAt;
    if (!raw) return trip?.time || 'Completed';

    try {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return trip?.time || String(raw);

      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const timeStr = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      if (isToday) return `Today, ${timeStr}`;

      const dateStr = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
      return `${dateStr}, ${timeStr}`;
    } catch {
      return trip?.time || 'Completed';
    }
  };

  // Fetch all dashboard data for THIS PARTICULAR LOGGED-IN PARTNER
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const [
        todayEarningsRes,
        allEarningsRes,
        allTripsRes,
        todayTripsRes,
        walletRes,
        profileRes,
        emergencyRes,
      ] = await Promise.allSettled([
        deliveryAPI.getEarnings({ period: 'today' }),
        deliveryAPI.getEarnings({ period: 'all' }),
        deliveryAPI.getTripHistory({ period: 'all', limit: 100 }),
        deliveryAPI.getTripHistory({ period: 'daily', date: todayStr, limit: 100 }),
        deliveryAPI.getWallet(),
        deliveryAPI.getProfile(),
        deliveryAPI.getEmergencyHelp(),
      ]);

      // 1. Profile of Logged-in Partner
      let partnerId = null;
      if (profileRes.status === 'fulfilled' && profileRes.value?.data?.success) {
        const p = profileRes.value.data.data?.profile || {};
        setProfile(p);
        partnerId = p._id || p.id;
      }

      // 2. All-Time Orders & Earnings
      let lifetimeOrdersCount = 0;
      let lifetimeEarnings = 0;
      if (allEarningsRes.status === 'fulfilled' && allEarningsRes.value?.data?.success) {
        const summary = allEarningsRes.value.data.data?.summary || {};
        lifetimeOrdersCount = Number(summary.totalOrders || 0);
        lifetimeEarnings = Number(summary.totalEarnings || 0);
        setAllTimeSummary({
          totalOrders: lifetimeOrdersCount,
          totalEarnings: lifetimeEarnings,
          orderEarning: Number(summary.orderEarning || 0),
          incentive: Number(summary.incentive || summary.otherEarnings || 0),
        });
      }

      // 3. All Completed Trips
      if (allTripsRes.status === 'fulfilled' && allTripsRes.value?.data?.success) {
        const rawTrips = allTripsRes.value.data.data?.trips || [];
        const completed = rawTrips.filter(
          (t) => String(t.status || '').toLowerCase() === 'completed'
        );
        setAllTrips(completed);

        // Fallback: If earnings API had 0 but trips exist, sync with completed trips
        if (completed.length > lifetimeOrdersCount) {
          lifetimeOrdersCount = completed.length;
          setAllTimeSummary((prev) => ({
            ...prev,
            totalOrders: completed.length,
          }));
        }
      }

      // 4. Today's Completed Trips & Earnings
      let todayOrdersCount = 0;
      if (todayTripsRes.status === 'fulfilled' && todayTripsRes.value?.data?.success) {
        const rawTodayTrips = todayTripsRes.value.data.data?.trips || [];
        const completedToday = rawTodayTrips.filter(
          (t) => String(t.status || '').toLowerCase() === 'completed'
        );
        setTodayTrips(completedToday);
        todayOrdersCount = completedToday.length;
      }

      if (todayEarningsRes.status === 'fulfilled' && todayEarningsRes.value?.data?.success) {
        const summary = todayEarningsRes.value.data.data?.summary || {};
        const count = Math.max(Number(summary.totalOrders || 0), todayOrdersCount);
        setTodaySummary({
          totalOrders: count,
          totalEarnings: Number(summary.totalEarnings || 0),
          orderEarning: Number(summary.orderEarning || 0),
          incentive: Number(summary.incentive || summary.otherEarnings || 0),
        });
      } else {
        setTodaySummary((prev) => ({
          ...prev,
          totalOrders: todayOrdersCount,
        }));
      }

      // 5. Wallet (Pocket Balance, Cash in Hand, Limits)
      if (walletRes.status === 'fulfilled' && walletRes.value?.data?.success) {
        const w = walletRes.value.data.data?.wallet || {};
        setWallet({
          totalBalance: Number(w.totalBalance || w.pocketBalance || 0),
          pocketBalance: Number(w.pocketBalance || w.totalBalance || 0),
          cashInHand: Number(w.cashInHand || 0),
          totalCashLimit: Number(w.totalCashLimit || 10000),
          availableCashLimit: Number(w.availableCashLimit || 10000),
        });

        // Also if wallet has totalEarned and it exceeds allTimeSummary, update it
        if (Number(w.totalEarned) > 0 && lifetimeEarnings === 0) {
          setAllTimeSummary((prev) => ({
            ...prev,
            totalEarnings: Number(w.totalEarned),
          }));
        }
      }

      // 6. Emergency Contacts
      if (emergencyRes.status === 'fulfilled' && emergencyRes.value?.data?.success) {
        setEmergencyNumbers(emergencyRes.value.data.data?.emergency || {});
      }
    } catch (err) {
      console.warn('[DeliveryDashboardHome] failed to sync stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Listen to delivery notifications and order events to auto-refresh
  useEffect(() => {
    const handleUpdate = () => {
      loadDashboardData(true);
    };

    window.addEventListener('deliveryNotificationsUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      window.removeEventListener('deliveryNotificationsUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [loadDashboardData]);

  // Handle Online/Offline toggle
  const handleToggleOnline = async () => {
    const nextState = !isOnline;
    toggleOnline();
    try {
      if (nextState) {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              deliveryAPI
                .updateLocation(pos.coords.latitude, pos.coords.longitude, true)
                .catch(() => {});
            },
            () => {},
            { enableHighAccuracy: true }
          );
        }
        await deliveryAPI.updateOnlineStatus(true);
        toast.success('You are now Online! Ready to receive deliveries.');
      } else {
        await deliveryAPI.updateOnlineStatus(false);
        toast.info('You are now Offline. Deliveries paused.');
      }
    } catch (err) {
      console.warn('Online status update warning:', err);
    }
  };

  const handleTabJump = (tabKey) => {
    if (onNavigateTab) {
      onNavigateTab(tabKey);
    } else {
      if (tabKey === 'orders') navigate('/food/delivery/orders');
      else if (tabKey === 'feed') navigate('/food/delivery/feed');
      else if (tabKey === 'pocket') navigate('/food/delivery/pocket');
      else if (tabKey === 'history') navigate('/food/delivery/history');
      else if (tabKey === 'profile') navigate('/food/delivery/profile');
    }
  };

  const cashLimitPercent = useMemo(() => {
    if (!wallet.totalCashLimit || wallet.totalCashLimit <= 0) return 0;
    const pct = (wallet.cashInHand / wallet.totalCashLimit) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }, [wallet.cashInHand, wallet.totalCashLimit]);

  // Displayed trips based on active tab
  const displayedTrips = tripsTab === 'today' ? todayTrips : allTrips;

  // Values depending on metricPeriod ('all' or 'today')
  const displayOrdersCount = metricPeriod === 'all' ? allTimeSummary.totalOrders : todaySummary.totalOrders;
  const displayEarningsAmount = metricPeriod === 'all' ? allTimeSummary.totalEarnings : todaySummary.totalEarnings;
  const displayBaseEarning = metricPeriod === 'all' ? allTimeSummary.orderEarning : todaySummary.orderEarning;
  const displayIncentive = metricPeriod === 'all' ? allTimeSummary.incentive : todaySummary.incentive;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-36 text-slate-800">
      {/* ─── TOP PREMIUM HEADER (WITH PARTNER ID & DETAILS) ─── */}
      <header className="bg-gradient-to-b from-[#111827] via-[#1F2937] to-[#111827] text-white pt-4 pb-6 px-4 md:px-6 shadow-xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto">
          {/* Top Row: Profile info & Action buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                onClick={() => handleTabJump('profile')}
                className="w-12 h-12 rounded-full border-2 border-white/20 p-0.5 shadow-md overflow-hidden bg-white/10 cursor-pointer active:scale-95 transition-all relative shrink-0"
              >
                <img
                  src={profile?.profileImage?.url || profile?.documents?.photo || '/assets/images/profile_avatar.webp'}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-full"
                />
                <span
                  className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#111827] ${
                    isOnline ? 'bg-emerald-400' : 'bg-gray-400'
                  }`}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-base font-black text-white truncate tracking-tight">
                    {profile?.name || 'Delivery Partner'}
                  </h1>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck className="w-2.5 h-2.5 mr-0.5 inline" /> Active Partner
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-300 font-medium">
                  <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-orange-300 font-bold">
                    ID: {profile?._id ? profile._id.slice(-6).toUpperCase() : 'PARTNER'}
                  </span>
                  <span>•</span>
                  <span>{profile?.phone || 'DoorDish Rider'}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Icons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => loadDashboardData()}
                disabled={refreshing}
                title="Refresh stats"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-400' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setEmergencyModalOpen(true)}
                title="Emergency SOS"
                className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-400 border border-red-500/30 active:scale-90 transition-all shadow-sm"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/food/delivery/help/id-card')}
                title="Partner ID Card"
                className="w-9 h-9 rounded-full bg-blue-500/20 hover:bg-blue-500/30 flex items-center justify-center text-blue-300 border border-blue-500/30 active:scale-90 transition-all shadow-sm"
              >
                <Contact className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/food/delivery/notifications')}
                title="Notifications"
                className="relative w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all shadow-sm"
              >
                <Bell className="w-4 h-4" />
                {notificationUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-orange-600 flex items-center justify-center text-[9px] font-black text-white border-2 border-[#111827]">
                    {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Online / Offline Switch Row */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline
                    ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-xs font-bold text-gray-200">
                {isOnline ? 'Online • Accepting delivery orders' : 'Offline • Shifts paused'}
              </span>
              {!isSocketConnected && isOnline && (
                <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/20 px-2 py-0.5 rounded-full">
                  Connecting...
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleOnline}
              className={`relative inline-flex h-8 w-24 items-center rounded-full p-1 transition-colors duration-300 ${
                isOnline ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'bg-gray-700'
              }`}
            >
              <span
                className={`text-[10px] font-black tracking-wider uppercase px-2 w-full flex justify-between text-white`}
              >
                <span>{isOnline ? 'ON' : ''}</span>
                <span>{!isOnline ? 'OFF' : ''}</span>
              </span>
              <motion.span
                layout
                animate={{ x: isOnline ? 62 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute left-1 inline-block h-6 w-6 transform rounded-full bg-white shadow-md"
              />
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT BODY ─── */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* ─── LIVE ACTION ALERTS ─── */}
        {/* 1. Active Order Alert */}
        {activeOrder && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-between gap-3 border border-emerald-400/30"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Navigation2 className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    Active Delivery
                  </span>
                  <span className="text-xs font-bold text-emerald-100 truncate">
                    #{activeOrder?.orderId || 'Active'}
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate mt-0.5">
                  {activeOrder?.restaurantName || 'Restaurant'} → Drop Location
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTabJump('feed')}
              className="shrink-0 bg-white text-emerald-900 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1"
            >
              <span>Live Map</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* 2. New Order Offer Waiting Alert */}
        {newOrdersCount > 0 && !activeOrder && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 p-4 text-white shadow-lg shadow-orange-500/20 flex items-center justify-between gap-3 border border-orange-400/30"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 animate-bounce">
                <Flame className="w-5 h-5 text-yellow-300" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-gray-950 px-2 py-0.5 rounded-full">
                  {newOrdersCount} New Offer{newOrdersCount > 1 ? 's' : ''} Waiting!
                </span>
                <p className="text-xs font-bold text-white truncate mt-1">
                  Tap to view & accept new orders now
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTabJump('orders')}
              className="shrink-0 bg-white text-orange-700 font-extrabold text-xs px-4 py-2 rounded-xl shadow-md active:scale-95 transition-all"
            >
              View Offers
            </button>
          </motion.div>
        )}

        {/* ─── HERO PERFORMANCE OVERVIEW CARD (EXACT PARTNER CALCULATION) ─── */}
        <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                Partner Performance
              </span>
              <h2 className="text-sm font-black text-slate-900 mt-0.5">
                {metricPeriod === 'all' ? 'All-Time Performance' : `Today (${formatTodayDate()})`}
              </h2>
            </div>

            {/* Period Filter Pill Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setMetricPeriod('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                  metricPeriod === 'all'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All-Time
              </button>
              <button
                type="button"
                onClick={() => setMetricPeriod('today')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                  metricPeriod === 'today'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Today
              </button>
            </div>
          </div>

          {/* Primary Big Highlights Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            {/* 1. Orders Delivered Highlight */}
            <div className="bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-teal-50/30 rounded-2xl p-4 border border-emerald-100 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  {metricPeriod === 'all' ? 'Total Delivered' : 'Delivered Today'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-emerald-950 tracking-tight">
                  {displayOrdersCount}
                </span>
                <span className="text-xs font-bold text-emerald-700">Orders</span>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-emerald-700 border-t border-emerald-100/60 pt-1.5">
                <span>{metricPeriod === 'all' ? "Today's Deliveries:" : 'All-time completed:'}</span>
                <span className="font-black text-emerald-900">
                  {metricPeriod === 'all' ? `${todaySummary.totalOrders} today` : `${allTimeSummary.totalOrders} total`}
                </span>
              </div>
            </div>

            {/* 2. Earnings Highlight */}
            <div className="bg-gradient-to-br from-orange-50 via-orange-50/50 to-amber-50/30 rounded-2xl p-4 border border-orange-100 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-orange-800 uppercase tracking-wider">
                  {metricPeriod === 'all' ? 'Total Earnings' : "Today's Earning"}
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm">
                  <IndianRupee className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>

              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-extrabold text-orange-700">₹</span>
                <span className="text-3xl font-black text-orange-950 tracking-tight">
                  {Number(displayEarningsAmount || 0).toFixed(2)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-orange-700 border-t border-orange-100/60 pt-1.5">
                <span>Base: ₹{Number(displayBaseEarning || 0).toFixed(0)}</span>
                {displayIncentive > 0 && (
                  <span className="text-emerald-700 font-bold">
                    +₹{Number(displayIncentive).toFixed(0)} bonus
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Stats Row: Pocket Balance & Cash In Hand */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Pocket Balance */}
            <div 
              onClick={() => handleTabJump('pocket')}
              className="bg-slate-50 hover:bg-slate-100/80 rounded-2xl p-3.5 border border-slate-100 cursor-pointer active:scale-98 transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Pocket Balance
                </span>
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-bold text-slate-600">₹</span>
                <span className="text-xl font-black text-slate-900">
                  {Number(wallet.pocketBalance || 0).toFixed(0)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-semibold text-emerald-600">
                <span>Available for payout</span>
                <ChevronRight className="w-3 h-3 inline" />
              </p>
            </div>

            {/* Cash in Hand & Limit */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Cash in Hand
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  Limit: ₹{Number(wallet.totalCashLimit || 10000).toFixed(0)}
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-bold text-slate-600">₹</span>
                <span className="text-xl font-black text-slate-900">
                  {Number(wallet.cashInHand || 0).toFixed(0)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cashLimitPercent > 80
                      ? 'bg-red-500'
                      : cashLimitPercent > 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${cashLimitPercent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── QUICK NAVIGATION SHORTCUTS ─── */}
        <section className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
            Quick Actions
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Live Map / Navigation */}
            <button
              type="button"
              onClick={() => handleTabJump('feed')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 text-left hover:border-orange-200 active:scale-98 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <Navigation2 className="w-5 h-5 rotate-45" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Live Map</h4>
                <p className="text-[10px] text-slate-500 truncate">GPS navigation & routes</p>
              </div>
            </button>

            {/* Orders Queue */}
            <button
              type="button"
              onClick={() => handleTabJump('orders')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 text-left hover:border-orange-200 active:scale-98 transition-all group relative"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Orders Queue</h4>
                <p className="text-[10px] text-slate-500 truncate">New offers & active</p>
              </div>
              {newOrdersCount > 0 && (
                <span className="absolute top-2 right-2 bg-orange-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                  {newOrdersCount}
                </span>
              )}
            </button>

            {/* Pocket / Balance */}
            <button
              type="button"
              onClick={() => handleTabJump('pocket')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 text-left hover:border-orange-200 active:scale-98 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Pocket</h4>
                <p className="text-[10px] text-slate-500 truncate">
                  ₹{Number(wallet.pocketBalance || 0).toFixed(0)} balance
                </p>
              </div>
            </button>

            {/* Trip History */}
            <button
              type="button"
              onClick={() => handleTabJump('history')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 text-left hover:border-orange-200 active:scale-98 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <History className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Trip History</h4>
                <p className="text-[10px] text-slate-500 truncate">{allTimeSummary.totalOrders} logs</p>
              </div>
            </button>
          </div>
        </section>

        {/* ─── DELIVERED ORDERS LIST (SHOWING ALL DELIVERIES OF THIS PARTNER) ─── */}
        <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-black text-slate-900">
                Delivered Deliveries
              </h3>
            </div>

            {/* List Filter Tabs: All Completed vs Today */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTripsTab('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                  tripsTab === 'all'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Delivered ({allTrips.length})
              </button>
              <button
                type="button"
                onClick={() => setTripsTab('today')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                  tripsTab === 'today'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Today ({todayTrips.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
              <span className="text-xs font-semibold">Loading partner orders...</span>
            </div>
          ) : displayedTrips.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-orange-100/70 text-orange-600 flex items-center justify-center mx-auto mb-1">
                <Package className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                {tripsTab === 'today'
                  ? 'No orders delivered yet today'
                  : 'No completed orders found for this partner'}
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {tripsTab === 'today' && allTrips.length > 0 ? (
                  <span>
                    You have delivered <strong>{allTrips.length} orders</strong> in total. Switch to "All Delivered" tab to view them.
                  </span>
                ) : (
                  'Turn Online above to start receiving orders and earning!'
                )}
              </p>
              {tripsTab === 'today' && allTrips.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTripsTab('all')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>View All {allTrips.length} Delivered Orders</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {displayedTrips.map((trip, idx) => {
                const orderIdStr = trip.orderId || trip._id || `Order #${idx + 1}`;
                const earning = Number(
                  trip.deliveryEarning ?? trip.earningAmount ?? trip.amount ?? 0
                );
                const restName =
                  trip.restaurantName || trip.restaurant || 'Restaurant Delivery';
                const dateTimeStr = formatTripDateTime(trip);

                return (
                  <div
                    key={trip._id || trip.id || idx}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 rounded-xl px-1 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {restName}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50 shrink-0">
                            Delivered
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-600">#{orderIdStr}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-slate-500">
                            <Clock className="w-2.5 h-2.5" />
                            {dateTimeStr}
                          </span>
                          {trip.paymentMethod && (
                            <>
                              <span>•</span>
                              <span className="capitalize text-slate-500">{trip.paymentMethod}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-emerald-600 block">
                        +₹{earning.toFixed(2)}
                      </span>
                      <span className="text-[9px] font-medium text-slate-400 uppercase">
                        Rider Earning
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── SAFETY & SUPPORT HELPER FOOTER ─── */}
        <div className="rounded-2xl bg-slate-100/80 p-4 border border-slate-200/60 flex items-center justify-between gap-3 text-slate-600 mb-6">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-slate-500 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-slate-800 block">Need Delivery Support?</span>
              <span className="text-[11px] text-slate-500">
                Raise tickets or contact admin helpline
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/food/delivery/help/tickets')}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 shrink-0 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs"
          >
            Get Help
          </button>
        </div>
      </main>

      {/* ─── EMERGENCY SOS MODAL ─── */}
      <AnimatePresence>
        {emergencyModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEmergencyModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl z-10 border border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="text-base font-extrabold">Emergency SOS Helpline</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <a
                  href={`tel:${emergencyNumbers.contactPolice || '112'}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs">
                      POLICE
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">Police Assistance</h4>
                      <p className="text-[11px] text-slate-500">
                        {emergencyNumbers.contactPolice || '112'}
                      </p>
                    </div>
                  </div>
                  <PhoneCall className="w-4 h-4 text-red-600" />
                </a>

                <a
                  href={`tel:${emergencyNumbers.medicalEmergency || '108'}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                      AMB
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">Medical / Ambulance</h4>
                      <p className="text-[11px] text-slate-500">
                        {emergencyNumbers.medicalEmergency || '108'}
                      </p>
                    </div>
                  </div>
                  <PhoneCall className="w-4 h-4 text-amber-600" />
                </a>

                {emergencyNumbers.accidentHelpline && (
                  <a
                    href={`tel:${emergencyNumbers.accidentHelpline}`}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        SOS
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900">Accident Helpline</h4>
                        <p className="text-[11px] text-slate-500">
                          {emergencyNumbers.accidentHelpline}
                        </p>
                      </div>
                    </div>
                    <PhoneCall className="w-4 h-4 text-blue-600" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
