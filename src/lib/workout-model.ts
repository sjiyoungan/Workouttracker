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

/** Latest session strictly before `beforeDateStr` (YYYY-MM-DD) with at least one set. */
export function lastSessionBeforeDate(
  state: WorkoutAppState,
  exerciseId: string,
  beforeDateStr: string
): DaySession | null {
  const list = sessionsForExercise(state, exerciseId)
  const prior = list
    .filter((s) => s.date < beforeDateStr && s.sets.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  return prior[0] ?? null
}

export function sessionOnDate(
  state: WorkoutAppState,
  exerciseId: string,
  dateStr: string
): DaySession | undefined {
  return sessionsForExercise(state, exerciseId).find((s) => s.date === dateStr)
}

/** Unique calendar dates (YYYY-MM-DD) that have at least one logged set for any exercise. */
export function allDatesWithLogs(state: WorkoutAppState): string[] {
  const dates = new Set<string>()
  for (const ex of state.exercises) {
    for (const s of sessionsForExercise(state, ex.id)) {
      if (s.sets.length > 0) dates.add(s.date)
    }
  }
  return Array.from(dates).sort()
}

export function dateFromYmd(ymd: string): Date {
  const [y, mo, da] = ymd.split("-").map(Number)
  return new Date(y, mo - 1, da)
}

/** Header label: "Today" or "Jun 3" / "Jun 3, 2025" when not current calendar year. */
export function formatLogViewTitle(viewYmd: string): string {
  const todayYmd = localDateString()
  if (viewYmd === todayYmd) return "Today"
  const d = dateFromYmd(viewYmd)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
  })
}

export function summarizeSession(session: DaySession): string {
  const n = session.sets.length
  if (n === 0) return "—"
  const last = session.sets[n - 1]
  return `${n} set${n === 1 ? "" : "s"} ${last.reps} reps ${last.weightLb} lbs`
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
