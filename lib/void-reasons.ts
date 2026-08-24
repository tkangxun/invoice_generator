export const VOID_REASONS = ["Human Error", "Refund", "Test"] as const;

export type VoidReason = (typeof VOID_REASONS)[number];

export function parseVoidReason(value?: string): VoidReason | "" {
  return VOID_REASONS.includes(value as VoidReason)
    ? (value as VoidReason)
    : "";
}
