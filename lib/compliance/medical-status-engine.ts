/**
 * Shared medical compliance rule engine (static rules only).
 * Not wired to UI, database, or routes.
 */

export type MedicalClass = "first" | "second" | "third";
export type PilotOperationType = "part_121" | "part_135" | "part_91";
export type PilotDutyRole = "captain" | "pic" | "fo" | "sic";

export type MedicalOperationalStatus = "ready" | "warning" | "not_ready";

export type OperatorUploadRule = {
  /** Calendar day in the month of the operational expiration (e.g. 25 → due on the 25th of that month). */
  uploadDueDayOfExpirationMonth?: number;
  /** Days before `operatorUploadDueDate` when status should warn (e.g. 28). */
  warningDaysBeforeUploadDue?: number;
};

export type CalculateMedicalStatusInput = {
  medicalClassIssued: MedicalClass;
  examDate: Date | string;
  dateOfBirth: Date | string;
  operationType: PilotOperationType;
  dutyRole: PilotDutyRole;
  /** Defaults to today (UTC calendar date) when omitted. */
  asOfDate?: Date | string;
  operatorUploadRule?: OperatorUploadRule;
};

export type OperatorUploadStatus = "not_required" | "upcoming" | "due_soon" | "overdue";

export type MedicalStatusResult = {
  status: MedicalOperationalStatus;
  activeClass: MedicalClass | "expired";
  firstClassValidUntil: Date;
  secondClassValidUntil: Date;
  thirdClassValidUntil: Date;
  message: string;
  operatorUploadDueDate: Date | null;
  operatorUploadStatus: OperatorUploadStatus;
};

