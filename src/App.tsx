import { AuthProvider } from "@/contexts/auth-context"
import WorkoutTracker from "@/components/workout-tracker"

export default function App() {
  return (
    <AuthProvider>
      <WorkoutTracker />
    </AuthProvider>
  )
}
