import { auth } from '../lib/firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth'

export interface UserSession {
  email: string
  name: string
  role: string
  loginTime: string
}

// Configured Administrator Credentials
export const VALID_CREDENTIALS = {
  email: 'vascotreadskgm@gmail.com',
  // Accepts both Vasco@2023 and isVasco@2023 to protect against typo
  passwords: ['Vasco@2023', 'isVasco@2023']
}

export const AUTH_STORAGE_KEY = 'vasco_auth_session'

/**
 * Retrieve active authenticated session from localStorage or sessionStorage
 */
export function getStoredSession(): UserSession | null {
  try {
    const local = localStorage.getItem(AUTH_STORAGE_KEY)
    if (local) return JSON.parse(local)
    const session = sessionStorage.getItem(AUTH_STORAGE_KEY)
    if (session) return JSON.parse(session)
  } catch (err) {
    console.error('Failed to read auth session:', err)
  }
  return null
}

/**
 * Check if user is currently authenticated
 */
export function checkIsAuthenticated(): boolean {
  return !!getStoredSession()
}

/**
 * Validate and authenticate admin user credentials
 */
export async function loginWithCredentials(
  emailInput: string,
  passwordInput: string,
  rememberMe: boolean = true
): Promise<{ success: boolean; error?: string; user?: UserSession }> {
  const email = emailInput.trim().toLowerCase()
  const password = passwordInput.trim()

  if (!email) {
    return { success: false, error: 'Please enter your email address.' }
  }
  if (!password) {
    return { success: false, error: 'Please enter your password.' }
  }

  // Check against authorized credentials
  const isEmailMatch = email === VALID_CREDENTIALS.email.toLowerCase()
  const isPasswordMatch = VALID_CREDENTIALS.passwords.includes(password)

  // Also attempt Firebase Auth if available/configured
  let firebaseAuthSuccess = false
  if (auth) {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      firebaseAuthSuccess = true
    } catch (fbErr: any) {
      // If user doesn't exist in Firebase Auth yet, try creating it if credentials match
      if (isEmailMatch && isPasswordMatch && (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/invalid-credential')) {
        try {
          await createUserWithEmailAndPassword(auth, email, password)
          firebaseAuthSuccess = true
        } catch {}
      }
    }
  }

  if (firebaseAuthSuccess || (isEmailMatch && isPasswordMatch)) {
    const session: UserSession = {
      email: VALID_CREDENTIALS.email,
      name: 'Vasco Admin',
      role: 'Administrator',
      loginTime: new Date().toISOString()
    }

    const serialized = JSON.stringify(session)
    if (rememberMe) {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized)
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, serialized)
    }

    return { success: true, user: session }
  }

  if (!isEmailMatch) {
    return {
      success: false,
      error: 'Invalid email address. Access is restricted to authorized Vasco Treads administrators.'
    }
  }

  return {
    success: false,
    error: 'Incorrect password. Please verify your password and try again.'
  }
}

/**
 * Sign out and clear stored session
 */
export function logout(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    if (auth && auth.currentUser) {
      firebaseSignOut(auth).catch(() => {})
    }
  } catch (err) {
    console.error('Error during logout:', err)
  }
}
