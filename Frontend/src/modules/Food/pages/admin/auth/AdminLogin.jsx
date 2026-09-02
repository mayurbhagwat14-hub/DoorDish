import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "@food/api";
import { setAuthData } from "@food/utils/auth";
import { User, Lock, Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const submitting = useRef(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrors({});

    let newErrors = {};
    if (!username.trim()) newErrors.username = "Username is required";
    if (!password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields");
      return;
    }

    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);

    try {
      const response = await adminAPI.login(username.trim(), password);
      const data = response?.data?.data || response?.data || {};

      const accessToken = data.accessToken;
      const adminUser = data.user || data.admin;
      const refreshToken = data.refreshToken ?? null;

      if (!accessToken || !adminUser || !refreshToken) {
        throw new Error("Invalid response from server");
      }

      setAuthData("admin", accessToken, adminUser, refreshToken);
      toast.success("Welcome, Administrator");
      navigate("/admin/food", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Login failed. Check your credentials.";
      toast.error(msg);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F2F4F7] flex items-center justify-center p-3 sm:p-6 lg:p-8 font-poppins selection:bg-[#FA5300] selection:text-white">
      {/* Main Split Card Container */}
      <div className="w-full max-w-[1180px] bg-white rounded-2xl sm:rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-gray-100/80 overflow-hidden flex flex-col md:flex-row min-h-[620px] lg:min-h-[680px]">
        
        {/* LEFT SECTION - DoorDish Branding & Illustration (Orange Panel) */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-[#FA5300] via-[#FF5800] to-[#FA4C00] p-7 sm:p-10 lg:p-12 text-white relative flex flex-col justify-between overflow-hidden shrink-0">
          
          {/* Subtle Ambient Glowing Circles */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />

          {/* Grid Dot Pattern (Matching Reference Image) */}
          <div className="absolute top-20 right-10 grid grid-cols-6 gap-2.5 opacity-25 pointer-events-none hidden sm:grid">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
            ))}
          </div>

          {/* Top Branding Section */}
          <div className="relative z-10">
            {/* Logo */}
            <div className="inline-flex flex-col items-start select-none">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black tracking-tight text-[#111827]">Door</span>
                <span className="text-3xl font-black tracking-tight text-[#FA5300] relative">
                  D<span className="relative">i<span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#8CC63F]" /></span>sh
                </span>
              </div>
              <div className="w-12 h-1 bg-white rounded-full mt-0.5" />
            </div>

            {/* Main Headline */}
            <div className="mt-8 sm:mt-10">
              <h1 className="text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-white leading-tight tracking-tight">
                Manage. Monitor.<br />
                Grow Seamlessly.
              </h1>
              <p className="text-white/90 text-xs sm:text-sm font-normal mt-4 max-w-sm leading-relaxed">
                Welcome to DoorDish Admin Panel.<br className="hidden sm:block" />
                Login to access and manage your business efficiently.
              </p>
            </div>
          </div>

          {/* Bottom Illustration Section */}
          <div className="relative z-10 mt-6 sm:mt-8 flex justify-center items-center">
            <img
              src="/assets/images/admin_login_illustration.png"
              alt="DoorDish Admin Dashboard & Takeaway Illustration"
              className="w-full max-w-[460px] h-auto object-contain transform hover:scale-[1.02] transition-transform duration-500 drop-shadow-2xl"
            />
          </div>
        </div>

        {/* RIGHT SECTION - Admin Login Form */}
        <div className="w-full md:w-1/2 bg-white p-7 sm:p-10 lg:p-14 flex flex-col justify-between items-center relative z-10 shrink-0">
          
          <div className="w-full max-w-[380px] my-auto flex flex-col items-center">
            {/* Security Shield Icon Badge */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FFF3EC] flex items-center justify-center mb-5 shadow-sm border border-[#FFE4D4]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#FA5300] to-[#FF6B1A] flex items-center justify-center text-white shadow-md shadow-[#FA5300]/30">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.4 0 2.5 1.1 2.5 2.5 0 .9-.5 1.7-1.2 2.1v2.4c0 .4-.3.7-.7.7h-1.2c-.4 0-.7-.3-.7-.7v-2.4c-.7-.4-1.2-1.2-1.2-2.1C9.5 8.1 10.6 7 12 7z"/>
                </svg>
              </div>
            </div>

            {/* Header Text */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight text-center">
              Welcome Back!
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm font-normal mt-1.5 text-center mb-8">
              Sign in to continue to your admin panel
            </p>

            {/* Form */}
            <form onSubmit={handleLogin} className="w-full space-y-5">
              {/* Username Input */}
              <div className="flex flex-col">
                <label className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                  Username
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className={`w-full h-12 pl-11 pr-4 rounded-xl border ${
                      errors.username ? "border-red-500 bg-red-50/20" : "border-gray-200 bg-gray-50/50"
                    } text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:border-[#FA5300] focus:ring-4 focus:ring-[#FA5300]/10 transition-all duration-200 outline-none`}
                  />
                </div>
                {errors.username && (
                  <span className="text-red-500 text-xs mt-1 pl-1 font-medium">{errors.username}</span>
                )}
              </div>

              {/* Password Input */}
              <div className="flex flex-col">
                <label className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`w-full h-12 pl-11 pr-11 rounded-xl border ${
                      errors.password ? "border-red-500 bg-red-50/20" : "border-gray-200 bg-gray-50/50"
                    } text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:border-[#FA5300] focus:ring-4 focus:ring-[#FA5300]/10 transition-all duration-200 outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-red-500 text-xs mt-1 pl-1 font-medium">{errors.password}</span>
                )}
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#FA5300] focus:ring-[#FA5300]/30 border-gray-300 accent-[#FA5300] cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Remember me</span>
                </label>
                
                <button
                  type="button"
                  onClick={() => navigate("/admin/forgot-password")}
                  className="text-xs sm:text-sm font-semibold text-[#FA5300] hover:text-[#D84500] hover:underline transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Submit LOGIN Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-[#FA5300] to-[#FF5E00] hover:from-[#E64B00] hover:to-[#FA5300] text-white font-bold text-sm sm:text-base tracking-wide shadow-lg shadow-[#FA5300]/25 hover:shadow-xl hover:shadow-[#FA5300]/35 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <>
                    <span>LOGIN</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer copyright */}
          <div className="mt-8 text-center text-xs text-gray-400 font-normal">
            © 2026 <span className="text-[#FA5300] font-semibold">DoorDish</span>. All rights reserved.
          </div>
        </div>

      </div>
    </div>
  );
}





