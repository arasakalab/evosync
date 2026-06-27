/** Intervalos de polling centralizado (ms). */
export const SYNC_INTERVALS = {
  connection: 5_000,
  sentHistory: 5_000,
  contacts: 15_000,
  schedules: 15_000,
  settings: 30_000,
  qr: 2_000,
} as const;
