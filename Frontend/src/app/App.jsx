import React, { useState, useEffect } from 'react'
import AppRoutes from './routes'
import SplashScreen from '@/shared/components/SplashScreen.jsx'

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("[RootErrorBoundary] Caught uncaught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFF7F2] flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 rounded-full bg-red-100 text-[#FF5A1F] flex items-center justify-center mb-4 text-2xl font-bold shadow-sm">
            !
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 text-sm max-w-md mb-6">
            The application encountered a temporary error. Please tap below to reload.
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.clear()
              } catch (_) {}
              window.location.href = "/"
            }}
            className="px-6 py-2.5 bg-[#FF5A1F] text-white rounded-full font-bold text-sm shadow-md active:scale-95 transition-all"
          >
            Reload DoorDish
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    // sessionStorage persists across refreshes but clears when the tab/app is closed
    return !sessionStorage.getItem('doordish_session_splash_shown')
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleSplashFinish = () => {
    sessionStorage.setItem('doordish_session_splash_shown', 'true')
    setShowSplash(false)
  }

  // Normal Loading Spinner (if needed in future)
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-[#DC2626]/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-[#DC2626] rounded-full animate-spin" />
        </div>
        <h1 className="text-2xl font-black text-[#DC2626] italic uppercase tracking-tighter mt-6">DOORDISH</h1>
      </div>
    )
  }

  return (
    <RootErrorBoundary>
      {/* {showSplash && <SplashScreen onFinish={handleSplashFinish} />} */}
      <AppRoutes />
    </RootErrorBoundary>
  )
}

export default App
