import { redirect } from "next/navigation";
import { FRONTIER_PILOTS_PORTAL_SETTINGS_DEFAULT_PATH } from "@/lib/frontier-pilots-portal-settings-default";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProfilePage({ searchParams }: Props) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`${FRONTIER_PILOTS_PORTAL_SETTINGS_DEFAULT_PATH}${suffix}`);
}
