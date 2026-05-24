import { supabase } from "@/lib/supabase"
import {
  defaultWorkoutState,
  type WorkoutAppState,
} from "@/lib/workout-model"

function normalizeWorkoutData(raw: unknown): WorkoutAppState {
  const parsed = (raw ?? {}) as Partial<WorkoutAppState>
  return {
    ...defaultWorkoutState(),
    ...parsed,
    exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
    sessionsByExerciseId:
      parsed.sessionsByExerciseId &&
      typeof parsed.sessionsByExerciseId === "object"
        ? parsed.sessionsByExerciseId
        : {},
  }
}

export async function fetchWorkoutState(
  userId: string
): Promise<WorkoutAppState | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from("user_workouts")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  if (!data?.data) return null
  return normalizeWorkoutData(data.data)
}

export async function upsertWorkoutState(
  userId: string,
  state: WorkoutAppState
): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from("user_workouts").upsert(
    {
      user_id: userId,
      data: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (error) throw error
}
