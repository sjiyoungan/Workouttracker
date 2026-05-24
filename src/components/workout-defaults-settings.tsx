import { useState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  findDefaultOverlap,
  scheduleSummary,
} from "@/lib/workout-defaults"
import type { WorkoutAppState, WorkoutDefault, WorkoutSchedule } from "@/lib/workout-model"
import { localDateString } from "@/lib/workout-model"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type WorkoutDefaultsSettingsProps = {
  state: WorkoutAppState
  onChange: (defaults: WorkoutDefault[]) => void
}

export default function WorkoutDefaultsSettings({
  state,
  onChange,
}: WorkoutDefaultsSettingsProps) {
  const defaults = state.workoutDefaults ?? []
  const [exerciseId, setExerciseId] = useState("")
  const [scheduleType, setScheduleType] = useState<
    "every_day" | "weekdays" | "interval"
  >("every_day")
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5])
  const [everyDays, setEveryDays] = useState("2")
  const [error, setError] = useState<string | null>(null)

  const addDefault = () => {
    setError(null)
    if (!exerciseId) {
      setError("Choose a workout.")
      return
    }

    let schedule: WorkoutSchedule
    if (scheduleType === "every_day") {
      schedule = { type: "every_day" }
    } else if (scheduleType === "weekdays") {
      if (weekdays.length === 0) {
        setError("Pick at least one day of the week.")
        return
      }
      schedule = { type: "weekdays", days: [...weekdays].sort((a, b) => a - b) }
    } else {
      const n = Number.parseInt(everyDays, 10)
      if (!Number.isFinite(n) || n < 1) {
        setError("Interval must be at least 1 day.")
        return
      }
      schedule = {
        type: "interval",
        everyDays: n,
        startDate: localDateString(),
      }
    }

    const candidate: WorkoutDefault = {
      id: crypto.randomUUID(),
      exerciseId,
      schedule,
    }

    const overlap = findDefaultOverlap(defaults, candidate)
    if (overlap) {
      setError(overlap)
      return
    }

    onChange([...defaults, candidate])
    setExerciseId("")
    setError(null)
  }

  const removeDefault = (id: string) => {
    onChange(defaults.filter((d) => d.id !== id))
  }

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  return (
    <div className="grid gap-4 border-t pt-4">
      <div>
        <h3 className="text-sm font-semibold">Default workouts</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Automatically add workouts to your log when the schedule matches.
          Overlapping schedules for the same workout are not allowed.
        </p>
      </div>

      {defaults.length > 0 ? (
        <ul className="grid gap-2">
          {defaults.map((d) => {
            const ex = state.exercises.find((e) => e.id === d.exerciseId)
            return (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {ex?.name ?? "Unknown workout"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {scheduleSummary(d.schedule)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Remove default"
                  onClick={() => removeDefault(d.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No defaults yet.</p>
      )}

      <div className="grid gap-3 rounded-lg border p-3">
        <div className="grid gap-2">
          <Label htmlFor="default-exercise">Workout</Label>
          <select
            id="default-exercise"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {state.exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label>Schedule</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["every_day", "Every day"],
                ["weekdays", "Days of week"],
                ["interval", "Every X days"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={scheduleType === value ? "secondary" : "outline"}
                onClick={() => setScheduleType(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {scheduleType === "weekdays" ? (
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_LABELS.map((label, day) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={weekdays.includes(day) ? "secondary" : "outline"}
                className="min-w-10 px-2"
                onClick={() => toggleWeekday(day)}
              >
                {label}
              </Button>
            ))}
          </div>
        ) : null}

        {scheduleType === "interval" ? (
          <div className="grid gap-2">
            <Label htmlFor="every-days">Every N days</Label>
            <Input
              id="every-days"
              inputMode="numeric"
              value={everyDays}
              onChange={(e) => setEveryDays(e.target.value)}
              className="text-base"
            />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="button" variant="outline" onClick={addDefault}>
          Add default
        </Button>
      </div>
    </div>
  )
}
