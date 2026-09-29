import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import { ApiError, getToken, setToken, type AuthUser } from '../lib/api'

type AuthValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { name: string; email: string; password: string; password_confirmation: string }) => Promise<void>
  completeGoogleLogin: (code: string) => Promise<void>
  updateProfile: (data: { name: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  useEffect(() => {
    if (!getToken()) return
    api.me()
      .then((res) => setUser(res.user))
      // Only a real 401 means the session is gone. A cancelled or offline
      // request must not sign the user out.
      .catch((err) => { if (err instanceof ApiError && err.status === 401) setToken(null) })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Server menolak token di tengah sesi (kedaluwarsa atau dicabut). Tanpa ini
   * setiap halaman hanya menampilkan "Gagal memuat" sampai pengguna reload
   * manual, karena token basi tetap tersimpan di localStorage.
   */
  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setToken(null)
      setUser(null)
    })

    return () => api.setUnauthorizedHandler(null)
  }, [])

  async function login(email: string, password: string) {
    const res = await api.login({ email, password })
    setToken(res.token)
    setUser(res.user)
  }

  async function register(data: { name: string; email: string; password: string; password_confirmation: string }) {
    const res = await api.register(data)
    setToken(res.token)
    setUser(res.user)
  }

  async function completeGoogleLogin(code: string) {
    const res = await api.googleExchange(code)
    setToken(res.token)
    setUser(res.user)
  }

  async function updateProfile(data: { name: string }) {
    const res = await api.updateProfile(data)
    setUser(res.user)
  }

  async function logout() {
    await api.logout().catch(() => {})
    setToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, register, completeGoogleLogin, updateProfile, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}