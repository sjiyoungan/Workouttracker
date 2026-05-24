import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  DndContext,
  type DragEndEvent,
  type DraggableAttributes,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
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
  sessionsForExercise,
} from "@/lib/workout-model"
import { fetchWorkoutState, upsertWorkoutState } from "@/lib/workout-sync"

type Draft = { reps: string; lbs: string }

export default function WorkoutTracker() {
  const calendarToday = localDateString()
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<WorkoutAppState>(loadWorkoutState)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const cloudReadyUserIdRef = useRef<string | null>(null)
  const saveCloudTimerRef = useRef<number | null>(null)

  const [viewDate, setViewDate] = useState(() => localDateString())
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [profileOpen, setProfileOpen] = useState(false)
  const [profileDraft, setProfileDraft] = useState(state.profileName)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addError, setAddError] = useState("")

  const [detailsExerciseId, setDetailsExerciseId] = useState<string | null>(null)
  const [deleteExerciseId, setDeleteExerciseId] = useState<string | null>(null)
  const [reorderMode, setReorderMode] = useState(false)

  const exerciseIds = useMemo(
    () => state.exercises.map((e) => e.id),
    [state.exercises]
  )

  const reorderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const loggedDatesSet = useMemo(() => new Set(allDatesWithLogs(state)), [state])
  const loggedDatesSorted = useMemo(() => allDatesWithLogs(state), [state])

  const prevLoggedDate = useMemo(() => {
    const before = loggedDatesSorted.filter((d) => d < viewDate)
    return before.length ? before[before.length - 1]! : null
  }, [loggedDatesSorted, viewDate])

  /** Next screen when moving forward from history: earliest logged day after view and on/before today, else today (even if today has no logs). */
  const canGoForward = viewDate < calendarToday

  const forwardTargetDate = useMemo(() => {
    if (!(viewDate < calendarToday)) return calendarToday
    const nextRecorded = loggedDatesSorted.find(
      (d) => d > viewDate && d <= calendarToday
    )
    return nextRecorded ?? calendarToday
  }, [calendarToday, loggedDatesSorted, viewDate])

  useEffect(() => {
    saveWorkoutState(state)
    const uid = user?.id
    if (!uid || cloudReadyUserIdRef.current !== uid) return
    if (saveCloudTimerRef.current) window.clearTimeout(saveCloudTimerRef.current)
    saveCloudTimerRef.current = window.setTimeout(() => {
      upsertWorkoutState(uid, state).catch((err) => {
        console.error("Failed to sync workout data:", err)
      })
    }, 800)
    return () => {
      if (saveCloudTimerRef.current) window.clearTimeout(saveCloudTimerRef.current)
    }
  }, [state, user?.id])

  useEffect(() => {
    if (authLoading || !user) {
      cloudReadyUserIdRef.current = null
      return
    }

    let cancelled = false
    cloudReadyUserIdRef.current = null

    ;(async () => {
      const local = loadWorkoutState()
      try {
        const cloud = await fetchWorkoutState(user.id)
        if (cancelled) return
        if (cloud && cloud.exercises.length > 0) {
          setState(cloud)
        } else if (local.exercises.length > 0) {
          await upsertWorkoutState(user.id, local)
          if (!cancelled) setState(local)
        } else if (cloud) {
          setState(cloud)
        }
      } catch (err) {
        console.error("Failed to load cloud workout data:", err)
      } finally {
        if (!cancelled) cloudReadyUserIdRef.current = user.id
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

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

  const deleteExercise = useCallback(
    (exerciseId: string) => {
      setState((s) => {
        const exercises = s.exercises.filter((e) => e.id !== exerciseId)
        const sessionsByExerciseId = { ...s.sessionsByExerciseId }
        delete sessionsByExerciseId[exerciseId]
        return { ...s, exercises, sessionsByExerciseId }
      })
      setDrafts((d) => {
        const next = { ...d }
        delete next[exerciseId]
        return next
      })
      setDetailsExerciseId((cur) => (cur === exerciseId ? null : cur))
      setDeleteExerciseId(null)
    },
    []
  )

  const updateExerciseYoutubeUrl = useCallback((exerciseId: string, url: string) => {
    const trimmed = url.trim()
    setState((s) => ({
      ...s,
      exercises: s.exercises.map((e) =>
        e.id === exerciseId ? { ...e, youtubeUrl: trimmed || undefined } : e
      ),
    }))
  }, [])

  const goToday = useCallback(() => {
    setViewDate(localDateString())
    setCalendarOpen(false)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setState((s) => {
      const oldIndex = s.exercises.findIndex((e) => e.id === active.id)
      const newIndex = s.exercises.findIndex((e) => e.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return s
      return {
        ...s,
        exercises: arrayMove(s.exercises, oldIndex, newIndex),
      }
    })
  }, [])

  /** Only future dates are disabled; any past/today day is selectable even with no logs. */
  const calendarDisabled = (date: Date) => localDateString(date) > calendarToday

  const calendarModifiers = useMemo(
    () => ({
      hasLog: (date: Date) => loggedDatesSet.has(localDateString(date)),
    }),
    [loggedDatesSet]
  )

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
                      if (k > calendarToday) return
                      setViewDate(k)
                      setCalendarOpen(false)
                    }}
                    disabled={calendarDisabled}
                    modifiers={calendarModifiers}
                    modifiersClassNames={{
                      hasLog:
                        "bg-muted text-foreground font-medium rounded-md aria-selected:font-semibold",
                    }}
                    defaultMonth={dateFromYmd(viewDate)}
                    className="rdp-root [--rdp-accent-color:theme(colors.primary)] [--rdp-background-color:theme(colors.background)]"
                  />
                </div>
              </PopoverContent>
            </Popover>

            {canGoForward ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 touch-manipulation"
                aria-label="Next logged day or today"
                onClick={() => setViewDate(forwardTargetDate)}
              >
                <ChevronRight className="size-5" />
              </Button>
            ) : (
              <div className="size-9 shrink-0" aria-hidden />
            )}
          </div>

          <div className="flex min-w-0 justify-end">
            {state.exercises.length > 0 ? (
              <Button
                type="button"
                variant={reorderMode ? "secondary" : "ghost"}
                size="sm"
                className="h-9 touch-manipulation px-2 text-xs font-semibold"
                onClick={() => setReorderMode((v) => !v)}
              >
                {reorderMode ? "Done" : "Reorder"}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {state.exercises.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No exercises yet. Add one below to start logging sets.
          </p>
        ) : reorderMode ? (
          <DndContext
            sensors={reorderSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={exerciseIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col">
                {state.exercises.map((ex) => (
                  <SortableExerciseRow
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
            </SortableContext>
          </DndContext>
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
                onOpenDetails={() => setDetailsExerciseId(ex.id)}
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
            <DialogTitle>Account</DialogTitle>
            <DialogDescription>
              Your display name and account settings.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
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
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" onClick={saveProfile}>
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void signOut()
                setProfileOpen(false)
                navigate("/sign-in")
              }}
            >
              Sign out
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

      <Dialog open={deleteExerciseId !== null} onOpenChange={(o) => !o && setDeleteExerciseId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete workout?</DialogTitle>
            <DialogDescription>
              This removes the exercise and all of its saved logs on this device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteExerciseId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteExerciseId && deleteExercise(deleteExerciseId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExerciseDetailsSheet
        open={detailsExerciseId !== null}
        onOpenChange={(o) => !o && setDetailsExerciseId(null)}
        exercise={state.exercises.find((e) => e.id === detailsExerciseId) ?? null}
        state={state}
        onUpdateYoutubeUrl={updateExerciseYoutubeUrl}
        onRequestDelete={() => {
          if (!detailsExerciseId) return
          setDeleteExerciseId(detailsExerciseId)
          setDetailsExerciseId(null)
        }}
      />
    </div>
  )
}

const SET_COL_W = "min-w-[5.75rem] w-[5.75rem] shrink-0"

type ExerciseRowProps = {
  exercise: Exercise
  state: WorkoutAppState
  viewDate: string
  isViewingToday: boolean
  draft: Draft
  onDraftChange: (field: keyof Draft, value: string) => void
  onCommitDraft: () => void
  onUpdateSet: (setIndex: number, reps: number, weightLb: number) => void
  onOpenDetails?: () => void
  reorderMode?: boolean
  dragHandleProps?: {
    attributes: DraggableAttributes
    listeners: SyntheticListenerMap | undefined
  }
}

function SortableExerciseRow(props: Omit<ExerciseRowProps, "reorderMode" | "dragHandleProps">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.exercise.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "relative z-50")}
    >
      <ExerciseRow
        {...props}
        reorderMode
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  )
}

function ExerciseRow({
  exercise,
  state,
  viewDate,
  isViewingToday,
  draft,
  onDraftChange,
  onCommitDraft,
  onUpdateSet,
  onOpenDetails,
  reorderMode = false,
  dragHandleProps,
}: ExerciseRowProps) {
  const prior = lastSessionBeforeDate(state, exercise.id, viewDate)
  const session = sessionOnDate(state, exercise.id, viewDate)
  const sets = session?.sets ?? []

  return (
    <article
      className={cn(
        "border-b py-3",
        reorderMode && "cursor-grab touch-manipulation active:cursor-grabbing"
      )}
      {...(reorderMode && dragHandleProps
        ? { ...dragHandleProps.attributes, ...dragHandleProps.listeners }
        : {})}
    >
      <div className="flex items-center gap-1 px-1">
        {reorderMode ? (
          <div
            className="flex size-9 shrink-0 items-center justify-center text-muted-foreground"
            aria-hidden
          >
            <GripVertical className="size-5" />
          </div>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug">
          {exercise.name}
        </h2>
        {!reorderMode && onOpenDetails ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 touch-manipulation"
            aria-label={`View details for ${exercise.name}`}
            onClick={onOpenDetails}
          >
            <ChevronRight className="size-5" />
          </Button>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-2 flex w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]",
          reorderMode && "pointer-events-none select-none opacity-60"
        )}
      >
        <div className="sticky left-0 z-10 flex w-[6.25rem] shrink-0 flex-col border-r border-border bg-background px-1.5 py-0.5 pr-2">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            LAST
          </div>
          <div className="mt-1 text-xs leading-snug text-muted-foreground">
            {prior ? <LastSummaryTwoLine session={prior} /> : "No prior log"}
          </div>
        </div>

        <div className="flex w-max flex-nowrap items-start gap-3 pl-3 pr-1 pt-0.5">
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

function LastSummaryTwoLine({ session }: { session: { sets: LoggedSet[] } }) {
  const n = session.sets.length
  const last = session.sets[n - 1]
  return (
    <div className="flex flex-col gap-0.5">
      <div>{n} set</div>
      <div>
        {last.reps} reps {last.weightLb}lbs
      </div>
    </div>
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
      data-interactive="true"
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
        data-interactive="true"
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
      data-interactive="true"
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

function ExerciseDetailsSheet({
  open,
  onOpenChange,
  exercise,
  state,
  onUpdateYoutubeUrl,
  onRequestDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: Exercise | null
  state: WorkoutAppState
  onUpdateYoutubeUrl: (exerciseId: string, url: string) => void
  onRequestDelete: () => void
}) {
  const [draftUrl, setDraftUrl] = useState("")

  useEffect(() => {
    setDraftUrl(exercise?.youtubeUrl ?? "")
  }, [exercise?.id, exercise?.youtubeUrl])

  const history = useMemo(() => {
    if (!exercise) return []
    const sessions = sessionsForExercise(state, exercise.id)
      .filter((s) => s.sets.length > 0)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
    const rows: Array<{
      date: string
      setNumber: number
      reps: number
      weightLb: number
    }> = []
    for (const s of sessions) {
      s.sets.forEach((set, i) => {
        rows.push({
          date: s.date,
          setNumber: i + 1,
          reps: set.reps,
          weightLb: set.weightLb,
        })
      })
    }
    return rows
  }, [exercise, state])

  const trend = useMemo(() => {
    if (!exercise) return []
    const sessions = sessionsForExercise(state, exercise.id)
      .filter((s) => s.sets.length > 0)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
    return sessions.map((s) => {
      const last = s.sets[s.sets.length - 1]!
      return { date: s.date, value: last.weightLb }
    })
  }, [exercise, state])

  const safeUrl = useMemo(() => {
    const u = (exercise?.youtubeUrl ?? "").trim()
    if (!u) return null
    try {
      const parsed = new URL(u)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
      return parsed.toString()
    } catch {
      return null
    }
  }, [exercise?.youtubeUrl])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{exercise?.name ?? "Workout"}</SheetTitle>
          <SheetDescription>
            Trend, full history, and optional video link.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-3">
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Trend</div>
              <div className="text-xs text-muted-foreground">Last set weight</div>
            </div>
            <Sparkline data={trend.map((t) => t.value)} />
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-semibold">YouTube</div>
            <div className="grid gap-2">
              <Input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="Paste a YouTube link"
                onBlur={() => {
                  if (exercise) onUpdateYoutubeUrl(exercise.id, draftUrl)
                }}
              />
              {safeUrl ? (
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open video <ExternalLink className="size-4" aria-hidden />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add a valid https link to enable opening in a new tab.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="text-sm font-semibold">All sets</div>
              <div className="text-xs text-muted-foreground">
                {history.length ? `${history.length} entries` : "No logs yet"}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Set</TableHead>
                  <TableHead className="text-right">Reps</TableHead>
                  <TableHead className="text-right">lbs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r, i) => (
                  <TableRow key={`${r.date}-${r.setNumber}-${i}`}>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.date}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.setNumber}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.reps}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.weightLb}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button
            type="button"
            variant="destructive"
            className="w-full touch-manipulation gap-2"
            onClick={onRequestDelete}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete exercise
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Sparkline({ data }: { data: number[] }) {
  const w = 320
  const h = 64
  const pad = 6
  if (!data.length) {
    return (
      <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
        No data yet
      </div>
    )
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = Math.max(1, max - min)
  const points = data
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1)
      const y = pad + (1 - (v - min) / span) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-16 w-full"
      role="img"
      aria-label="Trend sparkline"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-primary"
        points={points}
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary/15"
        points={points}
      />
    </svg>
  )
}
