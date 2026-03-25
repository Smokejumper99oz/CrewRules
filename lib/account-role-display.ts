export function getAccountRoleDisplay({
  role,
  is_admin,
  is_mentor,
}: {
  role?: string | null;
  is_admin?: boolean | null;
  is_mentor?: boolean | null;
}) {
  if (role === "super_admin") {
    return {
      label: "Platform Owner",
      badges: [] as string[],
      combined: "Platform Owner",
    };
  }

  const base =
    role === "flight_attendant" ? "Flight Attendant" : "Pilot";

  const badges: string[] = [];

  if (is_admin) badges.push("Admin");
  if (is_mentor) badges.push("Mentor");

  return {
    label: base,
    badges,
    combined:
      badges.length > 0
        ? `${base} · ${badges.join(" · ")}`
        : base,
  };
}

export function getAccountRoleBadges({
  role,
  is_admin,
  is_mentor,
}: {
  role?: string | null;
  is_admin?: boolean | null;
  is_mentor?: boolean | null;
}) {
  if (role === "super_admin") {
    return { baseLabel: "Platform Owner", badges: [] as string[] };
  }

  const baseLabel =
    role === "flight_attendant" ? "Flight Attendant" : "Pilot";

  const badges: string[] = [];
  if (is_admin) badges.push("Admin");
  if (is_mentor) badges.push("Mentor");

  return { baseLabel, badges };
}
