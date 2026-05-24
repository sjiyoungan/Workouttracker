import { dateFromYmd, type WorkoutDefault, type WorkoutSchedule } from "@/lib/workout-model"

export function scheduleMatchesDate(
  schedule: WorkoutSchedule,
  dateStr: string
): boolean {
  const d = dateFromYmd(dateStr)
  switch (schedule.type) {
    case "every_day":
      return true
    case "weekdays": {
      const day = d.getDay()
      return schedule.days.includes(day)
    }
    case "interval": {
      const every = Math.max(1, Math.floor(schedule.everyDays))
      const anchor = dateFromYmd(schedule.startDate)
      const diffMs = d.getTime() - anchor.getTime()
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
      if (diffDays < 0) return false
      return diffDays % every === 0
    }
    default:
      return false
  }
}

/** True if both schedules would apply on at least one calendar day (within 400 days). */
export function schedulesOverlap(a: WorkoutSchedule, b: WorkoutSchedule): boolean {
  if (a.type === "every_day" || b.type === "every_day") return true

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  for (let i = 0; i < 400; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const y = d.getFullYear()
    const m = `${d.getMonth() + 1}`.padStart(2, "0")
    const day = `${d.getDate()}`.padStart(2, "0")
    const ymd = `${y}-${m}-${day}`
    if (scheduleMatchesDate(a, ymd) && scheduleMatchesDate(b, ymd)) return true
  }
  return false
}

export function findDefaultOverlap(
  defaults: WorkoutDefault[],
  candidate: WorkoutDefault
): string | null {
  for (const existing of defaults) {
    if (existing.id === candidate.id) continue
    if (existing.exerciseId !== candidate.exerciseId) continue
    if (schedulesOverlap(existing.schedule, candidate.schedule)) {
      return "This exercise already has a default with an overlapping schedule."
    }
  }
  return null
}

export function scheduleSummary(schedule: WorkoutSchedule): string {
  switch (schedule.type) {
    case "every_day":
      return "Every day"
    case "weekdays": {
      const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      const days = [...schedule.days].sort((a, b) => a - b)
      return days.map((d) => labels[d]).join(", ")
    }
    case "interval":
      return schedule.everyDays === 1
        ? "Every day"
        : `Every ${schedule.everyDays} days`
    default:
      return ""
  }
}
