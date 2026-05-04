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
import { cn } from "@/lib/utils"
import type { Exercise, LoggedSet, WorkoutAppState } from "@/lib/workout-model"
import {
  lastSessionBeforeToday,
  loadWorkoutState,
  localDateString,
  saveWorkoutState,
  summarizeSession,
  todaySession,
  formatShortDate,
} from "@/lib/workout-model"

type Draft = { reps: string; lbs: string }

const ghostInput =
  "border-transparent bg-transparent shadow-none ring-0 outline-none " +
  "focus-visible:border-input focus-visible:bg-background focus-visible:shadow-sm " +
  "focus-visible:ring-1 focus-visible:ring-ring " +
  "placeholder:text-muted-foreground/50"

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

  const repsOk = Number.parseInt(draft.reps, 10)
  const lbsOk = Number.parseFloat(draft.lbs)
  const canLog =
    Number.isFinite(repsOk) &&
    repsOk > 0 &&
    Number.isFinite(lbsOk) &&
    lbsOk > 0

  return (
    <article className="border-b py-3">
      <div className="flex items-end gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-snug">{exercise.name}</h2>
        </div>
        <div className="flex shrink-0 flex-nowrap items-end gap-1">
          <div className="grid w-[3.25rem] gap-0.5">
            <Label htmlFor={`draft-reps-${exercise.id}`} className="sr-only">
              Reps for new set
            </Label>
            <Input
              id={`draft-reps-${exercise.id}`}
              inputMode="numeric"
              placeholder="reps"
              value={draft.reps}
              onChange={(e) => onDraftChange("reps", e.target.value)}
              className="h-9 px-1 text-center text-sm tabular-nums"
            />
          </div>
          <div className="grid w-[3.25rem] gap-0.5">
            <Label htmlFor={`draft-lbs-${exercise.id}`} className="sr-only">
              Weight for new set
            </Label>
            <Input
              id={`draft-lbs-${exercise.id}`}
              inputMode="decimal"
              placeholder="lb"
              value={draft.lbs}
              onChange={(e) => onDraftChange("lbs", e.target.value)}
              className="h-9 px-1 text-center text-sm tabular-nums"
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            disabled={!canLog}
            className="size-10 shrink-0 touch-manipulation"
            aria-label={`Log set for ${exercise.name}`}
            onClick={onLog}
          >
            <Check className="size-5" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-end gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Last
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {prior ? (
              <>
                <span className="font-medium text-foreground">
                  {formatShortDate(prior.date)}
                </span>
                <span className="text-muted-foreground">
                  {" · "}
                  {summarizeSession(prior)}
                </span>
              </>
            ) : (
              <span>No prior log</span>
            )}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-row flex-wrap items-end justify-end gap-x-1 gap-y-1">
          {todaySets.map((set, setIndex) => (
            <LoggedSetPair
              key={set.loggedAt}
              exerciseId={exercise.id}
              set={set}
              setIndex={setIndex}
              onSave={(reps, weightLb) => onUpdateTodaySet(setIndex, reps, weightLb)}
            />
          ))}
        </div>
      </div>
    </article>
  )
}

function LoggedSetPair({
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
      return
    }
    if (r !== set.reps || w !== set.weightLb) {
      onSave(r, w)
    }
  }, [lbsStr, onSave, repsStr, set.reps, set.weightLb])

  const onBlurGroup = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (wrapRef.current?.contains(next)) return
    flush()
  }

  const idBase = `${exerciseId}-${set.loggedAt}-${setIndex}`

  return (
    <div
      ref={wrapRef}
      className="flex shrink-0 items-end gap-0.5"
      onBlur={onBlurGroup}
    >
      <Input
        id={`${idBase}-reps`}
        inputMode="numeric"
        aria-label={`Reps set ${setIndex + 1}`}
        value={repsStr}
        onChange={(e) => setRepsStr(e.target.value)}
        className={cn(
          "h-9 w-[3.25rem] px-1 text-center text-sm tabular-nums",
          ghostInput
        )}
      />
      <Input
        id={`${idBase}-lbs`}
        inputMode="decimal"
        aria-label={`Weight set ${setIndex + 1}`}
        value={lbsStr}
        onChange={(e) => setLbsStr(e.target.value)}
        className={cn(
          "h-9 w-[3.25rem] px-1 text-center text-sm tabular-nums",
          ghostInput
        )}
      />
    </div>
  )
}
