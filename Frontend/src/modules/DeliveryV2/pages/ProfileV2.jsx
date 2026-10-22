import { useEffect, useRef, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  User,
  ChevronRight,
  Bike,
  Ticket,
  Star,
  Share2,
  LogOut,
  X,
  Briefcase,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  CreditCard,
  FileText,
  Contact,
  HelpCircle,
  ExternalLink,
  Gift
} from "lucide-react"
import { deliveryAPI, authAPI } from "@food/api"
import { toast } from "sonner"
import { showUserFacingApiError } from "@/shared/utils/apiError"
import { showAccountDeletedToast } from "@/shared/utils/customToasts"
import { clearModuleAuth } from "@food/utils/auth"

export const ProfileV2 = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [referralReward, setReferralReward] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutSubmitting, setLogoutSubmitting] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteCaptcha, setDeleteCaptcha] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [showBalanceWarning, setShowBalanceWarning] = useState(false)
  const [balanceData, setBalanceData] = useState({ balance: 0, type: "Wallet" })
  const [isCheckingBalance, setIsCheckingBalance] = useState(false)

  // Lock scroll when any popup is open
  useEffect(() => {
    const isPopupOpen = showLogoutConfirm || deleteAccountOpen || showBalanceWarning;
    if (isPopupOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showLogoutConfirm, deleteAccountOpen, showBalanceWarning]);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          setProfile(response.data.data.profile)
        }
      } catch (error) {
        toast.error("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    deliveryAPI.getReferralStats().then((res) => {
      const reward = res?.data?.data?.stats?.rewardAmount
      setReferralReward(Number(reward) || 0)
    }).catch(() => {})
  }, [])

  const refId = profile?._id || profile?.id || profile?.referralCode || ""
  const referralLink = refId ? `${window.location.origin}/food/delivery/signup?ref=${encodeURIComponent(String(refId))}` : ""

  const handleShareReferral = async () => {
    if (!referralLink) return
    const rewardText = referralReward > 0 ? `₹${referralReward}` : "rewards"
    const shareText = `Join as a delivery partner on DoorDish and earn ${rewardText}. Register with my referral link:`
    try {
      if (navigator.share) {
        await navigator.share({ title: "DoorDish Delivery Referral", text: shareText, url: referralLink })
      } else {
        const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralLink}`)}`
        window.open(fallbackUrl, "_blank", "noopener,noreferrer")
      }
    } catch (e) {}
  }

  const handleLogout = async () => {
    if (logoutSubmitting) return
    try {
      setLogoutSubmitting(true)
      await deliveryAPI.logout()
    } catch (error) {}
    clearModuleAuth("delivery")
    localStorage.removeItem("app:isOnline")
    navigate("/food/delivery/login", { replace: true })
    setLogoutSubmitting(false)
  }

  const handleLogoutAllDevices = async () => {
    if (logoutSubmitting) return
    try {
      setLogoutSubmitting(true)
      await authAPI.logoutFromAllDevices("delivery")
    } catch (error) {}
    clearModuleAuth("delivery")
    localStorage.removeItem("app:isOnline")
    navigate("/food/delivery/login", { replace: true })
    setLogoutSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center font-sans">
        <div className="flex items-center gap-2 text-slate-600">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading partner profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-800 font-sans pb-28 sm:pb-32 select-none antialiased w-full overflow-x-hidden">
      <main className="max-w-lg mx-auto px-3 sm:px-4 pt-3.5 space-y-3 w-full">
        {/* ─── 1. PROFILE IDENTITY HERO CARD ─── */}
        <div 
          onClick={() => navigate("/food/delivery/profile/details")}
          className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-5 shadow-[0_3px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-xs">
                  <img 
                    src={profile?.profileImage?.url || "/assets/images/profile_avatar.webp"} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-slate-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 truncate tracking-tight">
                    {profile?.name || "Delivery Partner"}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active Partner
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium truncate">
                  <span className="font-mono bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded text-[10px] text-orange-600 font-bold shrink-0">
                    ID: {profile?.deliveryId || (profile?._id ? profile._id.slice(-6).toUpperCase() : "PARTNER")}
                  </span>
                  <span>•</span>
                  <span className="truncate">{profile?.phone || "DoorDish Rider"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400 shrink-0">
              <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">Details</span>
              <ChevronRight className="w-4.5 h-4.5" />
            </div>
          </div>
        </div>

        {/* ─── 2. PRIMARY QUICK SERVICE TILES (2x2) ─── */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate("/food/delivery/history")}
            className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-3 text-left hover:border-blue-300 active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-500/20">
              <Bike className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-900 truncate">Trips History</h4>
              <p className="text-[9.5px] text-slate-400 font-medium truncate">Completed deliveries</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/food/delivery/profile/reviews")}
            className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-3 text-left hover:border-amber-300 active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors border border-amber-500/20">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-900 truncate">My Reviews</h4>
              <p className="text-[9.5px] text-slate-400 font-medium truncate">Ratings & feedback</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/food/delivery/profile/bank")}
            className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-3 text-left hover:border-emerald-300 active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors border border-emerald-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-900 truncate">Bank & Payouts</h4>
              <p className="text-[9.5px] text-slate-400 font-medium truncate">Account details</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/food/delivery/profile/documents")}
            className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-3 text-left hover:border-purple-300 active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors border border-purple-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-900 truncate">My Documents</h4>
              <p className="text-[9.5px] text-slate-400 font-medium truncate">License, RC, PAN</p>
            </div>
          </button>
        </div>

        {/* ─── 3. REFER & EARN BANNER ─── */}
        {referralLink && (
          <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white shadow-md shadow-orange-500/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-yellow-200" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black truncate">Refer a Partner & Earn</h4>
                <p className="text-[10px] sm:text-[11px] text-orange-100 font-medium truncate">
                  Get {referralReward > 0 ? `₹${referralReward}` : "cash bonuses"} for every friend who joins
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleShareReferral}
              className="bg-white text-orange-700 px-3.5 py-1.5 rounded-xl font-black text-xs shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        )}

        {/* ─── 4. SUPPORT & HELP SERVICES (GROUPED LIST) ─── */}
        <div className="rounded-2xl sm:rounded-3xl bg-white shadow-[0_3px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
          <div className="px-4 py-2.5 bg-slate-50/50">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Support & Identification</span>
          </div>

          {/* Support Tickets */}
          <div 
            onClick={() => navigate("/food/delivery/help/tickets")}
            className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Ticket className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate">Support Tickets</span>
                <p className="text-[9.5px] text-slate-400 font-medium truncate">Get help with orders or payments</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </div>

          {/* Partner Digital ID Card */}
          <div 
            onClick={() => navigate("/food/delivery/help/id-card")}
            className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                <Contact className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate">Digital Partner ID Card</span>
                <p className="text-[9.5px] text-slate-400 font-medium truncate">Official DoorDish Rider identification</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </div>

          {/* Help Center Info */}
          <div 
            onClick={() => navigate("/food/delivery/help/content")}
            className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <HelpCircle className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate">Help & Guidelines</span>
                <p className="text-[9.5px] text-slate-400 font-medium truncate">FAQs, policies, and rider safety</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </div>
        </div>

        {/* ─── 5. ACCOUNT ACTIONS (LOGOUT & DELETE) ─── */}
        <div className="rounded-2xl sm:rounded-3xl bg-white shadow-[0_3px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
          {/* Logout */}
          <div 
            onClick={() => setShowLogoutConfirm(true)}
            className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-rose-50/50 active:bg-rose-50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <LogOut className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-rose-600 block truncate">Log Out</span>
                <p className="text-[9.5px] text-slate-400 font-medium truncate">End shift session on this phone</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </div>

          {/* Delete Account */}
          <div
            onClick={() => { 
              setDeleteCaptcha(""); 
              setDeleteAccountOpen(true);
            }}
            className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-rose-50/50 active:bg-rose-50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                {isCheckingBalance ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-rose-600 rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4.5 h-4.5" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-slate-700 group-hover:text-rose-600 block truncate transition-colors">
                  Delete Account
                </span>
                <p className="text-[9.5px] text-slate-400 font-medium truncate">Permanent partner deregistration</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </div>
        </div>
      </main>

      {/* ─── 6. LOGOUT CONFIRM POPUP (APPLE MODAL STYLE) ─── */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl flex flex-col items-center border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mb-3">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-sm">
                <img 
                  src={profile?.profileImage?.url || "/assets/images/profile_avatar.webp"} 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
            
            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight mb-1 text-center">
              {profile?.name || "Delivery Partner"}
            </h3>
            {profile?.deliveryId && (
              <p className="text-[11px] font-mono text-slate-400 mb-5">{profile.deliveryId}</p>
            )}

            <p className="text-xs text-slate-500 text-center mb-5">
              Are you sure you want to log out from this device?
            </p>

            <div className="w-full space-y-2.5">
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutSubmitting}
                className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 py-3 text-xs sm:text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-md shadow-rose-600/20"
              >
                {logoutSubmitting ? "Logging out..." : "Log Out"}
              </button>
              <button
                type="button"
                onClick={handleLogoutAllDevices}
                disabled={logoutSubmitting}
                className="w-full rounded-xl border border-rose-200 hover:bg-rose-50 bg-white py-3 text-xs sm:text-sm font-black text-rose-600 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {logoutSubmitting ? "Logging out..." : "Log Out From All Devices"}
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={logoutSubmitting}
                className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 cursor-pointer uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. BALANCE WARNING POPUP ─── */}
      {showBalanceWarning && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-xs">
          <div 
            className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl p-6 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-2.5 border border-amber-500/20">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">Wait! Balance Found</h3>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-4 text-center border border-slate-200/60">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-0.5">{balanceData.type}</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">₹{balanceData.balance.toLocaleString('en-IN')}</p>
            </div>

            <p className="text-xs text-slate-600 mb-5 text-center leading-relaxed">
              You still have money in your partner account. Do you want to continue or go back and withdraw first?
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setShowBalanceWarning(false);
                  setDeleteCaptcha("");
                  setDeleteAccountOpen(true);
                }}
                className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors text-xs cursor-pointer"
              >
                Continue Anyway
              </button>
              <button
                onClick={() => setShowBalanceWarning(false)}
                className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors text-xs cursor-pointer"
              >
                Cancel & Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 8. DELETE ACCOUNT CAPTCHA POPUP ─── */}
      {deleteAccountOpen && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl p-5 sm:p-6 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-3">
              <div className="w-13 h-13 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-2.5 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">Delete Account?</h3>
            </div>

            <p className="text-xs text-slate-600 mb-3.5 leading-relaxed text-center">
              Are you sure you want to delete your delivery account?
            </p>

            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="text-xs font-bold text-rose-800">Permanent Action</span>
              </div>
              <p className="text-[10px] text-rose-700 leading-relaxed">
                Your account will be permanently closed. Historical records will be kept for financial reporting.
              </p>
            </div>
            
            <div className="mb-5">
              <input 
                type="text" 
                placeholder="Type DELETE to confirm" 
                value={deleteCaptcha}
                onChange={(e) => setDeleteCaptcha(e.target.value.toUpperCase())}
                className="w-full py-3 px-3.5 rounded-xl border-2 border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-50 outline-none transition-all font-black text-center tracking-widest text-xs uppercase placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteAccountOpen(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isDeleting || deleteCaptcha !== "DELETE") return;
                  setIsDeleting(true);
                  try {
                    await authAPI.deleteAccount("delivery");
                    showAccountDeletedToast();
                    clearModuleAuth("delivery");
                    navigate("/food/delivery/login", { replace: true });
                  } catch (err) {
                    showUserFacingApiError(err, "Failed to delete account");
                  } finally {
                    setIsDeleting(false);
                    setDeleteAccountOpen(false);
                  }
                }}
                disabled={isDeleting || deleteCaptcha !== "DELETE"}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-black text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileV2;