/** Calendar date at UTC midnight. */
function toUtcDateOnly(input: Date | string): Date {
  if (input instanceof Date) {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const s = String(input).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Full years completed on `onDate` (UTC calendar). */
function calculateAgeOnDate(dateOfBirth: Date, onDate: Date): number {
  let age = onDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const dm = onDate.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (dm < 0 || (dm === 0 && onDate.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Last instant of the month that is `monthsAfterExamMonth` months after the exam's month
 * (exam month = 0). E.g. Jan 2024 exam + 6 → end of July 2024 UTC.
 */
function endOfMonthAfterMonths(examDate: Date, monthsAfterExamMonth: number): Date {
  const y = examDate.getUTCFullYear();
  const m = examDate.getUTCMonth();
  const total = m + monthsAfterExamMonth;
  const newY = y + Math.floor(total / 12);
  const newM = ((total % 12) + 12) % 12;
  return new Date(Date.UTC(newY, newM + 1, 0, 23, 59, 59, 999));
}

/** True if `a` is on or before `b` (UTC date-only comparison). */
function isOnOrBefore(a: Date, b: Date): boolean {
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return da <= db;
}

/** True if `a` is strictly after `b` (UTC date-only). */
function isAfter(a: Date, b: Date): boolean {
  return !isOnOrBefore(a, b);
}

function isBefore(a: Date, b: Date): boolean {
  return utcDayNumber(a) < utcDayNumber(b);
}

function utcDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000);
}

function addUtcCalendarDays(d: Date, deltaDays: number): Date {
  const n = utcDayNumber(d) + deltaDays;
  return new Date(n * 86_400_000);
}

function daysInUTCMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * Operator upload due: `uploadDueDay` in the same calendar month/year as `operationalExpiration`
 * (FAA end-of-month expiry; month/year taken from that instant).
 */
function operatorDueDateInExpirationMonth(operationalExpiration: Date, uploadDueDay: number): Date {
  const y = operationalExpiration.getUTCFullYear();
  const m = operationalExpiration.getUTCMonth();
  const dim = daysInUTCMonth(y, m);
  const day = Math.min(Math.max(1, Math.floor(uploadDueDay)), dim);
  return new Date(Date.UTC(y, m, day));
}

function formatOperatorDueMonthDay(d: Date): string {
  const short = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${short[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function computeThirdClassMonthsAfterExam(ageOnExam: number): number {
  return ageOnExam < 40 ? 60 : 24;
}

function resolveActiveClass(
  issued: MedicalClass,
  asOf: Date,
  firstUntil: Date,
  secondUntil: Date,
  thirdUntil: Date,
): MedicalClass | "expired" {
  const chain =
    issued === "first"
      ? [
          { cls: "first" as const, until: firstUntil },
          { cls: "second" as const, until: secondUntil },
          { cls: "third" as const, until: thirdUntil },
        ]
      : issued === "second"
        ? [
            { cls: "second" as const, until: secondUntil },
            { cls: "third" as const, until: thirdUntil },
          ]
        : [{ cls: "third" as const, until: thirdUntil }];

  for (const { cls, until } of chain) {
    if (isOnOrBefore(asOf, until)) {
      return cls;
    }
  }
  return "expired";
}

function isPicRole(role: PilotDutyRole): boolean {
  return role === "captain" || role === "pic";
}

function isFoRole(role: PilotDutyRole): boolean {
  return role === "fo" || role === "sic";
}

function operationalExpirationForUploadRule(
  dutyRole: PilotDutyRole,
  firstClassValidUntil: Date,
  secondClassValidUntil: Date,
): Date | null {
  if (isPicRole(dutyRole)) {
    return firstClassValidUntil;
  }
  if (isFoRole(dutyRole)) {
    return secondClassValidUntil;
  }
  return null;
}

function faaOperationalStillValid(status: MedicalOperationalStatus): boolean {
  return status === "ready" || status === "warning";
}

/**
 * Applies simplified FAA-style medical validity from a single exam date and issued class.
 * Third class never yields operational "ready" for Part 121/135/91 in this engine.
 */
export function calculateMedicalStatus(input: CalculateMedicalStatusInput): MedicalStatusResult {
  const examDate = toUtcDateOnly(input.examDate);
  const dateOfBirth = toUtcDateOnly(input.dateOfBirth);
  const asOfDate = input.asOfDate != null ? toUtcDateOnly(input.asOfDate) : toUtcDateOnly(new Date());

  const ageOnExam = calculateAgeOnDate(dateOfBirth, examDate);
  const firstMonths = ageOnExam >= 40 ? 6 : 12;
  const firstClassValidUntil = endOfMonthAfterMonths(examDate, firstMonths);
  const secondClassValidUntil = endOfMonthAfterMonths(examDate, 12);
  const thirdMonths = computeThirdClassMonthsAfterExam(ageOnExam);
  const thirdClassValidUntil = endOfMonthAfterMonths(examDate, thirdMonths);

  const activeClass = resolveActiveClass(
    input.medicalClassIssued,
    asOfDate,
    firstClassValidUntil,
    secondClassValidUntil,
    thirdClassValidUntil,
  );

  const firstOk = isOnOrBefore(asOfDate, firstClassValidUntil);
  const secondOk = isOnOrBefore(asOfDate, secondClassValidUntil);

  let status: MedicalOperationalStatus = "not_ready";
  let message = "";

  const commercialOps = ["part_121", "part_135", "part_91"] as const;
  const isCommercialContext = commercialOps.includes(input.operationType);

  if (isCommercialContext && input.medicalClassIssued === "third") {
    status = "not_ready";
    message =
      "Third class medical does not support operational readiness for Part 121/135/91 in this model.";
  } else if (isPicRole(input.dutyRole)) {
    if (input.medicalClassIssued !== "first") {
      status = "not_ready";
      message = "Captain/PIC requires a First Class medical certificate.";
    } else if (!firstOk) {
      status = "not_ready";
      message = "First Class medical is expired; Captain/PIC is not operationally ready.";
    } else {
      status = "ready";
      message = "First Class medical is active; Captain/PIC is operationally ready.";
    }
  } else if (isFoRole(input.dutyRole)) {
    if (input.medicalClassIssued === "third") {
      status = "not_ready";
      message = "FO/SIC requires at least Second Class medical for Part 121/135/91 in this model.";
    } else if (input.medicalClassIssued === "second") {
      if (!secondOk) {
        status = "not_ready";
        message = "Second Class medical is expired; FO/SIC is not operationally ready.";
      } else {
        status = "ready";
        message = "Second Class medical is active; FO/SIC is operationally ready.";
      }
    } else {
      // issued first
      if (firstOk) {
        status = "ready";
        message = "First Class medical is active; FO/SIC is operationally ready.";
      } else if (secondOk) {
        status = "warning";
        message =
          "First Class period has ended; operating on Second Class privileges. FO/SIC may continue with warning until Second expires.";
      } else {
        status = "not_ready";
        message = "First and Second Class medical periods have ended; FO/SIC is not operationally ready.";
      }
    }
  } else {
    status = "not_ready";
    message = "Unsupported duty role for medical readiness in this engine.";
  }

  const uploadDay = input.operatorUploadRule?.uploadDueDayOfExpirationMonth;
  const warnDays = input.operatorUploadRule?.warningDaysBeforeUploadDue;
  const opExp = operationalExpirationForUploadRule(
    input.dutyRole,
    firstClassValidUntil,
    secondClassValidUntil,
  );

  let operatorUploadDueDate: Date | null = null;
  let operatorUploadStatus: OperatorUploadStatus = "not_required";

  if (uploadDay != null && opExp != null) {
    operatorUploadDueDate = operatorDueDateInExpirationMonth(opExp, uploadDay);

    if (isAfter(asOfDate, operatorUploadDueDate)) {
      operatorUploadStatus = "overdue";
      if (faaOperationalStillValid(status)) {
        status = "warning";
        message = `${message} Medical upload is overdue per operator policy; FAA medical remains valid.`.trim();
      } else {
        status = "not_ready";
        message = `${message} Medical upload is overdue per operator policy.`.trim();
      }
    } else if (
      warnDays != null &&
      warnDays > 0 &&
      isOnOrBefore(asOfDate, operatorUploadDueDate)
    ) {
      const windowStart = addUtcCalendarDays(operatorUploadDueDate, -warnDays);
      if (!isBefore(asOfDate, windowStart)) {
        operatorUploadStatus = "due_soon";
        const duePhrase = formatOperatorDueMonthDay(operatorUploadDueDate);
        const uploadMsg = `Medical upload due by ${duePhrase} per operator policy.`;
        if (status === "ready" || status === "warning") {
          const priorMessage = message;
          status = "warning";
          message = `${priorMessage} ${uploadMsg}`.trim();
        }
      } else {
        operatorUploadStatus = "upcoming";
      }
    } else {
      operatorUploadStatus = "upcoming";
    }
  }

  return {
    status,
    activeClass,
    firstClassValidUntil,
    secondClassValidUntil,
    thirdClassValidUntil,
    message,
    operatorUploadDueDate,
    operatorUploadStatus,
  };
}
