import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  username: string
  github_connected: boolean
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (accessToken: string, refreshToken: string, user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'cloudforge-auth' }
  )
)

export function getAccessToken(): string | null {
  try {
    const stored = localStorage.getItem('cloudforge-auth')
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return parsed?.state?.accessToken ?? null
  } catch {
    return null
  }
}
