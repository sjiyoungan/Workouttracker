import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"

type AuthFormProps = {
  redirectTo?: string
}

export default function AuthForm({ redirectTo = "/" }: AuthFormProps) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    setMessage(null)
    setBusy(true)
    const fn = mode === "sign-in" ? signIn : signUp
    const { error: err } = await fn(email.trim(), password)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    if (mode === "sign-up") {
      setMessage("Check your email to confirm your account, then sign in.")
      return
    }
    navigate(redirectTo, { replace: true })
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Input
        id="auth-email"
        type="email"
        autoComplete="email"
        placeholder="Email"
        aria-label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 text-base"
        required
      />
      <Input
        id="auth-password"
        type="password"
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        placeholder="Password"
        aria-label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11 text-base"
        required
        minLength={6}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="h-11 w-full text-base">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-sm"
        onClick={() => {
          setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"))
          setError(null)
          setMessage(null)
        }}
      >
        {mode === "sign-in"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </Button>
    </form>
  )
}
