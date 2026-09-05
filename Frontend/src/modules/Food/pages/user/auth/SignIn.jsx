import { useState, useEffect, useRef } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { AlertCircle, Loader2, ArrowRight, Phone } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { authAPI } from "@food/api"
import { prefetchModuleFcmToken } from "@food/utils/firebaseMessaging"

const debugError = (...args) => {}

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    void prefetchModuleFcmToken("user")
  }, [])

  const defaultTestPhone =
    import.meta.env.VITE_USE_DEFAULT_TEST_PHONE === "true"
      ? String(import.meta.env.VITE_DEFAULT_TEST_PHONE || "").replace(/\D/g, "").slice(0, 10)
      : ""

  const [formData, setFormData] = useState({
    phone: defaultTestPhone,
    countryCode: "+91",
  })

  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) return
    try {
      const data = JSON.parse(stored)
      const fullPhone = String(data.phone || "").trim()
      const phoneDigits = fullPhone.replace(/^\+91\s*/, "").replace(/\D/g, "").slice(0, 10)
      setFormData((prev) => ({
        ...prev,
        phone: phoneDigits || prev.phone,
      }))
    } catch (err) {
      debugError("Error parsing stored auth data:", err)
    }
  }, [])

  const validatePhone = (phone) => {
    if (!phone.trim()) return "Phone number is required"
    const cleanPhone = phone.replace(/\D/g, "")
    if (!/^\d{10}$/.test(cleanPhone)) return "Phone number must be exactly 10 digits"
    return ""
  }

  const handleChange = (e) => {
    const { name } = e.target
    let { value } = e.target
    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 10)
      setError(validatePhone(value))
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const phoneError = validatePhone(formData.phone)
    setError(phoneError)
    if (phoneError) return
    if (submittingRef.current) return
    submittingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const countryCode = formData.countryCode?.trim() || "+91"
      const phoneDigits = String(formData.phone ?? "").replace(/\D/g, "").slice(0, 10)
      if (phoneDigits.length !== 10) {
        setError("Phone number must be exactly 10 digits")
        setIsLoading(false)
        submittingRef.current = false
        return
      }
      const fullPhone = `${countryCode} ${phoneDigits}`
      await authAPI.sendOTP(fullPhone, "login", null)

      const ref = String(searchParams.get("ref") || "").trim()
      const authData = {
        method: "phone",
        phone: fullPhone,
        email: null,
        name: null,
        referralCode: ref || null,
        isSignUp: false,
        module: "user",
      }

      sessionStorage.setItem("userAuthData", JSON.stringify(authData))
      navigate("/food/user/auth/otp")
    } catch (apiError) {
      const message =
        apiError?.response?.data?.message ||
        apiError?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-white relative overflow-hidden flex flex-col justify-between max-w-md mx-auto shadow-2xl border-x border-gray-100">
      
      {/* Top Left Orange Blob & Burger */}
      <div className="absolute top-0 left-0 w-full h-[400px] pointer-events-none z-0">
        <svg viewBox="0 0 400 400" className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none">
          <path d="M0,0 L400,0 C250,80 120,250 0,380 Z" fill="#FF5A1F" />
        </svg>
        <img 
          src="/assets/images/burger-real.png" 
          alt="Burger" 
          className="absolute top-4 -left-4 w-[200px] h-[150px] object-contain drop-shadow-xl z-10 transform -rotate-6"
        />
        {/* Subtle background line art placeholders */}
        <div className="absolute top-32 left-8 w-8 h-8 border-2 border-white/20 rounded-lg opacity-50 rotate-12"></div>
        <div className="absolute top-12 left-48 w-6 h-6 border-2 border-white/20 rounded-full opacity-50 -rotate-12"></div>
        <div className="absolute top-52 left-32 w-10 h-6 border-2 border-white/20 rounded-xl opacity-50 rotate-45"></div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col px-6 pt-8 sm:pt-12 pb-6">
        
        {/* App Logo & Scooter */}
        <div className="flex items-center justify-center gap-4">
          <div className="w-[110px] h-[110px] bg-[#FF5A1F] rounded-[30px] flex flex-col items-center justify-center font-black text-4xl leading-[1] tracking-tighter shadow-lg shrink-0">
            <span className="text-black">Door</span>
            <span className="text-white">Dish</span>
          </div>
          <div className="w-[140px] h-[110px] shrink-0 flex items-center justify-center">
            <img 
              src="/assets/images/rider_horizontal.png" 
              alt="Delivery Rider" 
              className="w-full h-full object-contain drop-shadow-lg transform hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>

        {/* Welcome Text */}
        <div className="text-center mt-6">
          <h1 className="text-[28px] font-black text-[#1A1A1A] tracking-tight">
            Welcome to <span className="text-[#FF5A1F]">DoorDish</span>
          </h1>
          <p className="text-[#666666] text-[15px] font-semibold mt-1">
            Delicious food, delivered fast to your door.
          </p>
        </div>

        {/* Phone instructions */}
        <div className="flex items-center justify-center gap-3 mt-8 mb-5">
          <div className="w-9 h-9 rounded-full bg-[#FFF0EB] flex items-center justify-center text-[#FF5A1F] shrink-0">
            <Phone className="w-[18px] h-[18px] fill-[#FF5A1F]" />
          </div>
          <span className="text-[#4A4A4A] font-bold text-[14px]">
            Login or signup with your phone number
          </span>
        </div>

        {/* Form */}
        <form id="mobile-signin-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <div className={`flex items-center h-[60px] rounded-full border-2 ${error ? 'border-red-500 bg-red-50' : 'border-[#FF5A1F] bg-white'} px-2 transition-colors`}>
              <div className="flex items-center justify-center px-4 font-bold text-[#FF5A1F] text-lg border-r border-gray-200 h-[30px] shrink-0">
                +91
              </div>
              <input 
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="Mobile number"
                value={formData.phone}
                onChange={handleChange}
                className="flex-1 h-full w-full bg-transparent border-none focus:outline-none focus:ring-0 px-4 text-[#1A1A1A] font-bold text-lg placeholder:font-semibold placeholder:text-[#999999]"
              />
            </div>
            {error && (
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-500 animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-[60px] bg-[#FF5A1F] text-white rounded-full font-black text-[19px] flex items-center justify-center gap-2 shadow-lg shadow-[#FF5A1F]/30 active:scale-95 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                Log in
                <ArrowRight className="w-[22px] h-[22px]" strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center justify-center gap-4">
          <div className="h-[1px] w-12 bg-gray-200" />
          <span className="text-gray-500 font-semibold text-[15px]">or</span>
          <div className="h-[1px] w-12 bg-gray-200" />
        </div>

        {/* Skip button */}
        <button 
          type="button" 
          onClick={() => navigate('/food/user')} 
          className="w-full h-[60px] bg-white border-2 border-[#FF5A1F] text-[#FF5A1F] rounded-full font-black text-[19px] flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          Skip for now
          <ArrowRight className="w-[22px] h-[22px]" strokeWidth={2.5} />
        </button>

      </div>

      {/* Footer Text */}
      <div className="relative z-10 text-center mb-8 pb-10">
        <p className="text-[#666666] font-semibold text-[13px]">
          By continuing, you agree to our
        </p>
        <div className="flex items-center justify-center gap-2.5 mt-2 text-[12px] font-black text-[#FF5A1F] tracking-widest">
          <Link to="/user/profile/terms" className="hover:underline">TERMS</Link>
          <span className="text-[#FF5A1F]">•</span>
          <Link to="/user/profile/privacy" className="hover:underline">PRIVACY</Link>
          <span className="text-[#FF5A1F]">•</span>
          <Link to="/user/profile/support" className="hover:underline">SUPPORT</Link>
        </div>
      </div>

      {/* Bottom Right Orange Blob & Pasta */}
      <div className="absolute bottom-0 right-0 w-full h-[350px] pointer-events-none z-0">
        <svg viewBox="0 0 400 400" className="absolute bottom-0 right-0 w-full h-full" preserveAspectRatio="none">
          <path d="M400,400 L0,400 C150,300 300,150 400,0 Z" fill="#FF5A1F" />
        </svg>
        <img 
          src="/assets/images/dish-img.png" 
          alt="Pasta" 
          className="absolute bottom-4 -right-12 w-[350px] h-[250px] object-contain drop-shadow-2xl z-10"
        />
        {/* Subtle background line art placeholders */}
        <div className="absolute bottom-40 right-12 w-8 h-8 border-2 border-white/20 rounded-md opacity-50 -rotate-12"></div>
        <div className="absolute bottom-20 right-48 w-10 h-10 border-2 border-white/20 rounded-full opacity-50 rotate-45"></div>
      </div>

    </AnimatedPage>
  )
}

