import { useCallback, useEffect, useMemo, useState } from "react"
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
import type { DaySession, Exercise, LoggedSet, WorkoutAppState } from "@/lib/workout-model"
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
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[min(100%,20rem)] table-fixed border-separate border-spacing-0">
              <caption className="sr-only">
                Exercises, last session, and today&apos;s sets
              </caption>
              <thead>
                <tr className="border-b text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th
                    scope="col"
                    className="w-[26%] pb-2 pl-1 text-left font-semibold sm:text-xs"
                  >
                    Exercise
                  </th>
                  <th
                    scope="col"
                    className="w-[34%] pb-2 text-left font-semibold sm:text-xs"
                  >
                    Last
                  </th>
                  <th
                    scope="col"
                    className="w-[40%] pb-2 pr-1 text-right font-semibold sm:text-xs"
                  >
                    Today
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.exercises.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    state={state}
                    todayStr={todayStr}
                    draft={drafts[ex.id] ?? { reps: "", lbs: "" }}
                    onDraftChange={(field, v) => setDraft(ex.id, field, v)}
                    onLog={() => logSet(ex.id)}
                  />
                ))}
              </tbody>
            </table>
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
}: {
  exercise: Exercise
  state: WorkoutAppState
  todayStr: string
  draft: Draft
  onDraftChange: (field: keyof Draft, value: string) => void
  onLog: () => void
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
    <tr className="border-b align-top">
      <td className="py-3 pl-1">
        <p className="line-clamp-4 text-sm font-semibold leading-snug">
          {exercise.name}
        </p>
      </td>
      <td className="py-3 pr-1">
        <LastWorkoutCell prior={prior} />
      </td>
      <td className="py-3 pl-1">
        <div className="flex max-w-full flex-row flex-nowrap items-end justify-end gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
          {todaySets.map((s, i) => (
            <div
              key={`${s.loggedAt}-${i}`}
              className="flex shrink-0 flex-col items-center rounded-md border bg-muted/50 px-2 py-1.5 text-center"
            >
              <span className="text-[0.7rem] font-medium tabular-nums leading-none text-foreground">
                {s.weightLb}lb
              </span>
              <span className="text-[0.65rem] tabular-nums text-muted-foreground">
                ×{s.reps}
              </span>
            </div>
          ))}
          <div className="flex shrink-0 items-end gap-1">
            <div className="grid w-[3.25rem] gap-0.5">
              <Label htmlFor={`reps-${exercise.id}`} className="sr-only">
                Reps
              </Label>
              <Input
                id={`reps-${exercise.id}`}
                inputMode="numeric"
                placeholder="reps"
                value={draft.reps}
                onChange={(e) => onDraftChange("reps", e.target.value)}
                className="h-10 px-1 text-center text-sm tabular-nums"
              />
            </div>
            <div className="grid w-[3.25rem] gap-0.5">
              <Label htmlFor={`lbs-${exercise.id}`} className="sr-only">
                Weight in lb
              </Label>
              <Input
                id={`lbs-${exercise.id}`}
                inputMode="decimal"
                placeholder="lb"
                value={draft.lbs}
                onChange={(e) => onDraftChange("lbs", e.target.value)}
                className="h-10 px-1 text-center text-sm tabular-nums"
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
      </td>
    </tr>
  )
}

function LastWorkoutCell({ prior }: { prior: DaySession | null }) {
  if (!prior) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 text-xs leading-snug">
        <span className="text-muted-foreground">—</span>
        <span className="text-muted-foreground">No prior log</span>
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-xs leading-snug">
      <span className="font-medium text-foreground">
        {formatShortDate(prior.date)}
      </span>
      <span className="text-muted-foreground">{summarizeSession(prior)}</span>
    </div>
  )
}
