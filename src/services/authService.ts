import { auth } from '../lib/firebase'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth'

const LEGACY_AUTH_STORAGE_KEY = 'vasco_auth_session'

/**
 * Subscribe to Firebase Authentication state changes.
 * Returns an unsubscribe function.
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    callback(user)
  })
}

/**
 * Authenticate administrator using Firebase Email/Password Auth.
 */
export async function loginWithCredentials(
  emailInput: string,
  passwordInput: string,
  rememberMe: boolean = true
): Promise<{ success: boolean; error?: string; user?: User }> {
  const email = emailInput.trim()
  const password = passwordInput

  if (!email) {
    return { success: false, error: 'Please enter your email address.' }
  }
  if (!password) {
    return { success: false, error: 'Please enter your password.' }
  }

  try {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    )
    const credential = await signInWithEmailAndPassword(auth, email, password)
    return { success: true, user: credential.user }
  } catch (err: any) {
    const code = err?.code || ''
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return {
        success: false,
        error: 'Invalid email or password. Please verify your credentials and try again.'
      }
    }
    if (code === 'auth/invalid-email') {
      return {
        success: false,
        error: 'Please enter a valid email address.'
      }
    }
    if (code === 'auth/too-many-requests') {
      return {
        success: false,
        error: 'Too many failed login attempts. Please wait a few minutes and try again.'
      }
    }
    return {
      success: false,
      error: err?.message || 'Authentication failed. Please try again.'
    }
  }
}

/**
 * Sign out of Firebase Auth and clean up any legacy local storage session keys.
 */
export async function logout(): Promise<void> {
  try {
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
    sessionStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
    await firebaseSignOut(auth)
  } catch (err) {
    console.error('Error during logout:', err)
  }
}
