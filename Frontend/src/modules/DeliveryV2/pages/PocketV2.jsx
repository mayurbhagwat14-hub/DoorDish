import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, IndianRupee, ArrowRight,
  ShieldCheck, AlertTriangle, HelpCircle,
  Receipt, FileText, LayoutGrid, X, ChevronRight,
  Sparkles, Loader2, CreditCard, Banknote, History
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { showUserFacingApiError } from '@/shared/utils/apiError';
import { formatCurrency } from '@food/utils/currency';
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@food/utils/businessSettings";
import { Skeleton } from '@food/components/ui/skeleton';

export const PocketV2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [walletState, setWalletState] = useState({
    totalBalance: 0,
    cashInHand: 0,
    availableCashLimit: 0,
    totalCashLimit: 0,
    pendingCashSubmission: 0,
    availableToDeposit: 0,
    weeklyEarnings: 0,
    weeklyOrders: 0,
    payoutAmount: 0,
    payoutPeriod: 'Current Week',
    bankDetailsFilled: false
  });

  const [activeOffer, setActiveOffer] = useState({
    targetAmount: 0,
    targetOrders: 0,
    currentOrders: 0,
    currentEarnings: 0,
    validTill: '',
    isLive: false
  });

  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositMode, setDepositMode] = useState("cash"); // cash | online

  const openDepositPopup = () => {
    setDepositMode("cash");
    setDepositAmount("");
    setShowDepositPopup(true);
    refreshWalletSilent();
  };

  const closeDepositPopup = () => {
    setShowDepositPopup(false);
    setDepositMode("cash");
    setDepositAmount("");
    setDepositing(false);
  };

  const applyWalletFromApi = (wallet = {}) => {
    if (!wallet || typeof wallet !== "object") return;
    setWalletState((prev) => ({
      ...prev,
      totalBalance: Number(wallet.pocketBalance) || prev.totalBalance,
      cashInHand: Number(wallet.cashInHand) ?? prev.cashInHand,
      availableCashLimit: Number(wallet.availableCashLimit) ?? prev.availableCashLimit,
      totalCashLimit: Number(wallet.totalCashLimit) ?? prev.totalCashLimit,
      pendingCashSubmission: Number(wallet.pendingCashSubmission) ?? prev.pendingCashSubmission,
      availableToDeposit:
        wallet.availableToDeposit != null
          ? Number(wallet.availableToDeposit)
          : Math.max(0, Number(wallet.cashInHand ?? prev.cashInHand) - Number(wallet.pendingCashSubmission ?? prev.pendingCashSubmission)),
      payoutAmount:
        wallet.lastPayout?.amount != null
          ? Number(wallet.lastPayout.amount)
          : 0,
      payoutPeriod: wallet.lastPayout?.date
        ? new Date(wallet.lastPayout.date).toLocaleDateString()
        : 'No recent payout',
    }));
    window.dispatchEvent(new CustomEvent("deliveryWalletStateUpdated"));
  };

  const refreshWalletSilent = async () => {
    try {
      const walletRes = await deliveryAPI.getWallet();
      const wallet = walletRes?.data?.data?.wallet || {};
      applyWalletFromApi(wallet);
    } catch {
      // keep existing wallet state if refresh fails
    }
  };

  useEffect(() => {
    const handleWalletRefresh = () => {
      refreshWalletSilent();
    };
    window.addEventListener("delivery-wallet-refresh", handleWalletRefresh);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshWalletSilent();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("delivery-wallet-refresh", handleWalletRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profileRes, earningsRes, walletRes] = await Promise.all([
          deliveryAPI.getProfile(),
          deliveryAPI.getEarnings({ period: 'week' }),
          deliveryAPI.getWallet()
        ]);

        const profile = profileRes?.data?.data?.profile || {};
        const summary = earningsRes?.data?.data?.summary || {};
        const wallet = walletRes?.data?.data?.wallet || {};
        const activeAddonsRes = await deliveryAPI.getActiveEarningAddons().catch(() => null);
        const activeOfferPayload =
          activeAddonsRes?.data?.data?.activeOffer ||
          activeAddonsRes?.data?.activeOffer ||
          null;
        
        const bankDetails = profile?.documents?.bankDetails;
        const isFilled = !!(bankDetails?.accountNumber);

        setWalletState({
          totalBalance: Number(wallet.pocketBalance) || 0,
          cashInHand: Number(wallet.cashInHand) || 0,
          availableCashLimit: Number(wallet.availableCashLimit) || 0,
          totalCashLimit: Number(wallet.totalCashLimit) || 0,
          pendingCashSubmission: Number(wallet.pendingCashSubmission) || 0,
          availableToDeposit:
            wallet.availableToDeposit != null
              ? Number(wallet.availableToDeposit)
              : Math.max(0, Number(wallet.cashInHand) || 0),
          weeklyEarnings: Number(summary.totalEarnings) || 0,
          weeklyOrders: Number(summary.totalOrders) || 0,
          payoutAmount: Number(wallet.lastPayout?.amount) || 0,
          payoutPeriod: wallet.lastPayout?.date ? new Date(wallet.lastPayout.date).toLocaleDateString() : 'Current Week',
          bankDetailsFilled: isFilled
        });

        if (activeOfferPayload && typeof activeOfferPayload === 'object') {
          setActiveOffer({
            targetAmount: Number(activeOfferPayload.targetAmount || activeOfferPayload.guaranteeAmount) || 0,
            targetOrders: Number(activeOfferPayload.targetOrders || activeOfferPayload.ordersRequired) || 0,
            currentOrders: Number(activeOfferPayload.currentOrders || activeOfferPayload.completedOrders) || 0,
            currentEarnings: Number(activeOfferPayload.currentEarnings || activeOfferPayload.earnedSoFar) || 0,
            validTill: activeOfferPayload.validTill || activeOfferPayload.expiresAt || '',
            isLive: Boolean(activeOfferPayload.isLive ?? true)
          });
        } else {
          setActiveOffer({
            targetAmount: 0,
            targetOrders: 0,
            currentOrders: 0,
            currentEarnings: 0,
            validTill: '',
            isLive: false
          });
        }
      } catch (err) {
        console.warn('Failed to load pocket data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDeposit = async () => {
    if (!canDepositMore) return;
    const amt = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amt) || amt < 1) {
      toast.error("Enter a valid deposit amount (min ₹1)");
      return;
    }

    if (amt > walletState.availableToDeposit) {
      const pendingNote = walletState.pendingCashSubmission > 0
        ? ` (₹${walletState.pendingCashSubmission} already pending admin confirmation)`
        : "";
      toast.error(`Amount cannot exceed available cash (₹${walletState.availableToDeposit})${pendingNote}`);
      return;
    }

    try {
      setDepositing(true);
      const res = await deliveryAPI.depositCashLimit(amt);
      const rp = res?.data?.data?.razorpay;
      
      if (!rp?.orderId) {
        toast.error("Payment initialization failed");
        setDepositing(false);
        return;
      }

      const profileRes = await deliveryAPI.getProfile();
      const profile = profileRes?.data?.data?.profile || {};
      const companyName = await getCompanyNameAsync();

      await initRazorpayPayment({
        key: rp.key,
        amount: rp.amount,
        currency: rp.currency || "INR",
        order_id: rp.orderId,
        name: companyName,
        description: `Cash limit deposit - ₹${amt}`,
        prefill: { 
           name: profile.name, 
           email: profile.email, 
           contact: profile.phone 
        },
        handler: async (res) => {
          try {
            const verifyRes = await deliveryAPI.verifyDepositPayment({
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
              amount: amt
            });
            if (verifyRes?.data?.success) {
              toast.success("Deposit successful");
              applyWalletFromApi(verifyRes?.data?.data?.wallet);
              closeDepositPopup();
            }
          } catch (err) {
            toast.error("Verification failed");
          } finally {
            setDepositing(false);
          }
        },
        onError: () => setDepositing(false),
        onClose: () => setDepositing(false)
      });
    } catch (err) {
      setDepositing(false);
      showUserFacingApiError(err, "Deposit failed to start");
    }
  };

  const handleCashSubmit = async () => {
    if (!canDepositMore) return;
    const amt = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amt) || amt < 1) {
      toast.error("Enter a valid amount (minimum ₹1)");
      return;
    }

    if (amt > walletState.availableToDeposit) {
      const pendingNote = walletState.pendingCashSubmission > 0
        ? ` (₹${walletState.pendingCashSubmission} already pending admin confirmation)`
        : "";
      toast.error(`Amount cannot exceed available cash (₹${walletState.availableToDeposit})${pendingNote}`);
      return;
    }

    try {
      setDepositing(true);
      const res = await deliveryAPI.submitCashDeposit(amt);
      if (res?.data?.success) {
        toast.success("Cash submitted successfully. Waiting for admin confirmation.");
        applyWalletFromApi(res?.data?.data?.wallet);
        setDepositAmount("");
        setDepositMode("cash");
      } else {
        showUserFacingApiError(
          { response: { data: { message: res?.data?.message } } },
          "Cash submission failed",
        );
      }
    } catch (err) {
      showUserFacingApiError(err, "Cash submission failed");
    } finally {
      setDepositing(false);
    }
  };

  const hasPendingCashSubmission = walletState.pendingCashSubmission > 0;
  const canDepositMore = walletState.availableToDeposit > 0;
  const isDepositInputDisabled = !canDepositMore;
  const isSubmitDisabled = isDepositInputDisabled || depositing || !String(depositAmount).trim();

  const ordersProgress = activeOffer.targetOrders > 0 ? Math.min(activeOffer.currentOrders / activeOffer.targetOrders, 1) : 0;
  const earningsProgress = activeOffer.targetAmount > 0 ? Math.min(activeOffer.currentEarnings / activeOffer.targetAmount, 1) : 0;
  const hasActiveOffer = activeOffer.isLive && (activeOffer.targetAmount > 0 || activeOffer.targetOrders > 0);

  const formatOfferValidTill = (validTill) => {
    if (!validTill) return '';
    const parsed = new Date(validTill);
    if (Number.isNaN(parsed.getTime())) return String(validTill);
    return parsed.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = (day + 6) % 7;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(now.getDate() - mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const formatDate = (d) => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-800 pb-28 sm:pb-32 font-sans select-none antialiased w-full overflow-x-hidden">
      {/* ─── Apple iOS Top Bar ─── */}
      <div className="bg-white/95 border-b border-slate-200/80 px-4 py-3 sticky top-0 z-[100] backdrop-blur-xl shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">Pocket & Wallet</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Earnings & Settlements</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/food/delivery/pocket/details')}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200/60 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          <History className="w-3.5 h-3.5 text-slate-500" />
          <span>Passbook</span>
        </button>
      </div>

      {/* ─── 1. BANK DETAILS VERIFICATION BANNER ─── */}
      {!loading && !walletState.bankDetailsFilled && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-extrabold text-amber-950 truncate">Submit Bank Details</h3>
              <p className="text-[10px] sm:text-[11px] text-amber-800 font-medium truncate">PAN & bank required for payouts</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/food/delivery/profile/details')}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            Submit
          </button>
        </div>
      )}

      {/* ─── 2. MAIN WALLET COCKPIT ─── */}
      <main className="max-w-lg mx-auto px-3 sm:px-4 pt-3.5 space-y-3 w-full">
        {/* Weekly Earnings Card */}
        <div 
          onClick={() => navigate('/food/delivery/pocket/details')}
          className="rounded-2xl sm:rounded-3xl bg-white p-4.5 sm:p-5 shadow-[0_3px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 text-center transition-all active:scale-[0.99] cursor-pointer"
        >
          <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200/50 inline-block mb-2">
            Weekly Earnings: {getCurrentWeekRange()}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight min-h-[2.5rem] flex items-center justify-center">
            {loading ? <Skeleton className="h-9 w-32" /> : `₹${walletState.weeklyEarnings.toFixed(0)}`}
          </h2>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold mt-1.5 flex items-center justify-center gap-1">
            <span>Tap to view earnings breakdown</span>
            <ChevronRight className="w-3.5 h-3.5 inline" />
          </p>
        </div>

        {/* ─── 3. EARNINGS GUARANTEE OFFER (LIVE PROGRESS RINGS) ─── */}
        {hasActiveOffer && (
          <div className="rounded-2xl sm:rounded-3xl bg-white shadow-[0_3px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden">
            <div className="bg-slate-900 p-3.5 sm:p-4 text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-extrabold truncate mb-0.5">Earnings Guarantee</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                    Till {formatOfferValidTill(activeOffer.validTill)}
                  </span>
                  {activeOffer.isLive && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl text-center border border-white/10 shrink-0">
                <p className="text-sm sm:text-base font-black leading-none">₹{activeOffer.targetAmount}</p>
                <p className="text-[8.5px] font-bold text-slate-300 uppercase mt-0.5">{activeOffer.targetOrders} orders</p>
              </div>
            </div>

            <div className="p-6 pb-8 flex items-center justify-around gap-4">
              {/* Orders Progress */}
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                    <motion.circle 
                      cx="50" cy="50" r="42" fill="none" stroke="#0F172A" strokeWidth="8" strokeLinecap="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: ordersProgress }} transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-slate-900 leading-none">{activeOffer.currentOrders}</span>
                    <span className="text-[8.5px] font-bold text-slate-400 uppercase mt-0.5">of {activeOffer.targetOrders}</span>
                  </div>
                </div>
                <p className="text-[9.5px] font-extrabold text-slate-600 uppercase tracking-wider mt-3">Orders Completed</p>
              </div>

              {/* Earnings Progress */}
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                    <motion.circle 
                      cx="50" cy="50" r="42" fill="none" stroke="#F97316" strokeWidth="8" strokeLinecap="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: earningsProgress }} transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
                    <span className="text-sm font-black text-slate-900 leading-none truncate">₹{activeOffer.currentEarnings}</span>
                  </div>
                </div>
                <p className="text-[9.5px] font-extrabold text-slate-600 uppercase tracking-wider mt-3">Earned So Far</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4. POCKET BALANCES & LIMITS HUB ─── */}
        <div className="rounded-2xl sm:rounded-3xl bg-white shadow-[0_3px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
          {/* Pocket Balance Item */}
          <button 
            type="button"
            onClick={() => navigate('/food/delivery/pocket/balance')}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate">Pocket Balance</span>
                <p className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-tight">Withdrawal Hub</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm sm:text-base font-black text-slate-900">
                {loading ? <Skeleton className="h-5 w-16" /> : `₹${walletState.totalBalance.toFixed(2)}`}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </button>

          {/* Available Cash Limit Item */}
          <button 
            type="button"
            onClick={() => navigate('/food/delivery/pocket/cash-limit')}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 border border-blue-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate">Available Cash Limit</span>
                <p className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-tight">Spend Control</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm sm:text-base font-black text-slate-900">
                {loading ? <Skeleton className="h-5 w-16" /> : `₹${walletState.availableCashLimit.toFixed(2)}`}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </button>

          {/* Quick Deposit Button Action */}
          <div className="p-3.5 sm:p-4 bg-slate-50/50">
            <button 
              type="button"
              onClick={openDepositPopup}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Banknote className="w-4 h-4" />
              <span>Deposit Hand Cash</span>
            </button>
          </div>
        </div>

        {/* ─── 5. FINANCIAL SERVICES 2x2 GRID ─── */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
              Financial Services
            </h3>
            <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-semibold">Statements</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Last Payout */}
            <div 
              onClick={() => navigate('/food/delivery/pocket/payout')}
              className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-2.5 border border-blue-500/20">
                  <IndianRupee className="w-4.5 h-4.5" />
                </div>
                <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Last Payout</p>
                <div className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate">
                  {loading ? <Skeleton className="h-6 w-16" /> : `₹${walletState.payoutAmount}`}
                </div>
              </div>
              <p className="text-[9px] text-slate-500 font-semibold mt-2 truncate">{walletState.payoutPeriod}</p>
            </div>

            {/* Limit Settlement */}
            <div 
              onClick={() => navigate('/food/delivery/pocket/limit-settlement')}
              className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center mb-2.5 border border-orange-500/20">
                  <Receipt className="w-4.5 h-4.5" />
                </div>
                <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Limits</p>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">Limit Settlement</h4>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold mt-2">Manage limit</p>
            </div>

            {/* Deduction List */}
            <div 
              onClick={() => navigate('/food/delivery/pocket/deductions')}
              className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-2.5 border border-rose-500/20">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Deductions</p>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">Deduction List</h4>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold mt-2">View deductions</p>
            </div>

            {/* Pocket Statement */}
            <div 
              onClick={() => navigate('/food/delivery/pocket/details')}
              className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center mb-2.5 border border-purple-500/20">
                  <LayoutGrid className="w-4.5 h-4.5" />
                </div>
                <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">History</p>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">Pocket Statement</h4>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold mt-2">Transaction log</p>
            </div>
          </div>
        </section>
      </main>

      {/* ─── 6. APPLE ACTION SHEET DEPOSIT MODAL ─── */}
      <AnimatePresence>
        {showDepositPopup && (
          <div className="fixed inset-0 z-[1000] flex items-end justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={closeDepositPopup} 
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: "spring", damping: 26, stiffness: 220 }} 
              className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 shadow-2xl z-10 border border-slate-100"
            >
              {/* Handle */}
              <button
                type="button"
                onClick={closeDepositPopup}
                className="w-full flex justify-center py-1 mb-3 -mt-1 cursor-pointer"
                aria-label="Close deposit popup"
              >
                <span className="w-12 h-1 bg-slate-300 rounded-full" />
              </button>

              {hasPendingCashSubmission && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-center">
                  <p className="text-xs font-bold text-amber-900 leading-relaxed">
                    You already paid ₹{walletState.pendingCashSubmission.toLocaleString("en-IN")}
                    <span className="block text-[10px] font-semibold text-amber-700 mt-0.5 uppercase tracking-wide">
                      Waiting for admin confirmation
                    </span>
                  </p>
                </div>
              )}
              
              <div className="text-center mb-5">
                <div className="w-13 h-13 bg-orange-500/10 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-orange-500/20">
                  <IndianRupee className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Deposit Hand Cash</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Settle Hand Dues</p>
              </div>
              
              <div className="bg-slate-50/90 rounded-2xl p-4 mb-4 border border-slate-200/70">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10.5px] font-bold text-slate-500 uppercase">Cash In Hand</span>
                  <span className="text-sm font-black text-slate-900">₹{walletState.cashInHand}</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                  <button
                    type="button"
                    onClick={() => { setDepositMode("cash"); setDepositAmount(""); }}
                    className={`py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wide border transition-all cursor-pointer ${
                      depositMode === "cash"
                        ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    Submit by Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDepositMode("online"); setDepositAmount(""); }}
                    className={`py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wide border transition-all cursor-pointer ${
                      depositMode === "online"
                        ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    Deposit Online
                  </button>
                </div>

                <div className="relative">
                  <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                  <input 
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder={depositMode === "cash" ? "Cash amount" : "Amount to deposit"}
                    disabled={isDepositInputDisabled}
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-base font-bold focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                {canDepositMore && (
                  <p className="text-[9.5px] font-bold text-slate-400 mt-2.5 text-center uppercase tracking-tight">
                    {depositMode === "cash"
                      ? "Min ₹1 • Admin confirmation required"
                      : "Min ₹1 • Instant limit update"}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <button 
                  type="button"
                  onClick={depositMode === "cash" ? handleCashSubmit : handleDeposit}
                  disabled={isSubmitDisabled}
                  className={`w-full py-3.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                    isSubmitDisabled
                      ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
                      : "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
                  }`}
                >
                  {depositing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {depositing
                    ? "Processing..."
                    : depositMode === "cash"
                      ? "Submit Cash"
                      : "Proceed to Pay"}
                </button>
                <button 
                  type="button"
                  onClick={closeDepositPopup} 
                  className="w-full py-2.5 text-slate-400 font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PocketV2;
