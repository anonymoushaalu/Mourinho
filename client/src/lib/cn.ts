type ClassValue = string | false | null | undefined;

/** Joins truthy class fragments. A dependency this small isn't worth pulling in `clsx` for. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
