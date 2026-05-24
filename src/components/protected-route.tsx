import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { useAuth } from "@/contexts/auth-context"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!configured) {
    return <Navigate to="/sign-in" replace />
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  return children
}
