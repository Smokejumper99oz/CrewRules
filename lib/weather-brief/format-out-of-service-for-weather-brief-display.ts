/**
 * Weather Brief UI: normalize "out of service" copy to Out-Of-Service for pilot-facing consistency.
 */
export function formatOutOfServiceForWeatherBriefDisplay(text: string): string {
  return text
    .replace(/\bout-of-service\b/gi, "Out-Of-Service")
    .replace(/\bout\s+of\s+service\b/gi, "Out-Of-Service");
}
