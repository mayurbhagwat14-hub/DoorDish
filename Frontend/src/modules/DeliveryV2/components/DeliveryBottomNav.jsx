import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Navigation2,
  Package,
  Wallet,
  History,
  User as UserIcon,
} from 'lucide-react';
import { useDeliveryStore, dedupeOrdersByIdentity } from '@/modules/DeliveryV2/store/useDeliveryStore';

export default function DeliveryBottomNav({ currentTab }) {
  const navigate = useNavigate();
  const location = useLocation();

  const newOrders = useDeliveryStore((state) => state.newOrders);
  const newOrdersCount = useMemo(() => dedupeOrdersByIdentity(newOrders || []).length, [newOrders]);

  // Determine active tab either by prop or location pathname
  const activeTab = useMemo(() => {
    if (currentTab) return currentTab;
    const path = location.pathname.toLowerCase();
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/feed') || path.includes('/map')) return 'feed';
    if (path.includes('/pocket')) return 'pocket';
    if (path.includes('/history')) return 'history';
    if (path.includes('/profile')) return 'profile';
    return 'home';
  }, [currentTab, location.pathname]);

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      path: '/food/delivery/home',
    },
    {
      id: 'feed',
      label: 'Live Map',
      icon: Navigation2,
      path: '/food/delivery/feed',
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: Package,
      path: '/food/delivery/orders',
      badge: newOrdersCount,
    },
    {
      id: 'pocket',
      label: 'Pocket',
      icon: Wallet,
      path: '/food/delivery/pocket',
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/food/delivery/history',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: UserIcon,
      path: '/food/delivery/profile',
    },
  ];

  return (
    <nav
      aria-label="Delivery Partner Navigation"
      className="fixed bottom-0 inset-x-0 z-[400] bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] select-none safe-bottom"
    >
      <div className="grid grid-cols-6 items-center px-1 py-1.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl transition-all duration-200 active:scale-95 relative group"
            >
              <div
                className={`w-9 h-8 rounded-xl flex items-center justify-center transition-all duration-200 relative ${
                  isActive
                    ? 'bg-orange-500/10 text-orange-600 scale-105 shadow-xs'
                    : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'
                  } ${item.id === 'feed' ? 'rotate-45' : ''}`}
                />

                {/* Badge for Orders */}
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-orange-600 flex items-center justify-center text-[9px] font-black text-white border-2 border-white shadow-sm animate-pulse">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[9.5px] tracking-tight leading-none transition-colors ${
                  isActive ? 'font-black text-orange-600' : 'font-semibold text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

