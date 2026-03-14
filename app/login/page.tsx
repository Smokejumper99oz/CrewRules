import { redirect } from "next/navigation";

/**
 * Login entry point. Redirects to the only live airline portal (Frontier Pilots).
 * To restore multi-airline role/airline chooser: replace this redirect with the
 * previous UI (see git history) and update AVAILABLE_AIRLINES.
 */
export default function LoginPage() {
  redirect("/frontier/pilots/login");
}
