import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, UserRound } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import type { Exercise, LoggedSet, WorkoutAppState } from "@/lib/workout-model"
import {
  allDatesWithLogs,
  dateFromYmd,
  formatLogViewTitle,
  lastSessionBeforeDate,
  loadWorkoutState,
  localDateString,
  saveWorkoutState,
  sessionOnDate,
  summarizeSession,
} from "@/lib/workout-model"

type Draft = { reps: string; lbs: string }

export default function WorkoutTracker() {
  const calendarToday = localDateString()
  const [state, setState] = useState<WorkoutAppState>(loadWorkoutState)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts

  const [viewDate, setViewDate] = useState(() => localDateString())
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [profileOpen, setProfileOpen] = useState(false)
  const [profileDraft, setProfileDraft] = useState(state.profileName)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addError, setAddError] = useState("")

  const loggedDatesSet = useMemo(() => new Set(allDatesWithLogs(state)), [state])
  const loggedDatesSorted = useMemo(() => allDatesWithLogs(state), [state])

  const prevLoggedDate = useMemo(() => {
    const before = loggedDatesSorted.filter((d) => d < viewDate)
    return before.length ? before[before.length - 1]! : null
  }, [loggedDatesSorted, viewDate])

  const nextLoggedDate = useMemo(() => {
    const after = loggedDatesSorted.filter((d) => d > viewDate)
    return after.length ? after[0]! : null
  }, [loggedDatesSorted, viewDate])

  useEffect(() => {
    saveWorkoutState(state)
  }, [state])

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const ex of state.exercises) {
        if (!(ex.id in next)) next[ex.id] = { reps: "", lbs: "" }
      }
      return next
    })
  }, [state.exercises])

  const openProfile = useCallback(() => {
    setProfileDraft(state.profileName)
    setProfileOpen(true)
  }, [state.profileName])

  const saveProfile = useCallback(() => {
    const name = profileDraft.trim() || "You"
    setState((s) => ({ ...s, profileName: name }))
    setProfileOpen(false)
  }, [profileDraft])

  const tryAddExercise = useCallback(() => {
    const trimmed = addName.trim()
    if (!trimmed) {
      setAddError("Enter a name.")
      return
    }
    const taken = state.exercises.some(
      (e) => e.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (taken) {
      setAddError("That exercise already exists.")
      return
    }
    const id = crypto.randomUUID()
    const ex: Exercise = {
      id,
      name: trimmed,
      createdAt: new Date().toISOString(),
    }
    setState((s) => ({
      ...s,
      exercises: [...s.exercises, ex],
      sessionsByExerciseId: { ...s.sessionsByExerciseId, [id]: [] },
    }))
    setDrafts((d) => ({ ...d, [id]: { reps: "", lbs: "" } }))
    setAddName("")
    setAddError("")
    setAddOpen(false)
  }, [addName, state.exercises])

  const commitDraftIfValid = useCallback(
    (exerciseId: string) => {
      const logDate = localDateString()
      if (viewDate !== logDate) return

      const d = draftsRef.current[exerciseId] ?? { reps: "", lbs: "" }
      const reps = Number.parseInt(d.reps, 10)
      const weightLb = Number.parseFloat(d.lbs)
      if (
        !Number.isFinite(reps) ||
        reps <= 0 ||
        !Number.isFinite(weightLb) ||
        weightLb <= 0
      ) {
        return
      }

      const newSet: LoggedSet = {
        reps,
        weightLb,
        loggedAt: new Date().toISOString(),
      }

      setState((s) => {
        const prevList = [...(s.sessionsByExerciseId[exerciseId] ?? [])]
        const idx = prevList.findIndex((x) => x.date === logDate)
        let nextList: typeof prevList
        if (idx === -1) {
          nextList = [...prevList, { date: logDate, sets: [newSet] }]
        } else {
          const cur = prevList[idx]
          nextList = prevList.map((session, i) =>
            i === idx
              ? { ...cur, sets: [...cur.sets, newSet] }
              : session
          )
        }
        return {
          ...s,
          sessionsByExerciseId: {
            ...s.sessionsByExerciseId,
            [exerciseId]: nextList,
          },
        }
      })

      setDrafts((prev) => ({
        ...prev,
        [exerciseId]: { reps: "", lbs: "" },
      }))
    },
    [viewDate]
  )

  const updateSetOnDate = useCallback(
    (
      exerciseId: string,
      setIndex: number,
      reps: number,
      weightLb: number,
      dateStr: string
    ) => {
      setState((s) => {
        const sessions = [...(s.sessionsByExerciseId[exerciseId] ?? [])]
        const idx = sessions.findIndex((x) => x.date === dateStr)
        if (idx === -1) return s
        const session = sessions[idx]
        const sets = session.sets.map((st, i) =>
          i === setIndex ? { ...st, reps, weightLb } : st
        )
        const nextSessions = [...sessions]
        nextSessions[idx] = { ...session, sets }
        return {
          ...s,
          sessionsByExerciseId: {
            ...s.sessionsByExerciseId,
            [exerciseId]: nextSessions,
          },
        }
      })
    },
    []
  )

  const setDraft = (exerciseId: string, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [exerciseId]: { ...(prev[exerciseId] ?? { reps: "", lbs: "" }), [field]: value },
    }))
  }

  const goToday = useCallback(() => {
    setViewDate(localDateString())
    setCalendarOpen(false)
  }, [])

  const calendarDisabled = (date: Date) => {
    const k = localDateString(date)
    if (k > calendarToday) return true
    return !loggedDatesSet.has(k)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto grid w-full max-w-lg grid-cols-3 items-center gap-1 px-2 py-3">
          <div className="flex min-w-0 justify-start">
            <Button
              type="button"
              variant="ghost"
              className="h-11 min-w-0 max-w-full touch-manipulation justify-start gap-2 px-1"
              onClick={openProfile}
            >
              <UserRound className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-left text-sm font-semibold">
                {state.profileName}
              </span>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 touch-manipulation"
              disabled={!prevLoggedDate}
              aria-label="Previous logged day"
              onClick={() => prevLoggedDate && setViewDate(prevLoggedDate)}
            >
              <ChevronLeft className="size-5" />
            </Button>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 min-w-[4.5rem] max-w-[9rem] shrink touch-manipulation truncate px-2 text-sm font-semibold"
                >
                  {formatLogViewTitle(viewDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <div className="flex items-center justify-end border-b px-2 py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={goToday}
                  >
                    Today
                  </Button>
                </div>
                <div className="p-2">
                  <DayPicker
                    mode="single"
                    selected={dateFromYmd(viewDate)}
                    onSelect={(d) => {
                      if (!d) return
                      const k = localDateString(d)
                      if (!loggedDatesSet.has(k) || k > calendarToday) return
                      setViewDate(k)
                      setCalendarOpen(false)
                    }}
                    disabled={calendarDisabled}
                    defaultMonth={dateFromYmd(viewDate)}
                    className="rdp-root [--rdp-accent-color:theme(colors.primary)] [--rdp-background-color:theme(colors.background)]"
                  />
                </div>
              </PopoverContent>
            </Popover>

            {nextLoggedDate ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 touch-manipulation"
                aria-label="Next logged day"
                onClick={() => setViewDate(nextLoggedDate)}
              >
                <ChevronRight className="size-5" />
              </Button>
            ) : (
              <div className="size-9 shrink-0" aria-hidden />
            )}
          </div>

          <div aria-hidden className="min-w-0" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {state.exercises.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No exercises yet. Add one below to start logging sets.
          </p>
        ) : (
          <div className="flex flex-col">
            {state.exercises.map((ex) => (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                state={state}
                viewDate={viewDate}
                isViewingToday={viewDate === calendarToday}
                draft={drafts[ex.id] ?? { reps: "", lbs: "" }}
                onDraftChange={(field, v) => setDraft(ex.id, field, v)}
                onCommitDraft={() => commitDraftIfValid(ex.id)}
                onUpdateSet={(setIndex, reps, weightLb) =>
                  updateSetOnDate(ex.id, setIndex, reps, weightLb, viewDate)
                }
              />
            ))}
          </div>
        )}

        <Separator className="my-3" />

        <Button
          type="button"
          variant="outline"
          className="h-12 w-full touch-manipulation gap-2 border-dashed"
          onClick={() => {
            setAddName("")
            setAddError("")
            setAddOpen(true)
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add workout
        </Button>
      </main>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription>
              This name appears in the top bar on this device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={profileDraft}
              onChange={(e) => setProfileDraft(e.target.value)}
              autoComplete="nickname"
              className="text-base"
            />
          </div>
          <DialogFooter>
            <Button type="button" onClick={saveProfile}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add exercise</DialogTitle>
            <DialogDescription>
              Each name is saved once. Logs attach to that exercise over time.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="exercise-name">Name</Label>
            <Input
              id="exercise-name"
              value={addName}
              onChange={(e) => {
                setAddName(e.target.value)
                setAddError("")
              }}
              placeholder="e.g. Squats"
              autoComplete="off"
              className="text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter") tryAddExercise()
              }}
            />
            {addError ? (
              <p className="text-sm text-destructive" role="alert">
                {addError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" onClick={tryAddExercise}>
              Save exercise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const SET_COL_W = "min-w-[5.75rem] w-[5.75rem] shrink-0"

function ExerciseRow({
  exercise,
  state,
  viewDate,
  isViewingToday,
  draft,
  onDraftChange,
  onCommitDraft,
  onUpdateSet,
}: {
  exercise: Exercise
  state: WorkoutAppState
  viewDate: string
  isViewingToday: boolean
  draft: Draft
  onDraftChange: (field: keyof Draft, value: string) => void
  onCommitDraft: () => void
  onUpdateSet: (setIndex: number, reps: number, weightLb: number) => void
}) {
  const prior = lastSessionBeforeDate(state, exercise.id, viewDate)
  const session = sessionOnDate(state, exercise.id, viewDate)
  const sets = session?.sets ?? []

  return (
    <article className="border-b py-3">
      <h2 className="px-1 text-sm font-semibold leading-snug">{exercise.name}</h2>
      <div className="mt-2 -mx-1 flex overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <div className="sticky left-0 z-10 flex max-w-[6.75rem] min-w-[5.25rem] shrink-0 flex-col border-r border-border bg-background px-1.5 py-0.5 pr-2">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Last
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {prior ? summarizeSession(prior) : "No prior log"}
          </p>
        </div>

        <div className="flex min-w-min flex-nowrap items-start gap-3 pl-3 pr-1 pt-0.5">
          {sets.map((set, setIndex) => (
            <div
              key={set.loggedAt}
              className={`flex flex-col items-center gap-1 ${SET_COL_W}`}
            >
              <div className="min-h-[0.875rem] text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Set {setIndex + 1}
              </div>
              <LoggedSetCell
                exerciseId={exercise.id}
                set={set}
                setIndex={setIndex}
                onSave={(reps, weightLb) => onUpdateSet(setIndex, reps, weightLb)}
              />
            </div>
          ))}
          {isViewingToday && (
            <div className={`flex flex-col items-center gap-1 ${SET_COL_W}`}>
              <div className="min-h-[0.875rem] text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Set {sets.length + 1}
              </div>
              <DraftSetPair
                exerciseId={exercise.id}
                draft={draft}
                onDraftChange={onDraftChange}
                onCommitDraft={onCommitDraft}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function DraftSetPair({
  exerciseId,
  draft,
  onDraftChange,
  onCommitDraft,
}: {
  exerciseId: string
  draft: Draft
  onDraftChange: (field: keyof Draft, value: string) => void
  onCommitDraft: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  const onBlurGroup = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (wrapRef.current?.contains(next)) return
    onCommitDraft()
  }

  return (
    <div
      ref={wrapRef}
      className="mt-1 flex w-full flex-nowrap justify-center gap-1"
      onBlur={onBlurGroup}
    >
      <Input
        id={`draft-reps-${exerciseId}`}
        inputMode="numeric"
        placeholder="Rep"
        aria-label="Reps"
        value={draft.reps}
        onChange={(e) => onDraftChange("reps", e.target.value)}
        className="h-9 w-[2.75rem] min-w-0 flex-1 px-1 text-center text-sm tabular-nums"
      />
      <Input
        id={`draft-lbs-${exerciseId}`}
        inputMode="decimal"
        placeholder="lbs"
        aria-label="Weight in lb"
        value={draft.lbs}
        onChange={(e) => onDraftChange("lbs", e.target.value)}
        className="h-9 w-[2.75rem] min-w-0 flex-1 px-1 text-center text-sm tabular-nums"
      />
    </div>
  )
}

function LoggedSetCell({
  exerciseId,
  set,
  setIndex,
  onSave,
}: {
  exerciseId: string
  set: LoggedSet
  setIndex: number
  onSave: (reps: number, weightLb: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [repsStr, setRepsStr] = useState(String(set.reps))
  const [lbsStr, setLbsStr] = useState(String(set.weightLb))
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRepsStr(String(set.reps))
    setLbsStr(String(set.weightLb))
  }, [set.reps, set.weightLb, set.loggedAt])

  const flush = useCallback(() => {
    const r = Number.parseInt(repsStr, 10)
    const w = Number.parseFloat(lbsStr)
    if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(w) || w <= 0) {
      setRepsStr(String(set.reps))
      setLbsStr(String(set.weightLb))
    } else if (r !== set.reps || w !== set.weightLb) {
      onSave(r, w)
    }
    setEditing(false)
  }, [lbsStr, onSave, repsStr, set.reps, set.weightLb])

  const onBlurGroup = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (wrapRef.current?.contains(next)) return
    flush()
  }

  const idBase = `${exerciseId}-${set.loggedAt}-${setIndex}`

  if (!editing) {
    return (
      <button
        type="button"
        className="mt-1 w-full touch-manipulation rounded-md px-1 py-1.5 text-center text-xs tabular-nums leading-snug text-foreground hover:bg-muted/70 active:bg-muted"
        onClick={() => setEditing(true)}
      >
        {set.reps} reps {set.weightLb}lbs
      </button>
    )
  }

  return (
    <div
      ref={wrapRef}
      className="mt-1 flex w-full flex-nowrap justify-center gap-1"
      onBlur={onBlurGroup}
    >
      <Input
        id={`${idBase}-reps`}
        autoFocus
        inputMode="numeric"
        placeholder="Rep"
        aria-label={`Set ${setIndex + 1} reps`}
        value={repsStr}
        onChange={(e) => setRepsStr(e.target.value)}
        className="h-9 w-[2.75rem] min-w-0 flex-1 px-1 text-center text-sm tabular-nums"
      />
      <Input
        id={`${idBase}-lbs`}
        inputMode="decimal"
        placeholder="lbs"
        aria-label={`Set ${setIndex + 1} weight`}
        value={lbsStr}
        onChange={(e) => setLbsStr(e.target.value)}
        className="h-9 w-[2.75rem] min-w-0 flex-1 px-1 text-center text-sm tabular-nums"
      />
    </div>
  )
}
