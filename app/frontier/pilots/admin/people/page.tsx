import { redirect } from "next/navigation";

/** Previous route; users UI lives under `/frontier/pilots/admin/users`. */
export default function AdminPeoplePageRedirect() {
  redirect("/frontier/pilots/admin/users");
}
