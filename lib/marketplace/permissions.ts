import type { MarketplacePermission } from './types';

/** Default operator session grants — still not a free pass for approval-gated sends. */
export const OPERATOR_DEFAULT_PERMISSIONS: readonly MarketplacePermission[] = [
  'research.read',
  'files.read',
  'files.write',
  'email.read',
  'email.send',
  'calendar.read',
  'calendar.write',
  'crm.read',
  'crm.write',
  'social.publish',
  'github.write',
  'github.read',
  'content.write',
  'media.generate',
  'automation.execute',
  'webhooks.receive',
  'ai.invoke',
  'storage.read',
  'storage.write',
  'internal.mock',
] as const;

export function hasAllPermissions(
  granted: readonly MarketplacePermission[],
  required: readonly MarketplacePermission[],
): boolean {
  const set = new Set(granted);
  return required.every((p) => set.has(p));
}

export function missingPermissions(
  granted: readonly MarketplacePermission[],
  required: readonly MarketplacePermission[],
): MarketplacePermission[] {
  const set = new Set(granted);
  return required.filter((p) => !set.has(p));
}
