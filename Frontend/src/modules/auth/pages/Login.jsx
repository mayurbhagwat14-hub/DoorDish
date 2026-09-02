import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import { Phone, Loader2, X, User, Pencil, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { setAuthData } from "@food/utils/auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"


export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 59
  const defaultTestPhone =
    import.meta.env.VITE_USE_DEFAULT_TEST_PHONE === "true"
      ? String(import.meta.env.VITE_DEFAULT_TEST_PHONE || "").replace(/\D/g, "").slice(0, 10)
      : ""
  // const [phoneNumber, setPhoneNumber] = useState("")
  const [phoneNumber, setPhoneNumber] = useState(defaultTestPhone)
  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [tempAuth, setTempAuth] = useState(null)
  const [pendingVerify, setPendingVerify] = useState(null)
  const [showRestorePopup, setShowRestorePopup] = useState(false)
  const [deletedAccountData, setDeletedAccountData] = useState(null)
  const [blockTimer, setBlockTimer] = useState(0)
  const [logoUrl, setLogoUrl] = useState("/assets/images/doordish-logo.png")
  
  useEffect(() => {
    fetch(`${API_BASE_URL}/food/admin/business-settings/public`)
      .then(res => res.json())
      .then(json => {
        if (json.data?.logo?.url) {
          setLogoUrl(json.data.logo.url)
        }
      })
      .catch(console.error)
  }, [])

  const navigate = useNavigate()
  const submitting = useRef(false)
  // iOS only opens the soft-keyboard from a focus() that happens *inside* a
  // user gesture. This hidden input is focused synchronously on the "Log in"
  // tap so the keyboard opens, then focus is transferred to the OTP boxes once
  // they mount (focus transfer keeps the keyboard up on iOS).
  const focusKeeperRef = useRef(null)
  const keyboardPrimedRef = useRef(false)

  // --- PERSISTENCE LOGIC START ---
  const SESSION_KEY = "user_auth_session_data";

  // Rehydrate state on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem(SESSION_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber);
        if (parsed.step) setStep(parsed.step);
        if (parsed.showNameModal !== undefined) setShowNameModal(parsed.showNameModal);
        if (parsed.newName) setNewName(parsed.newName);
        if (parsed.tempAuth) setTempAuth(parsed.tempAuth);
        if (parsed.pendingVerify) setPendingVerify(parsed.pendingVerify);
        if (parsed.showRestorePopup !== undefined) setShowRestorePopup(parsed.showRestorePopup);
        if (parsed.deletedAccountData) setDeletedAccountData(parsed.deletedAccountData);

        // Resume Resend Timer
        if (parsed.resendExpiresAt) {
          const remaining = Math.max(0, Math.floor((parsed.resendExpiresAt - Date.now()) / 1000));
          if (remaining > 0) setResendTimer(remaining);
        }

        // Resume Block Timer
        if (parsed.blockExpiresAt) {
          const remaining = Math.max(0, Math.floor((parsed.blockExpiresAt - Date.now()) / 1000));
          if (remaining > 0) {
            setBlockTimer(remaining);
            if (parsed.step === 1) setStep(2); // Ensure we show step 2 if blocked
          }
        }
      } catch (e) {
        console.error("Failed to rehydrate login state", e);
      }
    }
  }, []);

  // Persist state on change
  useEffect(() => {
    if (step === 1 && !phoneNumber && !blockTimer && !showNameModal && !showRestorePopup) {
      // Don't save empty initial state
      return;
    }

    const stateToSave = {
      phoneNumber,
      step,
      showNameModal,
      newName,
      tempAuth,
      pendingVerify,
      showRestorePopup,
      deletedAccountData,
      // Save expiration timestamps instead of seconds
      resendExpiresAt: resendTimer > 0 ? Date.now() + (resendTimer * 1000) : null,
      blockExpiresAt: blockTimer > 0 ? Date.now() + (blockTimer * 1000) : null,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave));
  }, [phoneNumber, step, showNameModal, newName, tempAuth, pendingVerify, showRestorePopup, deletedAccountData, resendTimer === 0, blockTimer === 0]);

  // Combined cleanup helper
  const clearSessionData = () => {
    sessionStorage.removeItem(SESSION_KEY);
  };
  // --- PERSISTENCE LOGIC END ---

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }
    if (submitting.current) return
    // Prime the keyboard inside the tap gesture so iOS keeps it open while we
    // navigate to the OTP step (Android focuses fine on mount).
    if (focusKeeperRef.current) {
      focusKeeperRef.current.focus()
      keyboardPrimedRef.current = true
    }
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setOtpError("")
      setBlockTimer(0)
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent successfully!")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP."
      const lowerMsg = msg.toLowerCase();
      const isBlocked = lowerMsg.includes("blocked") ||
        lowerMsg.includes("too many attempts") ||
        lowerMsg.includes("try again after");

      if (isBlocked) {
        let totalSeconds = 180; // default 3 mins
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          totalSeconds = (mins * 60) + secs;
        }

        setBlockTimer(totalSeconds);
        setStep(2);
        return;
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number")
      return
    }
    if (resendTimer > 0 || blockTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP resent successfully.")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend OTP."
      const lowerMsg = msg.toLowerCase();
      const isBlocked = lowerMsg.includes("blocked") ||
        lowerMsg.includes("too many attempts") ||
        lowerMsg.includes("try again after");

      if (isBlocked) {
        let totalSeconds = 180;
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          totalSeconds = (mins * 60) + secs;
        }

        setBlockTimer(totalSeconds);
        return;
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setShowNameModal(false)
    setShowRestorePopup(false)
    setDeletedAccountData(null)
    setPendingVerify(null)
    setBlockTimer(0) // Clear block timer when changing number
    setOtpError("") // Clear error
    setOtp("") // Clear inputs
    setStep(1)
    setResendTimer(0)

    if (step === 2) {
      // This naturally triggers the popstate listener which pops the navigation state
      window.history.back()
    }
  }

  const handleVerifyOTP = async (e, customOtp = null) => {
    if (e && e.preventDefault) e.preventDefault()
    const code = typeof customOtp === "string" ? customOtp : otp
    const otpDigits = String(code).replace(/\D/g, "").slice(0, 4)
    if (otpDigits.length !== 4) {
      toast.error("Please enter the 4-digit OTP")
      return
    }
    await processVerify(phoneNumber, otpDigits)
  }

  const processVerify = async (phone, otpCode, confirmAction = null) => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    let fcmToken = null
    let platform = "web"
    try {
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile";
            // Optimization: Try only the most common handler to save time
            try {
              const t = await window.flutter_inappwebview.callHandler("getFcmToken", { module: "user" });
              if (t && typeof t === "string" && t.length > 20) fcmToken = t.trim();
            } catch (e) { }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      const response = await authAPI.verifyOTP(phone, otpCode, "login", null, null, "user", null, null, fcmToken, platform, null, confirmAction)
      const data = response?.data?.data || response?.data || {}

      // Handle deleted account found
      if (data.deletedAccountFound) {
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setLoading(false)
        submitting.current = false
        return
      }

      // Handle name required (Success response with flag)
      if (data.needsName) {
        setShowRestorePopup(false)
        setPendingVerify({
          phone: phoneNumber,
          otp: otpCode,
          fcmToken,
          platform,
          confirmAction // Preserve the action (new) for the subsequent name submission
        })
        setShowNameModal(true)
        setLoading(false)
        submitting.current = false
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid parameters from server")
      }

      setAuthData("user", accessToken, user, refreshToken)

      // If user has no name, show name modal instead of immediate navigation
      if (!user.name || user.name.trim() === "") {
        setTempAuth({ accessToken, user, refreshToken })
        setShowNameModal(true)
      } else {
        clearSessionData()
        navigate("/food/user", { replace: true })
      }
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."

      // Clear OTP inputs on failure
      setOtp("")
      setTimeout(() => {
        document.getElementById("otp-0")?.focus()
      }, 50)

      if (msg.toLowerCase().includes("blocked") || msg.toLowerCase().includes("too many attempts")) {
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          setBlockTimer((mins * 60) + secs);
          msg = ""; // Clear msg so only block UI displays
        }
      }

      // Legacy check for string-based name requirement (backward compatibility)
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg))
      if (nameRequired) {
        setShowRestorePopup(false)
        setPendingVerify({
          phone: phoneNumber,
          otp: otpCode,
          fcmToken,
          platform,
          confirmAction
        })
        setShowNameModal(true)
        return
      }

      if (status === 401 && msg) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
          toast.error(msg)
        } else {
          setOtpError("Invalid OTP")
        }
      } else if (msg) {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error("Please enter your name")
      return
    }

    try {
      setIsUpdatingName(true)
      if (pendingVerify) {
        const response = await authAPI.verifyOTP(
          pendingVerify.phone,
          pendingVerify.otp,
          "login",
          newName.trim(),
          null,
          "user",
          null,
          null,
          pendingVerify.fcmToken,
          pendingVerify.platform,
          null, // _token
          pendingVerify.confirmAction // Pass the preserved action
        )
        const data = response?.data?.data || response?.data || {}
        const accessToken = data.accessToken
        const refreshToken = data.refreshToken || null
        const user = data.user

        setAuthData("user", accessToken, user, refreshToken)
        setPendingVerify(null)
        clearSessionData()
        setShowNameModal(false)
        navigate("/food/user", { replace: true })
        return
      }

      // Call update profile API
      await userAPI.updateProfile({ name: newName.trim() })

      // Update local storage and auth data with the new name
      const updatedUser = { ...tempAuth.user, name: newName.trim() }
      setAuthData("user", tempAuth.accessToken, updatedUser, tempAuth.refreshToken)

      clearSessionData()
      setShowNameModal(false)
      navigate("/food/user", { replace: true })
    } catch (err) {
      toast.error("Failed to update name. You can skip this for now or try again.")
      console.error(err)
    } finally {
      setIsUpdatingName(false)
    }
  }

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

  useEffect(() => {
    if (blockTimer <= 0) return
    const intervalId = setInterval(() => {
      setBlockTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [blockTimer])

  useEffect(() => {
    if (step === 2) {
      const focusFirst = () => {
        const el = document.getElementById("otp-0");
        if (el) {
          el.focus();
          // In mobile WebView the soft keyboard often won't open on a
          // programmatic focus alone, so also trigger a click to force it.
          el.click();
        }
      };
      // If the keyboard was primed on the "Log in" tap (iOS), transfer focus
      // ASAP so the already-open keyboard stays up instead of closing.
      if (keyboardPrimedRef.current) {
        keyboardPrimedRef.current = false;
        requestAnimationFrame(focusFirst);
        return;
      }
      setTimeout(focusFirst, 250);
    }
  }, [step]);

  // Intercept hardware back button to return to step 1 instead of leaving the page
  useEffect(() => {
    const handlePopState = () => {
      if (step === 2) {
        if (blockTimer > 0) {
          // Push state again to keep user locked on step 2
          window.history.pushState({ otpStep: true }, "")
          return
        }
        setStep(1)
        setOtp("")
        setResendTimer(0)
      }
    }

    if (step === 2) {
      window.history.pushState({ otpStep: true }, "")
      window.addEventListener("popstate", handlePopState)
    }

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [step, blockTimer > 0])

  const formatResendTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const primaryColor = "#DC2626" // Rebranded Red color

  // When an input is focused the mobile soft-keyboard opens and shrinks the
  // viewport. Scroll the focused field into the centre of the remaining space
  // so the submit button / logo never get hidden behind the keyboard.
  const handleInputFocusScroll = (e) => {
    const el = e.currentTarget
    setTimeout(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 300)
  }

  return (
    <div className="min-h-[100dvh] bg-white relative flex flex-col overflow-hidden font-['Poppins']">
      <style>
        { `
          @keyframes floatDish1 {
            0%, 100% { transform: translateY(0px) rotate(-6deg); }
            50% { transform: translateY(-15px) rotate(2deg); }
          }
          @keyframes floatDish2 {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(-8deg); }
          }
          .animate-float-dish-1 {
            animation: floatDish1 6s ease-in-out infinite;
          }
          .animate-float-dish-2 {
            animation: floatDish2 6s ease-in-out infinite;
          }
        ` }
      </style>

      {/* Top Left Orange Blob & Burger */}
      <div className="absolute top-0 left-0 w-full h-[400px] pointer-events-none z-0">
        <svg viewBox="0 0 400 400" className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none">
          <path d="M0,0 L400,0 C250,80 120,250 0,380 Z" fill="#FF5A1F" />
        </svg>
        <img 
          src="/assets/images/burger-real.png" 
          alt="Burger" 
          className="absolute top-4 -left-4 w-[180px] sm:w-[220px] object-contain drop-shadow-xl z-10 animate-float-dish-1"
        />
      </div>

      {/* Bottom Right Orange Blob & Pasta */}
      <div className="absolute bottom-0 right-0 w-full h-[350px] pointer-events-none z-0">
        <svg viewBox="0 0 400 400" className="absolute bottom-0 right-0 w-full h-full" preserveAspectRatio="none">
          <path d="M400,400 L0,400 C150,300 300,150 400,0 Z" fill="#FF5A1F" />
        </svg>
        <img 
          src="/assets/images/dish-img.png" 
          alt="Pasta" 
          className="absolute bottom-4 -right-12 w-[300px] sm:w-[350px] object-contain drop-shadow-2xl z-10 animate-float-dish-2"
        />
      </div>

      <input
        ref={focusKeeperRef}
        type="tel"
        inputMode="numeric"
        tabIndex={-1}
        aria-label="Keyboard focus keeper"
        readOnly
        className="absolute opacity-0 w-px h-px -z-10 pointer-events-none"
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-[120px] pb-10 relative z-10 overflow-y-auto w-full max-w-md mx-auto">
        <div className={`w-full flex flex-col my-auto ${step === 2 ? 'relative -top-8' : ''}`}>
          <div className="mb-8 text-center flex flex-col items-center">
            {step === 1 ? (
              <>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] shrink-0 rounded-[28px] overflow-hidden shadow-lg border border-gray-100">
                    <img src={logoUrl} alt="DoorDish" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-[110px] h-[110px] sm:w-[120px] sm:h-[120px] shrink-0">
                    <img src="/assets/images/MapRider.png" alt="Rider" className="w-full h-full object-contain drop-shadow-lg scale-110 origin-bottom" />
                  </div>
                </div>
                <div className="mt-5">
                  <h1 className="text-[28px] font-black text-[#1A1A1A] tracking-tight">
                    Welcome to <span className="text-[#FF5A1F]">DoorDish</span>
                  </h1>
                  <p className="text-[#666666] text-[15px] font-semibold mt-1">
                    Delicious food, delivered fast to your door.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 mt-8">
                  <div className="w-9 h-9 rounded-full bg-[#FFF0EB] flex items-center justify-center text-[#FF5A1F] shrink-0">
                    <Phone className="w-[18px] h-[18px] fill-[#FF5A1F]" />
                  </div>
                  <span className="text-[#4A4A4A] font-bold text-[14px]">
                    Login or signup with your phone number
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-8 flex flex-col items-center">
                <div className="w-[80px] h-[80px] rounded-[22px] overflow-hidden shadow-lg border border-gray-100 mb-6">
                  <img src={logoUrl} alt="DoorDish" className="w-full h-full object-cover" />
                </div>
                <div className="text-sm text-gray-500 font-bold flex items-center justify-center gap-1.5">
                  <span>Code sent to +91 {phoneNumber}</span>
                  <button
                    onClick={handleEditNumber}
                    className="p-1.5 ml-1 bg-[#FF5A1F] hover:bg-[#E64A0F] rounded-lg text-white shadow-md transition-all active:scale-95"
                  >
                    <Pencil className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative w-full">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form key="step-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleSendOTP} className="space-y-5">
                  <div className={`flex items-center h-[56px] rounded-full border-2 ${blockTimer > 0 ? 'border-red-500 bg-red-50' : 'border-[#FF5A1F] bg-white'} px-2 transition-colors`}>
                    <div className="flex items-center justify-center px-4 font-bold text-[#FF5A1F] text-lg border-r border-gray-200 h-[30px] shrink-0">+91</div>
                    <input
                      type="tel" required autoFocus onFocus={handleInputFocusScroll}
                      value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10} className="flex-1 h-full w-full bg-transparent border-none focus:outline-none focus:ring-0 px-4 text-[#1A1A1A] font-bold text-lg placeholder:font-semibold placeholder:text-[#999999]" placeholder="Mobile number"
                    />
                  </div>
                  <button type="submit" disabled={loading || phoneNumber.length < 10} className="w-full h-[56px] bg-[#FF5A1F] hover:bg-[#E64A0F] disabled:opacity-50 text-white rounded-full font-black text-[18px] shadow-lg shadow-[#FF5A1F]/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Log in <ArrowRight className="w-5 h-5" strokeWidth={2.5} /></>}
                  </button>
                </motion.form>
              ) : (
                <motion.form key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleVerifyOTP} className="space-y-6">
                  {otpError && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-red-600 font-bold text-center -mt-6 mb-4">{otpError}</motion.div>}
                  <div className="flex justify-between gap-3">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index} id={`otp-${index}`} type="tel" inputMode="numeric" required disabled={loading || blockTimer > 0} autoFocus={index === 0}
                        value={otp[index] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(-1);
                          if (index === 0 && val) setOtpError("");
                          if (!val) return;
                          const newOtp = otp.split(""); newOtp[index] = val; setOtp(newOtp.join("").slice(0, 4));
                          if (index < 3 && val) document.getElementById(`otp-${index + 1}`)?.focus();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            if (!otp[index] && index > 0) { document.getElementById(`otp-${index - 1}`)?.focus(); } else { const newOtp = otp.split(""); newOtp[index] = ""; setOtp(newOtp.join("")); }
                          }
                        }}
                        className={`w-[60px] h-[60px] text-center text-3xl font-black bg-white border-2 border-gray-200 shadow-sm rounded-[16px] outline-none transition-all duration-300 text-gray-900 focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10 hover:border-gray-300 ${blockTimer > 0 ? 'opacity-50 cursor-not-allowed border-red-400 bg-red-50 text-red-800' : ''}`}
                        placeholder="•"
                      />
                    ))}
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {blockTimer > 0 ? <span className="text-gray-400 uppercase tracking-wider font-extrabold">Resend SMS</span> : resendTimer > 0 ? <span className="text-gray-400 font-extrabold">Resend SMS in <span className="text-[#FF5A1F] font-black">{formatResendTimer(resendTimer)}</span></span> : <button type="button" onClick={handleResendOTP} className="text-[#FF5A1F] hover:text-[#E64A0F] hover:underline font-extrabold">Didn't receive SMS? Resend SMS</button>}
                    </div>
                  </div>
                  <button type="submit" disabled={loading || otp.length < 4 || blockTimer > 0} className="w-full h-[56px] bg-[#FF5A1F] hover:bg-[#E64A0F] disabled:opacity-50 text-white rounded-full font-black text-[18px] shadow-lg shadow-[#FF5A1F]/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Continue"}
                  </button>
                  {blockTimer > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center w-fit mx-auto px-6 py-2.5 bg-red-50 rounded-xl border border-red-100 mt-4">
                      <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Too many failed attempts</p>
                      <p className="text-sm font-bold text-red-600">Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, '0')}</p>
                    </motion.div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {step === 1 && blockTimer <= 0 && (
            <>
              <div className="my-5 flex items-center justify-center gap-4">
                <div className="h-[1px] w-12 bg-gray-200" />
                <span className="text-gray-500 font-semibold text-[15px]">or</span>
                <div className="h-[1px] w-12 bg-gray-200" />
              </div>
              <button 
                type="button" 
                onClick={() => { localStorage.setItem("user_authenticated", "false"); clearSessionData(); navigate('/food/user'); }}
                className="w-full h-[56px] bg-white border-2 border-[#FF5A1F] text-[#FF5A1F] rounded-full font-black text-[18px] flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                Skip for now
                <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </>
          )}

          {step === 1 && (
            <div className="mt-10 text-center relative z-20">
              <p className="text-[#666666] font-semibold text-[13px]">By continuing, you agree to our</p>
              <div className="flex items-center justify-center gap-2.5 mt-2 text-[12px] font-black text-[#FF5A1F] tracking-widest uppercase">
                <Link to="/user/profile/terms" state={{ from: "/user/auth/login" }} className="hover:underline">TERMS</Link>
                <span className="text-[#FF5A1F]">•</span>
                <Link to="/user/profile/privacy" state={{ from: "/user/auth/login" }} className="hover:underline">PRIVACY</Link>
                <span className="text-[#FF5A1F]">•</span>
                <Link to="/user/profile/support-info" state={{ from: "/user/auth/login" }} className="hover:underline">SUPPORT</Link>
              </div>
            </div>
          )}

        </div>
      </div>

      <Dialog open={showNameModal} onOpenChange={(open) => { if (!open) return; setShowNameModal(true); }}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-none p-0 overflow-hidden bg-white" showCloseButton={false}>
          <div className="bg-[#FF5A1F] p-8 text-center relative">
            <button onClick={handleEditNumber} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-all active:scale-95 z-20"><X className="w-5 h-5" /></button>
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30"><User className="w-10 h-10 text-white" /></motion.div>
            <DialogTitle className="text-2xl font-black text-white mb-2">Almost there!</DialogTitle>
            <DialogDescription className="text-white/90 font-semibold">We'd love to know your name to personalize your experience.</DialogDescription>
          </div>
          <form onSubmit={handleNameSubmit} className="p-8 pt-6 space-y-6">
            <div className="space-y-4">
              <Label htmlFor="name" className="text-sm font-bold text-gray-700 ml-1">Full Name</Label>
              <div className="relative group">
                <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z\s]/g, ""))} placeholder="Enter your name" className="pl-4 h-14 bg-gray-50 border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-[#FF5A1F] transition-all" autoFocus />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button type="submit" disabled={isUpdatingName} className="w-full h-14 bg-[#FF5A1F] hover:bg-[#E64A0F] text-white rounded-2xl font-black text-lg shadow-lg shadow-[#FF5A1F]/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                {isUpdatingName ? <Loader2 className="h-5 w-5 animate-spin" /> : "Complete Profile"}
              </Button>
              {!pendingVerify ? <button type="button" onClick={() => { setShowNameModal(false); navigate("/food/user", { replace: true }); }} className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors py-2">Skip for now</button> : <p className="text-xs font-semibold text-gray-400 text-center">Name is required to complete signup.</p>}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {showRestorePopup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center relative z-10" onClick={(e) => e.stopPropagation()}>
              <button onClick={handleEditNumber} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-all active:scale-95"><X className="w-5 h-5" /></button>
              <div className="w-20 h-20 bg-[#FFF0EB] rounded-full flex items-center justify-center mx-auto mb-6"><Phone className="h-10 w-10 text-[#FF5A1F]" /></div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">Account Found!</h3>
              <p className="text-gray-500 font-semibold mb-8">A deleted account for <span className="font-bold text-gray-900">+91 {phoneNumber}</span> was found. Do you want to restore your old data or start fresh?</p>
              <div className="space-y-4">
                <button onClick={async () => { await processVerify(phoneNumber, otp, "restore"); setShowRestorePopup(false); }} className="w-full h-14 bg-[#FF5A1F] hover:bg-[#E64A0F] text-white font-black rounded-2xl shadow-xl shadow-[#FF5A1F]/20 transition-all active:scale-[0.98]">Restore My Account</button>
                <button onClick={async () => { await processVerify(phoneNumber, otp, "new"); setShowRestorePopup(false); }} className="w-full h-14 border-2 border-gray-200 text-gray-700 font-black rounded-2xl hover:bg-gray-50 transition-all active:scale-[0.98]">Create New Account</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
