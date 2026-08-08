/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Build-time feature switches.
 *
 * `shop` is off while the rewards/points economy is being rethought. Nothing
 * was deleted: ShopView, RewardsView, constants/rewards.ts and the whole
 * points ledger (adjustBalance, computeTaskPoints, the penalty scheduler)
 * stay intact and keep running. Flipping this back to `true` restores the
 * navbar entry and the on-note balance indicator exactly as they were.
 */
export const FEATURES = {
  shop: false,
} as const;
