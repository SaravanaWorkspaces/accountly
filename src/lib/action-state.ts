/**
 * Shared shape for the form actions. Kept out of `actions.ts` because a
 * `"use server"` module may only export async functions.
 */

/** `savedAt` changes on every successful save so the UI can react to it. */
export type ActionState = { error: string | null; savedAt?: number };

export const idleState: ActionState = { error: null };
