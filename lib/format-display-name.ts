export function formatDisplayName(name: string | null | undefined): string {
  if (!name) return "";

  const trimmed = name.trim();

  // If it's an email, return as-is
  if (trimmed.includes("@")) return trimmed;

  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (!word) return word;

      // Handle hyphenated names
      return word
        .split("-")
        .map(
          (part) =>
            part.charAt(0).toUpperCase() + part.slice(1)
        )
        .join("-");
    })
    .join(" ");
}
