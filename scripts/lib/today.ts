/** Build date (YYYY-MM-DD). BUILD_DATE overrides it for reproducible runs. */
export function todayIso(): string {
  return process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
}
