// Bulk editors may change one catalog without clearing selections in the other.
// Read the preserved selection from the current state at mutation time.
export function scopedSelection(selectedIds: string[], editableIds: string[] | undefined, currentSelectedIds: string[]) {
  if (!editableIds) return new Set(selectedIds);
  const editable = new Set(editableIds);
  return new Set([
    ...currentSelectedIds.filter((id) => !editable.has(id)),
    ...selectedIds.filter((id) => editable.has(id)),
  ]);
}
