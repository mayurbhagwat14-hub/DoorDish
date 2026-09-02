import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings";

export default function Onboarding() {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = React.useState(null);
  const [companyName, setCompanyName] = React.useState(null);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const cached = getCachedSettings()
        if (cached) {
          if (cached.logo?.url) setLogoUrl(cached.logo.url)
          if (cached.companyName) setCompanyName(cached.companyName)
        } else {
          const settings = await loadBusinessSettings()
          if (settings) {
            if (settings.logo?.url) setLogoUrl(settings.logo.url)
            if (settings.companyName) setCompanyName(settings.companyName)
          }
        }
      } catch (error) {
      }
    }
    loadSettings()

    const handleSettingsUpdate = () => {
      const cached = getCachedSettings()
      if (cached) {
        if (cached.logo?.url) setLogoUrl(cached.logo.url)
        if (cached.companyName) setCompanyName(cached.companyName)
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)
    return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
  }, []);

  const handleGetStarted = () => {
    localStorage.setItem('has_seen_doordish_onboarding', 'true');
    navigate('/food/user');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FF5A1F] to-[#E64A0F] flex flex-col justify-between p-6 relative overflow-hidden text-white font-poppins">
      {/* Background Subtle Watermark Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:24px_24px] pointer-events-none" />

      {/* Top Bar / Status Area */}
      <div className="relative z-10 pt-4 flex justify-between items-center">
        <span className="text-xs font-bold tracking-widest uppercase opacity-80">{companyName || "Doordish"}</span>
        <button
          onClick={handleGetStarted}
          className="text-xs font-bold opacity-90 hover:opacity-100 underline decoration-white/50"
        >
          Skip
        </button>
      </div>

      {/* Center Brand Logo & Bag Illustration */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto space-y-6 text-center">
        {/* Doordish Logo Box */}
        <div className="w-28 h-28 sm:w-36 sm:h-36 bg-white rounded-[28px] p-3 shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
          <img
            src={logoUrl || "/assets/images/doordish-logo.png"}
            alt={`${companyName || 'Doordish'} Logo`}
            className="w-full h-full object-contain"
            onError={(e) => {
              if (e.target.src !== "/assets/images/doordish-logo.png") {
                e.target.src = "/assets/images/doordish-logo.png";
              }
            }}
          />
        </div>

        {/* Headlines */}
        <div className="space-y-2 max-w-xs">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Delicious<br />Delivered.
          </h1>
          <p className="text-sm text-white/90 font-medium">
            Your favorite food, at your doorstep.
          </p>
        </div>

        {/* Takeaway Bag Graphic */}
        <div className="w-44 sm:w-52 h-44 sm:h-52 relative mt-4">
          <img
            src="/assets/images/food_dish_2.png"
            alt="Food Delivery Bag"
            className="w-full h-full object-contain drop-shadow-2xl"
            onError={(e) => {
              e.target.src = "/assets/images/burger-real.png";
            }}
          />
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="relative z-10 pb-6 pt-4 max-w-sm mx-auto w-full">
        <button
          onClick={handleGetStarted}
          className="w-full py-4 px-6 bg-white text-[#FF5A1F] rounded-full text-base font-extrabold shadow-2xl hover:bg-[#FFF0EB] active:scale-[0.98] transition-all flex items-center justify-between group"
        >
          <span>Get Started</span>
          <div className="w-9 h-9 rounded-full bg-[#FF5A1F] text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </div>
        </button>
      </div>
    </div>
  );
}
