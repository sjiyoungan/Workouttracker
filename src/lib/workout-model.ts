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
  youtubeUrl?: string
}

export type WorkoutSchedule =
  | { type: "every_day" }
  | { type: "weekdays"; days: number[] }
  | { type: "interval"; everyDays: number; startDate: string }

export type WorkoutDefault = {
  id: string
  exerciseId: string
  schedule: WorkoutSchedule
}

export type WorkoutAppState = {
  profileName: string
  exercises: Exercise[]
  sessionsByExerciseId: Record<string, DaySession[]>
  /** Exercise ids shown on a given day (YYYY-MM-DD). */
  rosterByDate?: Record<string, string[]>
  workoutDefaults?: WorkoutDefault[]
}

export function defaultWorkoutState(): WorkoutAppState {
  return {
    profileName: "You",
    exercises: [],
    sessionsByExerciseId: {},
    rosterByDate: {},
    workoutDefaults: [],
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

export function materializeRoster(
  state: WorkoutAppState,
  dateStr: string
): string[] {
  const roster = state.rosterByDate?.[dateStr]
  if (roster && roster.length > 0) {
    const valid = new Set(state.exercises.map((e) => e.id))
    return roster.filter((id) => valid.has(id))
  }
  const onDay = new Set<string>()
  for (const ex of state.exercises) {
    const session = sessionOnDate(state, ex.id, dateStr)
    if (session && session.sets.length > 0) onDay.add(ex.id)
  }
  if (onDay.size > 0) {
    return state.exercises.filter((e) => onDay.has(e.id)).map((e) => e.id)
  }
  return state.exercises.map((e) => e.id)
}

export function getRosterIds(
  state: WorkoutAppState,
  dateStr: string
): string[] {
  return materializeRoster(state, dateStr)
}

export function exercisesForDate(
  state: WorkoutAppState,
  dateStr: string
): Exercise[] {
  const ids = getRosterIds(state, dateStr)
  const byId = new Map(state.exercises.map((e) => [e.id, e]))
  return ids.map((id) => byId.get(id)).filter((e): e is Exercise => Boolean(e))
}

export function clearSessionOnDate(
  state: WorkoutAppState,
  exerciseId: string,
  dateStr: string
): WorkoutAppState {
  const list = (state.sessionsByExerciseId[exerciseId] ?? []).filter(
    (s) => s.date !== dateStr
  )
  return {
    ...state,
    sessionsByExerciseId: {
      ...state.sessionsByExerciseId,
      [exerciseId]: list,
    },
  }
}

export function removeExerciseFromDay(
  state: WorkoutAppState,
  exerciseId: string,
  dateStr: string
): WorkoutAppState {
  const roster = materializeRoster(state, dateStr).filter((id) => id !== exerciseId)
  let next = clearSessionOnDate(state, exerciseId, dateStr)
  next = {
    ...next,
    rosterByDate: { ...next.rosterByDate, [dateStr]: roster },
  }
  return next
}

export function addExerciseToDay(
  state: WorkoutAppState,
  exerciseId: string,
  dateStr: string
): WorkoutAppState {
  const roster = materializeRoster(state, dateStr)
  if (roster.includes(exerciseId)) return state
  return {
    ...state,
    rosterByDate: {
      ...state.rosterByDate,
      [dateStr]: [...roster, exerciseId],
    },
  }
}

export function reorderDayRoster(
  state: WorkoutAppState,
  dateStr: string,
  activeId: string,
  overId: string
): WorkoutAppState {
  const roster = materializeRoster(state, dateStr)
  const oldIndex = roster.indexOf(activeId)
  const newIndex = roster.indexOf(overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return state
  const next = [...roster]
  const [moved] = next.splice(oldIndex, 1)
  next.splice(newIndex, 0, moved)
  return {
    ...state,
    rosterByDate: { ...state.rosterByDate, [dateStr]: next },
  }
}

export function deleteExerciseFromLibrary(
  state: WorkoutAppState,
  exerciseId: string
): WorkoutAppState {
  const exercises = state.exercises.filter((e) => e.id !== exerciseId)
  const sessionsByExerciseId = { ...state.sessionsByExerciseId }
  delete sessionsByExerciseId[exerciseId]
  const rosterByDate: Record<string, string[]> = {}
  for (const [date, ids] of Object.entries(state.rosterByDate ?? {})) {
    rosterByDate[date] = ids.filter((id) => id !== exerciseId)
  }
  const workoutDefaults = (state.workoutDefaults ?? []).filter(
    (d) => d.exerciseId !== exerciseId
  )
  return {
    ...state,
    exercises,
    sessionsByExerciseId,
    rosterByDate,
    workoutDefaults,
  }
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
      rosterByDate:
        parsed.rosterByDate && typeof parsed.rosterByDate === "object"
          ? parsed.rosterByDate
          : {},
      workoutDefaults: Array.isArray(parsed.workoutDefaults)
        ? parsed.workoutDefaults
        : [],
    }
  } catch {
    return defaultWorkoutState()
  }
}

export function saveWorkoutState(state: WorkoutAppState) {
  localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(state))
}
