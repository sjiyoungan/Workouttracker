import { Dumbbell } from "lucide-react"
import { Navigate } from "react-router-dom"

import AuthForm from "@/components/auth-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"

export default function SignInPage() {
  const { user, loading, configured } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Dumbbell className="size-6" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Workout Tracker</h1>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="text-lg">Welcome back</CardTitle>
          {!configured ? (
            <CardDescription>
              Supabase is not configured. Add VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY to your environment.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {configured ? (
            <AuthForm redirectTo="/" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Contact your administrator or check the project README for setup
              instructions.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
