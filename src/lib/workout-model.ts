export const WORKOUT_STORAGE_KEY = "workout-tracker-v1"

export type LoggedSet = {
  reps: number
  weightLb: number
  loggedAt: string
}

export type DaySession = {
  date: string
  sets: LoggedSet[]
}

export type Exercise = {
  id: string
  name: string
  createdAt: string
}

export type WorkoutAppState = {
  profileName: string
  exercises: Exercise[]
  sessionsByExerciseId: Record<string, DaySession[]>
}

export function defaultWorkoutState(): WorkoutAppState {
  return {
    profileName: "You",
    exercises: [],
    sessionsByExerciseId: {},
  }
}

export function localDateString(d = new Date()): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, "0")
  const day = `${d.getDate()}`.padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function formatShortDate(ymd: string): string {
  const [y, mo, da] = ymd.split("-").map(Number)
  if (!y || !mo || !da) return ymd
  return new Date(y, mo - 1, da).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function sessionsForExercise(
  state: WorkoutAppState,
  exerciseId: string
): DaySession[] {
  return state.sessionsByExerciseId[exerciseId] ?? []
}

export function lastSessionBeforeToday(
  state: WorkoutAppState,
  exerciseId: string,
  todayStr: string
): DaySession | null {
  const list = sessionsForExercise(state, exerciseId)
  const prior = list
    .filter((s) => s.date < todayStr && s.sets.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  return prior[0] ?? null
}

export function todaySession(
  state: WorkoutAppState,
  exerciseId: string,
  todayStr: string
): DaySession | undefined {
  return sessionsForExercise(state, exerciseId).find((s) => s.date === todayStr)
}

export function summarizeSession(session: DaySession): string {
  const n = session.sets.length
  if (n === 0) return "—"
  const last = session.sets[n - 1]
  return `${n} set${n === 1 ? "" : "s"} · ${last.weightLb}lb × ${last.reps} rep`
}

export function loadWorkoutState(): WorkoutAppState {
  try {
    const raw = localStorage.getItem(WORKOUT_STORAGE_KEY)
    if (!raw) return defaultWorkoutState()
    const parsed = JSON.parse(raw) as Partial<WorkoutAppState>
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
  } catch {
    return defaultWorkoutState()
  }
}

export function saveWorkoutState(state: WorkoutAppState) {
  localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(state))
}
