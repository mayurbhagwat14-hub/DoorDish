import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  PhoneCall,
  Sparkles,
  History,
  Check,
  HelpCircle,
  Zap,
  Activity,
  Radio,
  ExternalLink,
  Layers
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { useDeliveryStore, dedupeOrdersByIdentity } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { useDeliveryNotificationsContext } from '@/modules/DeliveryV2/components/DeliveryRealtimeShell';
import useNotificationInbox from '@food/hooks/useNotificationInbox';
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
        toast.success('Duty Online — Ready for incoming orders');
      } else {
        await deliveryAPI.updateOnlineStatus(false);
        toast.info('Duty Paused — Offline mode active');
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
    <div className="min-h-screen bg-[#F6F8FB] text-slate-800 pb-28 sm:pb-32 select-none font-sans antialiased relative w-full overflow-x-hidden">
      {/* Subtle light ambient glow */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-orange-500/5 via-slate-100/30 to-transparent pointer-events-none -z-0" />

      {/* ─── 1. APPLE BESPOKE PARTNER COCKPIT & DUTY CONTROL (MOBILE-FIRST) ─── */}
      <header className="relative z-10 pt-3 sm:pt-4 px-3 sm:px-4 max-w-lg mx-auto w-full">
        <div className="rounded-2xl sm:rounded-[24px] bg-white text-slate-900 p-3.5 sm:p-4.5 shadow-[0_3px_20px_rgba(0,0,0,0.05)] border border-slate-200/80 backdrop-blur-xl">
          {/* Top Row: Partner Identity + Action Buttons */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div
                onClick={() => handleTabJump('profile')}
                className="relative cursor-pointer active:scale-95 transition-transform shrink-0"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-slate-200/80 bg-slate-100 shadow-xs">
                  <img
                    src={profile?.profileImage?.url || profile?.documents?.photo || '/assets/images/profile_avatar.webp'}
                    alt="Partner"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Status beacon dot */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    isOnline ? 'bg-emerald-500 ring-2 ring-emerald-400/40 animate-pulse' : 'bg-slate-400'
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-sm sm:text-base font-extrabold text-slate-900 truncate tracking-tight">
                    {profile?.name || 'Delivery Partner'}
                  </h1>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 inline shrink-0" />
                    Verified
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-600 font-medium truncate">
                  <span className="font-mono bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] text-orange-600 font-bold tracking-wider shrink-0">
                    ID: {profile?._id ? profile._id.slice(-6).toUpperCase() : 'PARTNER'}
                  </span>
                  <span>•</span>
                  <span className="text-slate-500 truncate">{profile?.phone || 'DoorDish Rider'}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Control Dock */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(true)}
                title="Emergency SOS"
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg sm:rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center border border-red-200 active:scale-90 transition-all shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                type="button"
                onClick={() => loadDashboardData()}
                disabled={refreshing}
                title="Refresh stats"
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg sm:rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 active:scale-90 transition-all shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin text-orange-500' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/food/delivery/help/id-card')}
                title="Digital ID Card"
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg sm:rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200 active:scale-90 transition-all shadow-xs"
              >
                <Contact className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/food/delivery/notifications')}
                title="Notifications"
                className="relative w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg sm:rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 active:scale-90 transition-all shadow-xs"
              >
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {notificationUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] sm:min-w-[17px] sm:h-[17px] px-1 rounded-full bg-orange-600 flex items-center justify-center text-[8px] sm:text-[9px] font-black text-white border-2 border-white shadow-xs">
                    {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Cockpit Row: Interactive Apple Duty Switch */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              </span>

              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight truncate">
                  {isOnline ? 'Online • Accepting Orders' : 'Offline • Shift Paused'}
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-medium truncate">
                  {isOnline
                    ? isSocketConnected
                      ? 'Live GPS dispatch active'
                      : 'Connecting to dispatch socket…'
                    : 'Toggle switch to start shift'}
                </span>
              </div>
            </div>

            {/* Apple Tactile Toggle Button */}
            <button
              type="button"
              onClick={handleToggleOnline}
              className={`relative inline-flex h-7.5 sm:h-8 w-20 sm:w-22 shrink-0 items-center rounded-full p-0.5 sm:p-1 transition-all duration-300 shadow-xs cursor-pointer ${
                isOnline ? 'bg-emerald-500' : 'bg-slate-200 border border-slate-300'
              }`}
            >
              <span className="text-[9px] sm:text-[9.5px] font-black tracking-wider uppercase px-2 w-full flex justify-between select-none">
                <span className={isOnline ? 'text-white' : 'opacity-0'}>ON</span>
                <span className={!isOnline ? 'text-slate-600' : 'opacity-0'}>OFF</span>
              </span>
              <motion.span
                layout
                animate={{ x: isOnline ? (window.innerWidth < 640 ? 48 : 54) : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute left-0.5 sm:left-1 inline-block h-6 sm:h-6 w-6 sm:w-6 transform rounded-full bg-white shadow-md"
              />
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. MAIN COCKPIT BODY ─── */}
      <main className="max-w-lg mx-auto px-3 sm:px-4 pt-3 space-y-3 w-full">
        {/* ─── DYNAMIC MISSION / ALERT CAPSULES ─── */}
        {/* Active Delivery Live Activity */}
        {activeOrder && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 p-3 sm:p-3.5 text-white shadow-lg shadow-emerald-900/10 border border-emerald-400/30 flex items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Navigation2 className="w-4.5 h-4.5 text-white animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-full">
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
              className="shrink-0 bg-white text-emerald-900 font-extrabold text-[11px] sm:text-xs px-3 py-1.5 rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1"
            >
              <span>Live Map</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </motion.div>
        )}

        {/* New Order Offer Alert */}
        {newOrdersCount > 0 && !activeOrder && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 p-3 sm:p-3.5 text-white shadow-lg shadow-orange-900/10 border border-orange-400/30 flex items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 animate-bounce">
                <Flame className="w-4.5 h-4.5 text-yellow-300" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider bg-yellow-400 text-gray-950 px-1.5 py-0.5 rounded-full font-bold">
                  {newOrdersCount} New Offer{newOrdersCount > 1 ? 's' : ''} Ready!
                </span>
                <p className="text-xs font-bold text-white truncate mt-0.5">
                  Tap to view & accept new orders
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTabJump('orders')}
              className="shrink-0 bg-white text-orange-700 font-extrabold text-[11px] sm:text-xs px-3 py-1.5 rounded-xl shadow-md active:scale-95 transition-all"
            >
              View Offers
            </button>
          </motion.div>
        )}

        {/* ─── 3. BESPOKE APPLE SHIFT & EARNINGS HUB (THE EXECUTIVE PANEL) ─── */}
        <section className="rounded-2xl sm:rounded-3xl bg-white p-3.5 sm:p-4.5 shadow-[0_3px_20px_rgba(0,0,0,0.04)] border border-slate-200/80">
          {/* Section Header with Segmented Period Control */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div className="min-w-0">
              <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-orange-600 block">
                Shift Performance
              </span>
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5 truncate">
                {metricPeriod === 'all' ? 'All-Time Performance' : `Today (${formatTodayDate()})`}
              </h2>
            </div>

            {/* Apple Style Segmented Pill Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200/60 shrink-0">
              <button
                type="button"
                onClick={() => setMetricPeriod('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[9.5px] sm:text-[10px] font-extrabold transition-all duration-200 ${
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
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[9.5px] sm:text-[10px] font-extrabold transition-all duration-200 ${
                  metricPeriod === 'today'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Today
              </button>
            </div>
          </div>

          {/* Primary Metric Highlights: Dual High-Impact Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-3">
            {/* 1. Total Earnings */}
            <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 p-3 sm:p-3.5 border border-emerald-500/20 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] sm:text-[10.5px] font-extrabold text-emerald-800 uppercase tracking-wider truncate">
                    {metricPeriod === 'all' ? 'Earnings' : "Today"}
                  </span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                  </div>
                </div>

                <div className="flex items-baseline gap-0.5 min-w-0">
                  <span className="text-xs font-black text-emerald-700">₹</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-950 tracking-tight truncate">
                    {Number(displayEarningsAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[9.5px] sm:text-[10.5px] font-semibold text-emerald-800 border-t border-emerald-500/20 pt-1.5 flex-wrap gap-0.5">
                <span>Base: ₹{Number(displayBaseEarning || 0).toFixed(0)}</span>
                {displayIncentive > 0 && (
                  <span className="text-emerald-700 font-extrabold">
                    +₹{Number(displayIncentive).toFixed(0)}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Total Completed Orders */}
            <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-blue-500/10 p-3 sm:p-3.5 border border-blue-500/20 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] sm:text-[10.5px] font-extrabold text-blue-800 uppercase tracking-wider truncate">
                    {metricPeriod === 'all' ? 'Delivered' : 'Today'}
                  </span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                  </div>
                </div>

                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight truncate">
                    {displayOrdersCount}
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-blue-700">Orders</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[9.5px] sm:text-[10.5px] font-semibold text-blue-800 border-t border-blue-500/20 pt-1.5 truncate">
                <span>{metricPeriod === 'all' ? "Today:" : 'All-time:'}</span>
                <span className="font-extrabold text-blue-950 truncate">
                  {metricPeriod === 'all' ? `${todaySummary.totalOrders} today` : `${allTimeSummary.totalOrders} total`}
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Financial Flow: Pocket Balance & Cash in Hand */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-2.5">
            {/* Pocket Balance Card */}
            <div
              onClick={() => handleTabJump('pocket')}
              className="bg-slate-50/90 hover:bg-slate-100/90 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-slate-200/70 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  Pocket Balance
                </span>
                <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-bold text-slate-600">₹</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 truncate">
                  {Number(wallet.pocketBalance || 0).toFixed(0)}
                </span>
              </div>
              <p className="text-[9.5px] sm:text-[10px] text-emerald-600 mt-0.5 flex items-center gap-0.5 font-bold truncate">
                <span>Withdraw payout</span>
                <ChevronRight className="w-3 h-3 inline shrink-0" />
              </p>
            </div>

            {/* Cash in Hand & Cash Limit Gauge */}
            <div className="bg-slate-50/90 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-slate-200/70">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  Cash in Hand
                </span>
                <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-400 shrink-0">
                  Limit: ₹{Number(wallet.totalCashLimit || 10000).toFixed(0)}
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-bold text-slate-600">₹</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 truncate">
                  {Number(wallet.cashInHand || 0).toFixed(0)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cashLimitPercent > 80
                      ? 'bg-rose-500'
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

        {/* ─── 4. APPLE OPERATIONAL ACTION DOCK ─── */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
              Navigation & Services
            </h3>
            <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-semibold">Shortcuts</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Live Map / Navigation */}
            <button
              type="button"
              onClick={() => handleTabJump('feed')}
              className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-2.5 sm:gap-3 text-left hover:border-blue-300 active:scale-[0.98] transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Navigation2 className="w-4.5 h-4.5 rotate-45" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11.5px] sm:text-xs font-extrabold text-slate-900 truncate">Live GPS Radar</h4>
                <p className="text-[9.5px] sm:text-[10px] text-slate-500 truncate">Navigation & routes</p>
              </div>
            </button>

            {/* Orders Queue */}
            <button
              type="button"
              onClick={() => handleTabJump('orders')}
              className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-2.5 sm:gap-3 text-left hover:border-orange-300 active:scale-[0.98] transition-all group relative cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <Package className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11.5px] sm:text-xs font-extrabold text-slate-900 truncate">Orders Queue</h4>
                <p className="text-[9.5px] sm:text-[10px] text-slate-500 truncate">New offers & active</p>
              </div>
              {newOrdersCount > 0 && (
                <span className="absolute top-2 right-2 bg-orange-600 text-white text-[8.5px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                  {newOrdersCount}
                </span>
              )}
            </button>

            {/* Pocket / Balance */}
            <button
              type="button"
              onClick={() => handleTabJump('pocket')}
              className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-2.5 sm:gap-3 text-left hover:border-emerald-300 active:scale-[0.98] transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wallet className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11.5px] sm:text-xs font-extrabold text-slate-900 truncate">Pocket Hub</h4>
                <p className="text-[9.5px] sm:text-[10px] text-slate-500 truncate">
                  ₹{Number(wallet.pocketBalance || 0).toFixed(0)} payout
                </p>
              </div>
            </button>

            {/* Trip History */}
            <button
              type="button"
              onClick={() => handleTabJump('history')}
              className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-2.5 sm:gap-3 text-left hover:border-purple-300 active:scale-[0.98] transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <History className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11.5px] sm:text-xs font-extrabold text-slate-900 truncate">Trip Logs</h4>
                <p className="text-[9.5px] sm:text-[10px] text-slate-500 truncate">{allTimeSummary.totalOrders} total trips</p>
              </div>
            </button>
          </div>
        </section>

        {/* ─── 5. BESPOKE DELIVERED DELIVERIES (APPLE ACTIVITY FEED) ─── */}
        <section className="rounded-2xl sm:rounded-3xl bg-white p-3.5 sm:p-4.5 shadow-[0_3px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 shrink-0" />
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                Delivered Deliveries
              </h3>
            </div>

            {/* List Filter Tabs: All Completed vs Today */}
            <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setTripsTab('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[9.5px] sm:text-[10px] font-extrabold transition-all duration-200 ${
                  tripsTab === 'all'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({allTrips.length})
              </button>
              <button
                type="button"
                onClick={() => setTripsTab('today')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[9.5px] sm:text-[10px] font-extrabold transition-all duration-200 ${
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
            <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
              <span className="text-[11px] sm:text-xs font-semibold">Syncing partner delivery logs…</span>
            </div>
          ) : displayedTrips.length === 0 ? (
            <div className="py-8 px-3 text-center rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100/70 text-orange-600 flex items-center justify-center mx-auto mb-1">
                <Package className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                {tripsTab === 'today'
                  ? 'No orders delivered yet today'
                  : 'No completed orders found for this partner'}
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-500 max-w-xs mx-auto">
                {tripsTab === 'today' && allTrips.length > 0 ? (
                  <span>
                    You have delivered <strong>{allTrips.length} orders</strong> in total. Switch to "All" tab to view them.
                  </span>
                ) : (
                  'Turn Online above to start receiving orders and earning!'
                )}
              </p>
              {tripsTab === 'today' && allTrips.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTripsTab('all')}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-3 h-3" />
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
                    className="py-2.5 sm:py-3 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 rounded-xl px-1.5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11.5px] sm:text-xs font-extrabold text-slate-900 truncate">
                            {restName}
                          </span>
                          <span className="text-[8.5px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/50 shrink-0">
                            Delivered
                          </span>
                        </div>
                        <p className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap truncate">
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
                      <span className="text-xs sm:text-sm font-black text-emerald-600 block">
                        +₹{earning.toFixed(2)}
                      </span>
                      <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                        Rider Earning
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── 6. HELPER & SUPPORT BAR ─── */}
        <div className="rounded-xl sm:rounded-2xl bg-slate-100/80 p-3 sm:p-3.5 border border-slate-200/60 flex items-center justify-between gap-2.5 text-slate-600">
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle className="w-4.5 h-4.5 text-slate-500 shrink-0" />
            <div className="text-[11px] sm:text-xs min-w-0">
              <span className="font-bold text-slate-800 block truncate">Need Delivery Support?</span>
              <span className="text-[10px] text-slate-500 truncate block">
                Raise tickets or contact admin helpline
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/food/delivery/help/tickets')}
            className="text-[11px] sm:text-xs font-bold text-orange-600 hover:text-orange-700 shrink-0 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs active:scale-95 transition-all"
          >
            Get Help
          </button>
        </div>
      </main>

      {/* ─── 7. EMERGENCY SOS MODAL (APPLE ACTION SHEET STYLE) ─── */}
      <AnimatePresence>
        {emergencyModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEmergencyModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-2xs"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-4.5 sm:p-6 shadow-2xl z-10 border border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4.5 h-4.5" />
                  <h3 className="text-sm sm:text-base font-extrabold">Emergency SOS Helpline</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(false)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold active:scale-95 transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3.5 space-y-2.5">
                <a
                  href={`tel:${emergencyNumbers.contactPolice || '112'}`}
                  className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs">
                      POLICE
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">Police Assistance</h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">
                        {emergencyNumbers.contactPolice || '112'}
                      </p>
                    </div>
                  </div>
                  <PhoneCall className="w-4 h-4 text-red-600" />
                </a>

                <a
                  href={`tel:${emergencyNumbers.medicalEmergency || '108'}`}
                  className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                      AMB
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">Medical / Ambulance</h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">
                        {emergencyNumbers.medicalEmergency || '108'}
                      </p>
                    </div>
                  </div>
                  <PhoneCall className="w-4 h-4 text-amber-600" />
                </a>

                {emergencyNumbers.accidentHelpline && (
                  <a
                    href={`tel:${emergencyNumbers.accidentHelpline}`}
                    className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        SOS
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900">Accident Helpline</h4>
                        <p className="text-[10px] sm:text-[11px] text-slate-500">
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
