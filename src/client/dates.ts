export interface DateRangeValue {
  preset: "7" | "14" | "30" | "90" | "custom";
  startDate: string;
  endDate: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Last N full days, ending yesterday (today's data is incomplete). */
export function presetRange(days: number, today = new Date()): { startDate: string; endDate: string } {
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: iso(start), endDate: iso(end) };
}

export const DATE_PRESETS: { value: DateRangeValue["preset"]; label: string; days?: number }[] = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "14", label: "Last 14 days", days: 14 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "custom", label: "Custom" },
];
