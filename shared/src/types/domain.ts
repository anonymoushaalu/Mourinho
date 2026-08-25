/**
 * Domain vocabulary shared by both runtimes.
 *
 * Branded IDs stop one entity's identifier being passed where another's is
 * expected — a class of bug that plain `string` aliases cannot catch.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;

/** ISO-8601 UTC timestamp, e.g. `2026-08-03T10:58:00Z`. */
export type IsoTimestamp = Brand<string, 'IsoTimestamp'>;

export const asUserId = (value: string): UserId => value as UserId;
export const asIsoTimestamp = (value: string): IsoTimestamp => value as IsoTimestamp;
