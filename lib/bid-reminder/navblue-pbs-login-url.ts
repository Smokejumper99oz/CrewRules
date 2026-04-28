/**
 * NAVBLUE PBS webapp login URL per airline tenant.
 * Add entries as additional tenants go live with PBS on NAVBLUE.
 */
const NAVBLUE_PBS_LOGIN_URL_BY_TENANT: Partial<Record<string, string>> = {
  frontier: "https://fft.pbs.vmc.navblue.cloud/webapp/#/login",
};

export function getNavbluePbsLoginUrl(tenant: string): string | undefined {
  const key = tenant.trim().toLowerCase();
  return NAVBLUE_PBS_LOGIN_URL_BY_TENANT[key];
}
