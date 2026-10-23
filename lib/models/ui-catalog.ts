import { CANONICAL_BOTS } from '../bots/definitions';

export type ModelOption = {
  id: string;
  label: string;
  meta: string;
  /** Only the Manager is user-selectable; specialists are reached through MIAN routing. */
  selectable: boolean;
};

export const MANAGER_OPTION: ModelOption = {
  id: 'manager-auto',
  label: 'HarvYX Bot · Auto',
  meta: 'MIAN routes each message to the right specialist',
  selectable: true,
};

export const SPECIALIST_OPTIONS: ModelOption[] = CANONICAL_BOTS.filter((b) => b.slug !== 'mian').map(
  (b) => ({
    id: `specialist-${b.slug}`,
    label: b.name,
    meta: `${b.modelPolicy.tier} tier · routed by MIAN`,
    selectable: false,
  }),
);
