import { scheduleMatchesDate } from "@/lib/workout-defaults"
import {
  addExerciseToDay,
  getRosterIds,
  type WorkoutAppState,
} from "@/lib/workout-model"

export function applyWorkoutDefaults(
  state: WorkoutAppState,
  dateStr: string
): WorkoutAppState {
  let next = state
  let changed = false
  for (const def of state.workoutDefaults ?? []) {
    if (!scheduleMatchesDate(def.schedule, dateStr)) continue
    if (!next.exercises.some((e) => e.id === def.exerciseId)) continue
    const roster = getRosterIds(next, dateStr)
    if (roster.includes(def.exerciseId)) continue
    next = addExerciseToDay(next, def.exerciseId, dateStr)
    changed = true
  }
  return changed ? next : state
}
