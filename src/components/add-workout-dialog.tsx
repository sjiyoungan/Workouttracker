import { useMemo, useState } from "react"

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
  getRosterIds,
  type Exercise,
  type WorkoutAppState,
} from "@/lib/workout-model"

type Mode = "pick" | "existing" | "new"

type AddWorkoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: WorkoutAppState
  viewDate: string
  onAddExisting: (exerciseId: string) => void
  onCreateNew: (name: string) => void
}

export default function AddWorkoutDialog({
  open,
  onOpenChange,
  state,
  viewDate,
  onAddExisting,
  onCreateNew,
}: AddWorkoutDialogProps) {
  const [mode, setMode] = useState<Mode>("pick")
  const [addName, setAddName] = useState("")
  const [addError, setAddError] = useState("")

  const rosterIds = useMemo(
    () => new Set(getRosterIds(state, viewDate)),
    [state, viewDate]
  )

  const available: Exercise[] = useMemo(
    () => state.exercises.filter((e) => !rosterIds.has(e.id)),
    [state.exercises, rosterIds]
  )

  const reset = () => {
    setMode("pick")
    setAddName("")
    setAddError("")
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const tryCreate = () => {
    const trimmed = addName.trim()
    if (!trimmed) {
      setAddError("Enter a name.")
      return
    }
    const taken = state.exercises.some(
      (e) => e.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (taken) {
      setAddError("That exercise already exists. Add it from your library instead.")
      return
    }
    onCreateNew(trimmed)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mode === "pick" ? (
          <>
            <DialogHeader>
              <DialogTitle>Add workout</DialogTitle>
              <DialogDescription>
                Add an exercise to {viewDate}&apos;s log, or create a new one in
                your library.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 justify-start touch-manipulation"
                disabled={available.length === 0}
                onClick={() => setMode("existing")}
              >
                Add from library
                {available.length === 0 ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    All added
                  </span>
                ) : (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {available.length} available
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 justify-start touch-manipulation"
                onClick={() => setMode("new")}
              >
                Create new workout
              </Button>
            </div>
          </>
        ) : null}

        {mode === "existing" ? (
          <>
            <DialogHeader>
              <DialogTitle>Add from library</DialogTitle>
              <DialogDescription>
                Tap a workout to add it to this day.
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-64 overflow-y-auto rounded-md border">
              {available.map((ex) => (
                <li key={ex.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full touch-manipulation px-3 py-3 text-left text-sm font-medium hover:bg-muted/70"
                    onClick={() => {
                      onAddExisting(ex.id)
                      handleOpenChange(false)
                    }}
                  >
                    {ex.name}
                  </button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMode("pick")}>
                Back
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {mode === "new" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create new workout</DialogTitle>
              <DialogDescription>
                Saves to your library and adds it to this day.
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
                  if (e.key === "Enter") tryCreate()
                }}
              />
              {addError ? (
                <p className="text-sm text-destructive" role="alert">
                  {addError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setMode("pick")}>
                Back
              </Button>
              <Button type="button" onClick={tryCreate}>
                Create & add
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
