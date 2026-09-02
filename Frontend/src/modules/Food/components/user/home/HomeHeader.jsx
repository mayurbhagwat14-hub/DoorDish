import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from "@food/api/config";
import { normalizeImageUrl } from "@food/utils/common";
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronDown, Search, Mic, User } from 'lucide-react';
import { useProfile } from "@food/context/ProfileContext";
import VoiceSearchOverlay from "@food/components/user/VoiceSearchOverlay";
import { useVoiceSearch } from "@food/hooks/useVoiceSearch";
import { isModuleAuthenticated } from "@food/utils/auth";
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings";

export default function HomeHeader({
  location,
  handleSearchFocus,
  placeholderIndex,
  placeholders,
  vegMode = false,
  handleVegModeChange,
  vegModeToggleRef,
  handleVoiceSearchClick,
  isTabActive = true,
  videoUrl = "",
  hideFoodImages = false,
  showBanner = false
}) {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { userProfile, vegModeOption } = useProfile();
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [companyName, setCompanyName] = useState(null);
  const voiceSearch = useVoiceSearch((transcript) => {
    navigate(`/food/user/search?q=${encodeURIComponent(transcript)}&mode=delivery`);
    setIsVoiceOverlayOpen(false);
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const cached = getCachedSettings()
        if (cached) {
          if (cached.logo?.url) setLogoUrl(normalizeImageUrl(cached.logo.url, API_BASE_URL))
          if (cached.companyName) setCompanyName(cached.companyName)
        } else {
          const settings = await loadBusinessSettings()
          if (settings) {
            if (settings.logo?.url) setLogoUrl(normalizeImageUrl(settings.logo.url, API_BASE_URL))
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
        if (cached.logo?.url) setLogoUrl(normalizeImageUrl(cached.logo.url, API_BASE_URL))
        if (cached.companyName) setCompanyName(cached.companyName)
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)
    return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
  }, []);
  return (
    <div className="relative pt-3 pb-3 px-4 bg-white space-y-3">
      {/* Top Bar: Brand Logo + Tagline + Right Action Buttons */}
      <div className="flex items-center justify-between gap-3">
        {/* Brand Logo & Name */}
        <Link to="/food/user" className="flex items-center gap-2.5 group">
          <div className="w-[46px] h-[46px] rounded-[14px] overflow-hidden flex-shrink-0">
            <img
              src={logoUrl || "/assets/images/doordish-logo.png"}
              alt={companyName || "Doordish"}
              className="w-full h-full object-cover"
              onError={(e) => {
                if (e.target.src !== "/assets/images/doordish-logo.png") {
                  e.target.src = "/assets/images/doordish-logo.png";
                }
              }}
            />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[20px] font-bold text-[#FF5A1F] tracking-tight leading-[1.1]">
              {companyName || "Doordish"}
            </span>
            <span className="text-[11px] font-medium text-[#4A4A4A] leading-tight mt-0.5">
              Delivering happiness
            </span>
          </div>
        </Link>

        {/* Right Actions: Search & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Search Button */}
          <button
            onClick={handleSearchFocus}
            className="w-10 h-10 rounded-full bg-[#FFF0EB] flex items-center justify-center text-[#FF5A1F] active:scale-95 transition-all"
            aria-label="Search"
          >
            <Search className="h-[20px] w-[20px] stroke-[2.5]" />
          </button>

          {/* Profile */}
          <Link
            to="/food/user/profile"
            state={{ from: routerLocation.pathname }}
            onClick={(e) => {
              if (!isModuleAuthenticated('user')) {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('show-login-required'));
              }
            }}
            className="w-10 h-10 rounded-full bg-[#FFF0EB] flex items-center justify-center text-[#FF5A1F] active:scale-95 transition-all"
          >
            <User className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {/* Location Selector Pill Bar */}
      <Link
        to="/food/user/address-selector"
        state={{ from: window.location.pathname }}
        className="flex items-center justify-between gap-2 px-3.5 py-2 bg-[#FFF0EB] border border-[#FF5A1F]/15 rounded-xl cursor-pointer active:scale-[0.99] transition-all no-underline"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="h-4 w-4 text-[#FF5A1F] shrink-0 fill-[#FF5A1F]/20" />
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs font-bold text-[#1A1A1A] truncate">
              {(() => {
                const area = location?.area || location?.subLocality || location?.mainTitle || location?.neighborhood;
                const city = (location?.city || "").toLowerCase();
                const state = (location?.state || "").toLowerCase();

                if (area && !/^-?\d+(\.\d+)?$/.test(area.trim())) {
                  const areaLower = area.toLowerCase();
                  if (areaLower !== city && areaLower !== state) {
                    return area;
                  }
                }

                if (location?.address && location.address !== "Select location") {
                  const parts = location.address.split(',').map(p => p.trim());
                  for (const part of parts) {
                    const partLower = part.toLowerCase();
                    if (partLower &&
                      partLower !== city &&
                      partLower !== state &&
                      !/^-?\d/.test(part) &&
                      part.length > 2) {
                      return part;
                    }
                  }
                }

                return location?.area || location?.city || "Home";
              })()}
            </span>
            <span className="text-xs text-[#6B6B6B] truncate">
              - {[location?.address || location?.state || location?.pincode].filter(Boolean).join(", ") || "Select address"}
            </span>
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-[#FF5A1F] shrink-0" />
      </Link>

      {/* Search Input Bar (Sticky / Main) */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex-1 relative bg-white rounded-2xl flex items-center px-4 py-2.5 shadow-xs border border-[#F0E8E4] cursor-pointer active:scale-[0.99] transition-all"
          onClick={handleSearchFocus}
        >
          <Search className="h-4.5 w-4.5 text-[#FF5A1F] mr-2.5 shrink-0" strokeWidth={2.5} />

          <div className="flex-1 overflow-hidden relative h-5">
            <AnimatePresence mode="wait">
              <motion.span
                key={placeholderIndex}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 text-xs sm:text-sm font-medium text-[#6B6B6B]/70 truncate flex items-center"
              >
                {placeholders?.[placeholderIndex] || 'Search for restaurants, cuisines...'}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-[#F0E8E4] ml-1">
            <Mic
              className="h-4 w-4 text-[#FF5A1F] hover:text-[#E64A0F]"
              onClick={(e) => {
                e.stopPropagation();
                voiceSearch.clearError();
                void voiceSearch.startListening();
                setIsVoiceOverlayOpen(true);
                handleVoiceSearchClick?.();
              }}
            />
          </div>
        </div>

        <VoiceSearchOverlay
          isOpen={isVoiceOverlayOpen}
          onClose={() => {
            voiceSearch.stopListening();
            setIsVoiceOverlayOpen(false);
          }}
          onSearchResult={(transcript) => {
            navigate(`/food/user/search?q=${encodeURIComponent(transcript)}&mode=delivery`);
          }}
          voiceSearch={voiceSearch}
          autoStart={false}
        />

        {/* Veg Mode Toggle */}
        <div
          ref={vegModeToggleRef}
          className="flex flex-col items-center gap-0.5 shrink-0"
        >
          <span className="text-[8px] font-bold text-[#6B6B6B] uppercase tracking-wider leading-none">
            {vegMode && vegModeOption === "pure-vegan" ? "Vegan" : "Veg"}
          </span>
          <div
            className={`w-9 h-4.5 rounded-full relative transition-colors duration-300 cursor-pointer border border-[#F0E8E4] shadow-xs ${
              vegMode ? 'bg-[#3DB54A]' : 'bg-gray-300'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleVegModeChange?.(!vegMode);
            }}
          >
            <motion.div
              animate={{ x: vegMode ? 18 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
