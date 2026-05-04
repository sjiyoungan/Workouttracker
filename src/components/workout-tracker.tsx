import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Plus, UserRound } from "lucide-react"

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
import { Separator } from "@/components/ui/separator"
import type { Exercise, LoggedSet, WorkoutAppState } from "@/lib/workout-model"
import {
  lastSessionBeforeToday,
  loadWorkoutState,
  localDateString,
  saveWorkoutState,
  summarizeSession,
  todaySession,
} from "@/lib/workout-model"

type Draft = { reps: string; lbs: string }

export default function WorkoutTracker() {
  const [state, setState] = useState<WorkoutAppState>(loadWorkoutState)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileDraft, setProfileDraft] = useState(state.profileName)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addError, setAddError] = useState("")

  const todayStr = useMemo(() => localDateString(), [])

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

  const logSet = useCallback(
    (exerciseId: string) => {
      const d = drafts[exerciseId] ?? { reps: "", lbs: "" }
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
        const idx = prevList.findIndex((x) => x.date === todayStr)
        let nextList: typeof prevList
        if (idx === -1) {
          nextList = [...prevList, { date: todayStr, sets: [newSet] }]
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
    [drafts, todayStr]
  )

  const updateTodaySet = useCallback(
    (exerciseId: string, setIndex: number, reps: number, weightLb: number) => {
      setState((s) => {
        const sessions = [...(s.sessionsByExerciseId[exerciseId] ?? [])]
        const idx = sessions.findIndex((x) => x.date === todayStr)
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
    [todayStr]
  )

  const setDraft = (exerciseId: string, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [exerciseId]: { ...(prev[exerciseId] ?? { reps: "", lbs: "" }), [field]: value },
    }))
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-11 min-w-0 flex-1 touch-manipulation justify-start gap-2 px-2"
            onClick={openProfile}
          >
            <UserRound className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-left text-sm font-semibold">
              {state.profileName}
            </span>
          </Button>
          <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Workouts
          </span>
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
                todayStr={todayStr}
                draft={drafts[ex.id] ?? { reps: "", lbs: "" }}
                onDraftChange={(field, v) => setDraft(ex.id, field, v)}
                onLog={() => logSet(ex.id)}
                onUpdateTodaySet={(setIndex, reps, weightLb) =>
                  updateTodaySet(ex.id, setIndex, reps, weightLb)
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

function ExerciseRow({
  exercise,
  state,
  todayStr,
  draft,
  onDraftChange,
  onLog,
  onUpdateTodaySet,
}: {
  exercise: Exercise
  state: WorkoutAppState
  todayStr: string
  draft: Draft
  onDraftChange: (field: keyof Draft, value: string) => void
  onLog: () => void
  onUpdateTodaySet: (setIndex: number, reps: number, weightLb: number) => void
}) {
  const prior = lastSessionBeforeToday(state, exercise.id, todayStr)
  const today = todaySession(state, exercise.id, todayStr)
  const todaySets = today?.sets ?? []

  const nextSetNumber = todaySets.length + 1

  const repsOk = Number.parseInt(draft.reps, 10)
  const lbsOk = Number.parseFloat(draft.lbs)
  const canLog =
    Number.isFinite(repsOk) &&
    repsOk > 0 &&
    Number.isFinite(lbsOk) &&
    lbsOk > 0

  return (
    <article className="border-b py-3">
      <h2 className="text-sm font-semibold leading-snug">{exercise.name}</h2>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Last
        </div>
        <div className="text-right text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Set {nextSetNumber}
        </div>

        <div className="min-w-0 self-start text-xs leading-snug text-muted-foreground">
          {prior ? summarizeSession(prior) : "No prior log"}
        </div>

        <div className="flex min-w-0 flex-col items-end gap-2">
          {todaySets.map((set, setIndex) => (
            <LoggedSetLine
              key={set.loggedAt}
              exerciseId={exercise.id}
              set={set}
              setIndex={setIndex}
              onSave={(reps, weightLb) => onUpdateTodaySet(setIndex, reps, weightLb)}
            />
          ))}
          <div className="flex flex-nowrap items-end justify-end gap-1">
            <Input
              id={`draft-reps-${exercise.id}`}
              inputMode="numeric"
              aria-label="Reps for next set"
              value={draft.reps}
              onChange={(e) => onDraftChange("reps", e.target.value)}
              className="h-9 w-[3.25rem] px-1 text-center text-sm tabular-nums"
            />
            <Input
              id={`draft-lbs-${exercise.id}`}
              inputMode="decimal"
              aria-label="Weight in lb for next set"
              value={draft.lbs}
              onChange={(e) => onDraftChange("lbs", e.target.value)}
              className="h-9 w-[3.25rem] px-1 text-center text-sm tabular-nums"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={!canLog}
              className="size-10 shrink-0 touch-manipulation"
              aria-label={`Log set ${nextSetNumber} for ${exercise.name}`}
              onClick={onLog}
            >
              <Check className="size-5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

function LoggedSetLine({
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
        className="max-w-[12rem] touch-manipulation rounded-md px-2 py-1.5 text-right text-sm tabular-nums text-foreground hover:bg-muted/70 active:bg-muted"
        onClick={() => setEditing(true)}
      >
        {set.reps} reps {set.weightLb}lbs
      </button>
    )
  }

  return (
    <div
      ref={wrapRef}
      className="flex max-w-[12rem] justify-end gap-1"
      onBlur={onBlurGroup}
    >
      <Input
        id={`${idBase}-reps`}
        autoFocus
        inputMode="numeric"
        aria-label={`Set ${setIndex + 1} reps`}
        value={repsStr}
        onChange={(e) => setRepsStr(e.target.value)}
        className="h-9 w-[3.25rem] px-1 text-center text-sm tabular-nums"
      />
      <Input
        id={`${idBase}-lbs`}
        inputMode="decimal"
        aria-label={`Set ${setIndex + 1} weight in lb`}
        value={lbsStr}
        onChange={(e) => setLbsStr(e.target.value)}
        className="h-9 w-[3.25rem] px-1 text-center text-sm tabular-nums"
      />
    </div>
  )
}
