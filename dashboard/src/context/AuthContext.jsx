/**
 * NetShield AI — Authentication Context.
 *
 * Provides global state for user authentication, login/signup handlers,
 * session persistence via HttpOnly cookies and localStorage Bearer token,
 * profile editing, password management, and API Key rotation.
 *
 * @module context/AuthContext
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  loginUser,
  registerUser,
  logoutUser,
  fetchCurrentUser,
  updateUserProfile,
  changePassword as apiChangePassword,
  forgotPassword as apiForgotPassword,
  resetPassword as apiResetPassword,
  verifyEmail as apiVerifyEmail,
  resendVerification as apiResendVerification,
  regenerateApiKey,
} from '../api/client.js'

const AuthContext = createContext(null)

/** Normalize user object so both camelCase and snake_case properties are available. */
function normalizeUser(userData) {
  if (!userData) return null
  return {
    ...userData,
    apiKey: userData.api_key || userData.apiKey || '',
    api_key: userData.api_key || userData.apiKey || '',
    isVerified: !!userData.is_verified,
    is_verified: !!userData.is_verified,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('netshield_auth_token'))
  const [loading, setLoading] = useState(true)

  // Fetch / restore current user session
  const restoreSession = useCallback(async () => {
    try {
      const data = await fetchCurrentUser()
      if (data?.user) {
        setUser(normalizeUser(data.user))
      } else {
        setUser(null)
        setToken(null)
        localStorage.removeItem('netshield_auth_token')
      }
    } catch {
      // Unauthenticated or session expired
      setUser(null)
      setToken(null)
      localStorage.removeItem('netshield_auth_token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    restoreSession()

    // Handle token expiration event from axios interceptor
    const handleSessionExpired = () => {
      setUser(null)
      setToken(null)
      localStorage.removeItem('netshield_auth_token')
    }
    window.addEventListener('netshield_session_expired', handleSessionExpired)
    return () => window.removeEventListener('netshield_session_expired', handleSessionExpired)
  }, [restoreSession])

  // Login handler
  const login = async (identifier, password) => {
    const data = await loginUser(identifier, password)
    if (data.token) {
      localStorage.setItem('netshield_auth_token', data.token)
      setToken(data.token)
    }
    const normalized = normalizeUser(data.user)
    setUser(normalized)
    return { ...data, user: normalized }
  }

  // Register handler
  const register = async (username, email, password) => {
    const data = await registerUser(username, email, password)
    if (data.token) {
      localStorage.setItem('netshield_auth_token', data.token)
      setToken(data.token)
    }
    const normalized = normalizeUser(data.user)
    setUser(normalized)
    return { ...data, user: normalized }
  }

  // Logout handler
  const logout = async () => {
    try {
      await logoutUser()
    } finally {
      localStorage.removeItem('netshield_auth_token')
      setToken(null)
      setUser(null)
    }
  }

  // Update profile handler (username, email)
  const updateProfile = async ({ username, email }) => {
    const data = await updateUserProfile({ username, email })
    const normalized = normalizeUser(data.user)
    setUser(normalized)
    return normalized
  }

  // Change password handler
  const changePassword = async (currentPassword, newPassword) => {
    const res = await apiChangePassword(currentPassword, newPassword)
    return res
  }

  // Forgot password handler
  const forgotPassword = async (email) => {
    return await apiForgotPassword(email)
  }

  // Reset password handler
  const resetPassword = async (tokenVal, newPassword) => {
    return await apiResetPassword(tokenVal, newPassword)
  }

  // Verify email handler
  const verifyEmail = async (tokenVal) => {
    const res = await apiVerifyEmail(tokenVal)
    if (user) {
      setUser((prev) => (prev ? { ...prev, is_verified: true, isVerified: true } : null))
    }
    return res
  }

  // Resend verification email handler
  const resendVerification = async (email) => {
    return await apiResendVerification(email || user?.email)
  }

  // Regenerate API Key handler
  const rotateApiKey = async () => {
    const data = await regenerateApiKey()
    const newKey = data.api_key || data.apiKey
    setUser((prev) =>
      prev
        ? {
            ...prev,
            apiKey: newKey,
            api_key: newKey,
          }
        : null
    )
    return newKey
  }

  // Refresh user data manually
  const refreshUser = async () => {
    try {
      const data = await fetchCurrentUser()
      if (data?.user) {
        setUser(normalizeUser(data.user))
      }
    } catch {
      // Ignore
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        forgotPassword,
        resetPassword,
        verifyEmail,
        resendVerification,
        rotateApiKey,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
