import { redirect } from "next/navigation";
import { FRONTIER_PILOTS_PORTAL_SETTINGS_DEFAULT_PATH } from "@/lib/frontier-pilots-portal-settings-default";

export default function SettingsIndexPage() {
  redirect(FRONTIER_PILOTS_PORTAL_SETTINGS_DEFAULT_PATH);
}
