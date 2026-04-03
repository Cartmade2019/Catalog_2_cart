export const PLAN_LIMITS = {
Free: {
  catalogs: 1,
  hotspotsTotal: 3,
  hotspotsPerPage: null,
  pdfSizeBytes: 5 * 1024 * 1024,
},
Basic: {
  catalogs: 5,
  hotspotsTotal: null,
  hotspotsPerPage: 3,
  pdfSizeBytes: 15 * 1024 * 1024,
},
Advance: {
  catalogs: 20,
  hotspotsTotal: null,
  hotspotsPerPage: Infinity,
  pdfSizeBytes: 50 * 1024 * 1024,
},
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

export function getPlanName(plan: any): PlanName {
  if (plan === "Basic") return "Basic";
  if (plan === "Advance") return "Advance";
  return "Free";
}
//test
export function getPlanLimits(plan: any) {
  const planName = getPlanName(plan);
  return PLAN_LIMITS[planName];
}

export function bytesToMB(bytes: number) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}