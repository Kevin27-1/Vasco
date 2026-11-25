import { useState } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  RefreshCw,
  ShieldCheck
} from 'lucide-react'
import { loginWithCredentials } from '../services/authService'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const result = await loginWithCredentials(email, password, rememberMe)
      if (result.success) {
        onLogin()
      } else {
        setErrorMessage(result.error || 'Invalid credentials. Please try again.')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setErrorMessage(err.message || 'Authentication error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-10 sm:px-6 lg:px-8 selection:bg-accent selection:text-white">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/25 mb-4">
            <div className="w-8 h-8 border-4 border-white rounded-full border-dashed animate-[spin_12s_linear_infinite]" />
          </div>
          <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border-2 border-background" title="System Online">
            <ShieldCheck className="w-3.5 h-3.5 text-black" />
          </span>
        </div>

        <h1 className="text-center text-3xl font-extrabold text-white tracking-tight">
          Vasco Treads
        </h1>
        <p className="mt-1 text-center text-xs text-text-muted">
          Tyre Workshop & Inventory Management System
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-card py-8 px-5 sm:px-10 shadow-2xl border border-border rounded-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Administrator Login</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Sign in with your Firebase administrator account
            </p>
          </div>

          {/* Error Alert Message */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-text-muted mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  className="block w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="Enter admin email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-text-muted">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  className="block w-full pl-10 pr-11 py-2.5 bg-background border border-border rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-muted hover:text-white transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background text-accent focus:ring-accent focus:ring-offset-background accent-[#e63946]"
                />
                <span className="text-xs text-text-muted hover:text-text-main transition-colors">
                  Remember me
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-hover active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-text-muted">
          Vasco Treads • Variyatyak, Kunnamangalam • Ph: 7907271835
        </p>
      </div>
    </div>
  )
}
