/**
 * A card's place in a list is a number between its neighbours, so moving one
 * card writes one row instead of renumbering everything after it.
 */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) {
    return 1;
  }
  if (before === undefined) {
    return (after ?? 0) - 1;
  }
  if (after === undefined) {
    return before + 1;
  }
  return (before + after) / 2;
}
