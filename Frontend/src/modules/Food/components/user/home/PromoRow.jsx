import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function PromoRow({ navigate }) {
  return (
    <div className="px-4 py-3 bg-[#FFF7F2]">
      <div 
        onClick={() => navigate?.('/food/user/offers')}
        className="relative overflow-hidden rounded-[20px] bg-[#FFF0EB] border border-[#FF5A1F]/15 p-4 flex items-center justify-between cursor-pointer group shadow-xs hover:shadow-md transition-all active:scale-[0.99]"
      >
        {/* Left Content */}
        <div className="flex flex-col space-y-1 relative z-10 max-w-[55%]">
          <span className="text-xs font-black text-[#FF5A1F] uppercase tracking-wider">
            FREE DELIVERY
          </span>
          <h4 className="text-sm font-extrabold text-[#1A1A1A] leading-tight">
            On orders above ₹199
          </h4>
          <span className="text-[10px] font-medium text-[#6B6B6B]">
            Limited time offer!
          </span>
        </div>

        {/* Scooter Illustration */}
        <div className="relative z-10 w-24 h-16 shrink-0 flex items-center justify-center">
          <img
            src="/assets/images/delivery_scooter_1788261254985.png"
            alt="Free Delivery"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
            onError={(e) => {
              e.target.src = "/assets/images/MapRider.png";
            }}
          />
        </div>

        {/* Right CTA Button */}
        <div className="relative z-10 shrink-0">
          <button
            type="button"
            className="px-3.5 py-2 bg-[#FF5A1F] text-white rounded-full text-xs font-bold shadow-xs group-hover:bg-[#E64A0F] transition-all flex items-center gap-1"
          >
            <span>Order Now</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
