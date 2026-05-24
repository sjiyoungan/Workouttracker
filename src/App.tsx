import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import ProtectedRoute from "@/components/protected-route"
import WorkoutTracker from "@/components/workout-tracker"
import { AuthProvider } from "@/contexts/auth-context"
import SignInPage from "@/pages/sign-in-page"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <WorkoutTracker />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
