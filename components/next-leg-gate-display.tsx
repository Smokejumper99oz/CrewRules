export type NextLegGateUiProps =
  | { variant: "teaser" }
  | { variant: "pro"; departureGate: string | null; arrivalGate: string | null }
  | { variant: "proPlaceholder" };

/** Inline gate copy on the flight line (operational detail, includes leading •). */
export function LegGateFlightLineSuffix({
  gateUi,
  size = "sm",
}: {
  gateUi: NextLegGateUiProps;
  size?: "sm" | "xs";
}) {
  const cls =
    size === "xs"
      ? "text-xs font-normal text-slate-300 dark:text-slate-300"
      : "text-sm font-normal text-slate-300 dark:text-slate-300";
  if (gateUi.variant === "teaser") {
    return <span className={cls}>• Gates 🔒 Pro</span>;
  }
  if (gateUi.variant === "proPlaceholder") {
    return <span className={cls}>• Gates: TBA</span>;
  }
  const dep = (gateUi.departureGate ?? "").trim();
  const arr = (gateUi.arrivalGate ?? "").trim();
  if (dep && arr) {
    return (
      <span className={cls}>
        • Gates: Dep {dep} / Arr {arr}
      </span>
    );
  }
  if (dep) {
    return <span className={cls}>• Gate: Dep {dep}</span>;
  }
  if (arr) {
    return <span className={cls}>• Gate: Arr {arr}</span>;
  }
  return null;
}
