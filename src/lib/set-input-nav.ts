export function setInputId(
  exerciseId: string,
  setIndex: number | "draft",
  field: "reps" | "lbs"
) {
  return `set-${exerciseId}-${setIndex}-${field}`
}

export function focusSetInput(
  exerciseId: string,
  setIndex: number | "draft",
  field: "reps" | "lbs"
) {
  const el = document.getElementById(setInputId(exerciseId, setIndex, field))
  if (el instanceof HTMLInputElement) el.focus()
}

export function isAdvanceKey(e: React.KeyboardEvent) {
  return e.key === "Enter" || e.key === "Go" || e.key === "Next"
}

export function handleSetFieldKeyDown(
  e: React.KeyboardEvent,
  exerciseId: string,
  setIndex: number | "draft",
  field: "reps" | "lbs",
  onAfterLbs?: () => void
) {
  if (!isAdvanceKey(e)) return
  e.preventDefault()
  if (field === "reps") {
    focusSetInput(exerciseId, setIndex, "lbs")
  } else {
    onAfterLbs?.()
  }
}
