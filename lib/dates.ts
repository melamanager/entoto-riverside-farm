// Farm-local calendar dates. The farm operates in Africa/Addis_Ababa (UTC+3);
// using toISOString() would roll "today" back to yesterday between 00:00-03:00 local.
export function todayAddis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa" }).format(new Date());
}
