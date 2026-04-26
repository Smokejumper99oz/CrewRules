"use client";

import { calculateMedicalStatus } from "@/lib/compliance/medical-status-engine";
import { AIRCRAFT_HERO_IMAGE_SPECS } from "@/lib/ops/aircraft-hero-image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CircleCheck,
  Clock,
  Cloud,
  Droplets,
  Eye,
  Flag,
  Fuel,
  Info,
  MessageCircle,
  Plane,
  PlaneTakeoff,
  Stethoscope,
  Sun,
  Upload,
  Users,
  Wind,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  resetDemo135AircraftHeroAction,
  uploadDemo135AircraftHeroAction,
} from "./upload-aircraft-hero-action";
import { useDemoOpsView } from "./demo-ops-view-context";

const CARD = "overflow-hidden rounded-sm border border-slate-200 bg-white shadow-xl shadow-slate-900/10";
const CARD_HEAD = "bg-gradient-to-r from-[#102b46] to-[#173c5f] px-4 py-3";
const CARD_BODY = "p-4 sm:p-5";
const SECTION_TITLE = "font-serif text-xl font-bold text-[#17324d] md:text-2xl";
const LINK =
  "text-sm font-semibold text-[#102b46] underline decoration-[#102b46]/35 underline-offset-2 transition hover:text-amber-800 hover:decoration-amber-700/50";
const BTN_PRIMARY =
  "w-full rounded-sm bg-gradient-to-b from-amber-300 to-amber-500 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-black/20 transition hover:brightness-110";
const BTN_SECONDARY =
  "w-full rounded-sm border-2 border-slate-300 bg-white py-2.5 text-sm font-bold text-[#17324d] shadow-sm transition hover:bg-slate-50";

function formatUtcDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const DEMO_MEDICAL_FIELD =
  "mt-1 w-full rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-[#333333] shadow-sm read-only:bg-[#fafbfc] focus:outline-none focus:ring-1 focus:ring-[#102b46]/25";
const DEMO_MEDICAL_LABEL = "text-xs font-semibold text-[#17324d]";

const OPS_SNAPSHOT = [
  {
    label: "Pilots Active Today",
    value: "12",
    sub: "of 15 total pilots",
    Icon: Users,
    iconWrap: "bg-amber-100 text-[#102b46]",
    spark: "text-amber-600",
    sparkPath: "M0 28 L12 18 L24 26 L36 14 L48 22 L60 16 L72 20",
  },
  {
    label: "Flights Scheduled",
    value: "12",
    sub: "for today",
    Icon: Calendar,
    iconWrap: "bg-[#e8f0f7] text-[#17324d]",
    spark: "text-[#102b46]",
    sparkPath: "M0 24 L14 32 L28 12 L42 22 L56 8 L70 18 L72 14",
  },
  {
    label: "Aircraft Available",
    value: "5 / 7",
    sub: "in service",
    Icon: Plane,
    iconWrap: "bg-[#f1f5f9] text-[#17324d]",
    spark: "text-[#17324d]",
    sparkPath: "M0 30 L16 22 L32 30 L48 10 L64 24 L72 12",
  },
  {
    label: "Alerts / Flags",
    value: "3",
    sub: "Requires Attention",
    valueClass: "text-red-600",
    Icon: Flag,
    iconWrap: "bg-red-100 text-red-600",
    spark: "text-red-500",
    sparkPath: "M0 26 L18 34 L36 16 L54 28 L72 8",
  },
] as const;

const SCHEDULE_ROWS = [
  { status: "Departing Today", flights: 12, pilots: 12, coverage: "100%", dot: "bg-emerald-500" },
  { status: "On Time", flights: 9, pilots: 9, coverage: "100%", dot: "bg-emerald-500" },
  { status: "Delayed", flights: 2, pilots: 2, coverage: "100%", dot: "bg-amber-400" },
  { status: "Cancelled", flights: 1, pilots: 0, coverage: "—", dot: "bg-red-500" },
] as const;

const OPS_BRIEF = [
  { title: "Pilot readiness", detail: "4 pilots need review" },
  { title: "Fleet", detail: "N135CR in maintenance" },
  { title: "Schedule", detail: "2 open trips" },
] as const;

const PILOT_ROWS = [
  {
    name: "James Wilson",
    line: "ATP · HS-125",
    status: "Ready",
    statusStyle: "bg-emerald-100 text-emerald-800",
    medical: "First Class · Exp. 05/15/2026",
    certs: "Current",
    training: "Current",
    flags: "—",
    flagTone: "",
  },
  {
    name: "Sarah Chen",
    line: "ATP · DA-2000",
    status: "Review",
    statusStyle: "bg-amber-100 text-amber-800",
    medical: "First Class · Exp. 02/01/2026",
    certs: "LOE due in 14 days",
    training: "Current",
    flags: "Training window",
    flagTone: "text-amber-700",
  },
  {
    name: "Marcus Reid",
    line: "ATP · G-IV",
    status: "Not Ready",
    statusStyle: "bg-red-100 text-red-800",
    medical: "Medical expired",
    certs: "IPC overdue",
    training: "Recurrent due",
    flags: "3 items",
    flagTone: "text-red-600",
  },
] as const;

/** Admin table: James Wilson medical after demo pilot confirms uploaded FAA medical (matches engine First Class end date). */
const JAMES_WILSON_MEDICAL_AFTER_CONFIRM = "First Class · Exp. 11/30/2025";

const ALERT_ITEMS = [
  {
    title: "Fatigue Risk Alert",
    time: "18m ago",
    tone: "border-l-red-500 bg-red-50/80",
    icon: "flag",
  },
  {
    title: "Maintenance Alert",
    time: "1h ago",
    tone: "border-l-amber-500 bg-amber-50/60",
    icon: "warn",
  },
  {
    title: "Schedule Alert",
    time: "2h ago",
    tone: "border-l-[#102b46] bg-[#e8f0f7]/90",
    icon: "info",
  },
] as const;

/** Static demo row for the in-page profile preview card (matches Pilot Readiness table). */
const PILOT_PROFILE_PREVIEW_DEMO = PILOT_ROWS[0];

function MiniSparkline({ pathD, className }: { pathD: string; className: string }) {
  return (
    <svg className={`h-10 w-[72px] shrink-0 ${className}`} viewBox="0 0 72 40" fill="none" aria-hidden>
      <path d={pathD} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FleetDonut() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              #22c55e 0deg ${(5 / 7) * 360}deg,
              #f97316 ${(5 / 7) * 360}deg ${(6 / 7) * 360}deg,
              #ef4444 ${(6 / 7) * 360}deg 360deg
            )`,
          }}
        />
        <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner shadow-slate-200/50">
          <p className="text-2xl font-bold text-[#17324d]">7</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">Total aircraft</p>
        </div>
      </div>
      <ul className="grid w-full gap-2 text-xs sm:grid-cols-2">
        <li className="flex items-center gap-2 text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          5 Available
        </li>
        <li className="flex items-center gap-2 text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          1 In maintenance
        </li>
        <li className="flex items-center gap-2 text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          1 Deferred
        </li>
        <li className="flex items-center gap-2 text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          0 Out of service
        </li>
      </ul>
      <button type="button" className={LINK}>
        View fleet overview →
      </button>
    </div>
  );
}

function AlertRowIcon({ kind }: { kind: string }) {
  if (kind === "flag") {
    return (
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-red-100 text-red-600">
        <Flag className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  if (kind === "warn") {
    return (
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-amber-100 text-amber-700">
        <AlertTriangle className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#e8f0f7] text-[#102b46]">
      <Info className="h-4 w-4" aria-hidden />
    </span>
  );
}

/** Pilot preview dashboard — static next-trip line (hero, schedule, etc.). */
const PILOT_PREVIEW_SCHEDULE = {
  route: "TPA → SJD",
  destination: "Cabo San Lucas",
  dateDisplay: "May 20, 2025",
  reportLocal: "08:30 local",
  aircraft: "HS-125",
} as const;

const PILOT_PREVIEW_NEXT_TRIP = `${PILOT_PREVIEW_SCHEDULE.route} / ${PILOT_PREVIEW_SCHEDULE.destination}`;

/** Destination weather (demo) — matches pilot preview next trip arrival. */
const PILOT_PREVIEW_WEATHER_SJD = {
  tempC: "27°C",
  condition: "Partly Cloudy",
  windKt: "12 kt",
  visibility: "10 sm",
  humidity: "60%",
} as const;

const PILOT_PREVIEW_FBO_BY_LEG = {
  departure: {
    code: "TPA",
    title: "Tampa International Airport",
    icaoLine: "TAMPA INTERNATIONAL (TPA)",
    badges: "NBAA, IS-BAH, 24/7",
    services: "Fuel, Handling, Customs",
  },
  arrival: {
    code: "SJD",
    title: "San Jose del Cabo International Airport",
    icaoLine: "AEROPUERTO INTERNACIONAL LOS CABOS (SJD)",
    badges: "NBAA, IS-BAH, 24/7",
    services: "Fuel, Handling, Customs",
  },
} as const;

const PILOT_HERO_BRIEF_LABEL = "text-[10px] font-bold uppercase tracking-[0.14em] text-white/45";
const PILOT_HERO_META = "text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40";

const PILOT_PROFILE_FIELD =
  "w-full cursor-not-allowed rounded-sm border border-slate-200 bg-[#f1f5f9] px-3 py-2 text-sm text-[#333333] shadow-inner shadow-slate-900/[0.06] opacity-95";

function PilotMyProfileView() {
  const { setPilotSubView } = useDemoOpsView();

  return (
    <div
      id="pilot-profile-preview"
      aria-labelledby="pilot-my-profile-heading"
      className="mx-auto max-w-3xl scroll-mt-6"
    >
      <h2 id="pilot-my-profile-heading" className={SECTION_TITLE}>
        My Profile
      </h2>
      <div className={`${CARD} mt-4`}>
        <div className={CARD_HEAD}>
          <h3 className="text-lg font-extrabold text-white">James Wilson</h3>
        </div>
        <div className={CARD_BODY}>
          <form className="space-y-8" onSubmit={(e) => e.preventDefault()} aria-label="Profile (demo, read-only)">
            <fieldset className="space-y-4 border-0 p-0">
              <legend className="mb-3 w-full border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide text-[#17324d]">
                Personal Information
              </legend>
              <div className="space-y-4">
                <div>
                  <label htmlFor="pilot-profile-full-name" className="mb-1 block text-xs font-semibold text-[#17324d]">
                    Full Name
                  </label>
                  <input
                    id="pilot-profile-full-name"
                    type="text"
                    className={PILOT_PROFILE_FIELD}
                    readOnly
                    disabled
                    value="James Wilson"
                  />
                </div>
                <div>
                  <label htmlFor="pilot-profile-role" className="mb-1 block text-xs font-semibold text-[#17324d]">
                    Role
                  </label>
                  <input
                    id="pilot-profile-role"
                    type="text"
                    className={PILOT_PROFILE_FIELD}
                    readOnly
                    disabled
                    value="Captain"
                  />
                </div>
                <div>
                  <label htmlFor="pilot-profile-aircraft" className="mb-1 block text-xs font-semibold text-[#17324d]">
                    Aircraft
                  </label>
                  <input
                    id="pilot-profile-aircraft"
                    type="text"
                    className={PILOT_PROFILE_FIELD}
                    readOnly
                    disabled
                    value="HS-125"
                  />
                </div>
                <div>
                  <label htmlFor="pilot-profile-base" className="mb-1 block text-xs font-semibold text-[#17324d]">
                    Base
                  </label>
                  <input
                    id="pilot-profile-base"
                    type="text"
                    className={PILOT_PROFILE_FIELD}
                    readOnly
                    disabled
                    value="TPA"
                  />
                </div>
                <div>
                  <label htmlFor="pilot-profile-phone" className="mb-1 block text-xs font-semibold text-[#17324d]">
                    Phone
                  </label>
                  <input
                    id="pilot-profile-phone"
                    type="text"
                    className={PILOT_PROFILE_FIELD}
                    readOnly
                    disabled
                    value="(813) 555-0198"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 border-0 p-0">
              <legend className="mb-3 w-full border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide text-[#17324d]">
                Contact Information
              </legend>
              <div className="space-y-4">
                <div>
                  <label htmlFor="pilot-profile-work-email" className="mb-1 block text-xs font-semibold text-[#17324d]">
                    Work Email
                  </label>
                  <input
                    id="pilot-profile-work-email"
                    type="email"
                    className={PILOT_PROFILE_FIELD}
                    readOnly
                    disabled
                    value="james.wilson@demo135ops.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pilot-profile-private-email"
                    className="mb-1 block text-xs font-semibold text-[#17324d]"
                  >
                    Private Email
                  </label>
                  <input
                    id="pilot-profile-private-email"
                    type="email"
                    className={PILOT_PROFILE_FIELD}
                    readOnly
                    disabled
                    value="james.wilson@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="pilot-profile-address" className="mb-1 block text-xs font-semibold text-[#17324d]">
                    Address
                  </label>
                  <textarea
                    id="pilot-profile-address"
                    className={`${PILOT_PROFILE_FIELD} min-h-[4.5rem] resize-none`}
                    readOnly
                    disabled
                    rows={3}
                    value="4751 Jim Walter Blvd, Tampa, FL 33607"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 border-0 p-0">
              <legend className="mb-3 w-full border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide text-[#17324d]">
                Compliance
              </legend>
              <div className="space-y-4">
                <div>
                  <label htmlFor="pilot-profile-emergency" className="mb-1 block text-xs font-semibold text-[#17324d]">
                    Emergency Contact
                  </label>
                  <input
                    id="pilot-profile-emergency"
                    type="text"
                    className={PILOT_PROFILE_FIELD}
                    readOnly
                    disabled
                    value="Sarah Wilson · (813) 555-0144"
                  />
                </div>
              </div>
            </fieldset>

            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-sm border border-slate-300 bg-slate-200 py-2.5 text-sm font-semibold text-slate-500"
            >
              Save Profile Changes
            </button>
          </form>

          <button
            type="button"
            className={`${LINK} mt-4 inline-flex`}
            onClick={() => setPilotSubView("medical-certifications")}
          >
            View Medical &amp; Certifications →
          </button>

          <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-relaxed text-[#666666]">
            Profile changes are reviewed before they update operational readiness.
          </p>
        </div>
      </div>
    </div>
  );
}

function PilotMedicalCertificationsView() {
  const { demoMedicalConfirmed, confirmDemoMedical } = useDemoOpsView();
  const [demoReviewOpen, setDemoReviewOpen] = useState(false);

  const demoMedicalResult = useMemo(
    () =>
      calculateMedicalStatus({
        medicalClassIssued: "first",
        examDate: "2025-05-05",
        dateOfBirth: "1978-08-12",
        operationType: "part_135",
        dutyRole: "captain",
        operatorUploadRule: {
          uploadDueDayOfExpirationMonth: 25,
          warningDaysBeforeUploadDue: 28,
        },
      }),
    [],
  );

  return (
    <div
      id="pilot-profile-preview"
      aria-labelledby="pilot-medical-cert-heading"
      className="mx-auto max-w-3xl scroll-mt-6"
    >
      <h2 id="pilot-medical-cert-heading" className={SECTION_TITLE}>
        Medical &amp; Certifications
      </h2>
      <div className={`${CARD} mt-4`}>
        <div className={CARD_HEAD}>
          <h3 className="text-lg font-extrabold text-white">Currency overview (demo)</h3>
        </div>
        <div className={CARD_BODY}>
          <div className="space-y-3 text-sm text-[#333333]">
            <p>
              <span className="font-semibold text-[#17324d]">Medical: </span>
              First Class · Exp. 05/15/2026
            </p>
            <p>
              <span className="font-semibold text-[#17324d]">Aircraft: </span>
              HS-125
            </p>
            <p>
              <span className="font-semibold text-[#17324d]">Training: </span>
              Current
            </p>
          </div>
          <p className="mt-4 text-xs text-[#666666]">Static demo — no data connection.</p>
        </div>
      </div>

      <div className={`${CARD} mt-4`}>
        <div className={`${CARD_HEAD} px-4 py-4 sm:px-5`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <h3 className="min-w-0 text-lg font-extrabold text-white">Upload Medical Certificate</h3>
            <button
              type="button"
              className={`${BTN_PRIMARY} w-full shrink-0 sm:w-auto sm:min-w-[14rem] sm:px-6`}
              onClick={() => {
                setDemoReviewOpen(true);
              }}
            >
              Use Demo FAA Medical
            </button>
          </div>
        </div>
        <div className={`${CARD_BODY} py-3 sm:py-3.5`}>
          <p className="text-xs leading-relaxed text-[#666666]">
            Simulate an AI-assisted review of an FAA medical certificate (demo — no file upload, no API).
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#17324d]">
            After confirmation, this medical certificate will be saved to your documents and shared with Ops Admin for
            compliance record keeping.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#666666]">Static demo — no storage or database.</p>
          {demoMedicalConfirmed ? (
            <div
              className="mt-4 rounded-sm border border-slate-200 bg-[#f6f8fb] px-3 py-3 text-sm text-[#333333] sm:px-4"
              role="status"
            >
              <p className="font-bold text-[#17324d]">FAA Medical Certificate</p>
              <p className="mt-1">
                <span className="font-semibold text-[#17324d]">First Class</span>
              </p>
              <p className="mt-1">
                <span className="font-semibold text-[#17324d]">Exam: </span>05/05/2025
              </p>
              <p className="mt-1 text-[#17324d]">
                <span className="font-semibold">Status: </span>Saved to pilot documents and Admin records
              </p>
            </div>
          ) : null}
          {demoReviewOpen ? (
            <div className="mt-5 space-y-5 border-t border-slate-200 pt-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#666666]">Extracted values (simulated)</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={DEMO_MEDICAL_LABEL} htmlFor="demo-med-pilot">
                      Pilot
                    </label>
                    <input id="demo-med-pilot" type="text" readOnly className={DEMO_MEDICAL_FIELD} defaultValue="James Wilson" />
                  </div>
                  <div>
                    <label className={DEMO_MEDICAL_LABEL} htmlFor="demo-med-class">
                      Medical class
                    </label>
                    <input id="demo-med-class" type="text" readOnly className={DEMO_MEDICAL_FIELD} defaultValue="First Class" />
                  </div>
                  <div>
                    <label className={DEMO_MEDICAL_LABEL} htmlFor="demo-med-dob">
                      Date of birth
                    </label>
                    <input id="demo-med-dob" type="text" readOnly className={DEMO_MEDICAL_FIELD} defaultValue="08/12/1978" />
                  </div>
                  <div>
                    <label className={DEMO_MEDICAL_LABEL} htmlFor="demo-med-exam">
                      Date of examination
                    </label>
                    <input
                      id="demo-med-exam"
                      type="text"
                      readOnly
                      className={DEMO_MEDICAL_FIELD}
                      defaultValue="05/05/2025"
                    />
                  </div>
                  <div>
                    <label className={DEMO_MEDICAL_LABEL} htmlFor="demo-med-limitation">
                      Limitation
                    </label>
                    <textarea
                      id="demo-med-limitation"
                      readOnly
                      rows={3}
                      className={`${DEMO_MEDICAL_FIELD} resize-none`}
                      defaultValue="Must use corrective lenses to meet vision standards at all required distances."
                    />
                  </div>
                  <div>
                    <label className={DEMO_MEDICAL_LABEL} htmlFor="demo-med-ekg">
                      EKG due
                    </label>
                    <input id="demo-med-ekg" type="text" readOnly className={DEMO_MEDICAL_FIELD} defaultValue="05/2026" />
                  </div>
                </div>
              </div>
              <div className="rounded-sm border border-slate-200 bg-[#f6f8fb] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#666666]">Calculated readiness (engine)</p>
                <dl className="mt-3 space-y-2 text-sm text-[#333333]">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                    <dt className="font-semibold text-[#17324d]">First Class valid until</dt>
                    <dd>{formatUtcDateLong(demoMedicalResult.firstClassValidUntil)}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                    <dt className="font-semibold text-[#17324d]">Operator upload due date</dt>
                    <dd>
                      {demoMedicalResult.operatorUploadDueDate
                        ? formatUtcDateLong(demoMedicalResult.operatorUploadDueDate)
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                    <dt className="font-semibold text-[#17324d]">Status</dt>
                    <dd className="capitalize">{demoMedicalResult.status.replace(/_/g, " ")}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#17324d]">Message</dt>
                    <dd className="mt-1 text-[#333333]">{demoMedicalResult.message}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:max-w-md">
                <button
                  type="button"
                  className={`${BTN_PRIMARY} sm:flex-1`}
                  onClick={() => {
                    confirmDemoMedical();
                    setDemoReviewOpen(false);
                  }}
                >
                  Confirm &amp; Save
                </button>
                <button
                  type="button"
                  className={`${BTN_SECONDARY} sm:flex-1`}
                  onClick={() => {
                    setDemoReviewOpen(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`${CARD} mt-4`}>
        <div className={`${CARD_HEAD} px-4 py-4 sm:px-5`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <img
                src="/icons/faa-logo.jpg"
                alt="FAA"
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 object-contain mix-blend-screen"
              />
              <h3 className="text-lg font-extrabold text-white">FAA MedXPress</h3>
            </div>
            <a
              href="https://medxpress.faa.gov/"
              target="_blank"
              rel="noreferrer"
              className={`${BTN_PRIMARY} inline-flex w-full shrink-0 items-center justify-center no-underline sm:w-auto sm:min-w-[14rem] sm:px-6`}
            >
              Open FAA MedXPress →
            </a>
          </div>
        </div>
        <div className={`${CARD_BODY} py-3 sm:py-3.5`}>
          <p className="text-xs leading-relaxed text-[#666666]">
            Start or update your FAA medical application before your AME visit.
          </p>
        </div>
      </div>
    </div>
  );
}

function PilotDocumentsView() {
  return (
    <div
      id="pilot-profile-preview"
      aria-labelledby="pilot-documents-heading"
      className="mx-auto max-w-3xl scroll-mt-6"
    >
      <h2 id="pilot-documents-heading" className={SECTION_TITLE}>
        Documents
      </h2>
      <div className={`${CARD} mt-4`}>
        <div className={CARD_HEAD}>
          <h3 className="text-lg font-extrabold text-white">Upload (demo)</h3>
        </div>
        <div className={CARD_BODY}>
          <div className="space-y-3 text-sm text-[#333333]">
            <p>Medical, invoice, or training document</p>
            <p>AI pre-fill available after upload</p>
            <p>Human confirmation required before save</p>
          </div>
          <button type="button" className={`${BTN_PRIMARY} mt-4 w-full max-w-xs`}>
            Upload Document
          </button>
          <p className="mt-4 text-xs text-[#666666]">Static demo — upload not connected.</p>
        </div>
      </div>
    </div>
  );
}

function PilotMessagesView() {
  return (
    <div
      id="pilot-profile-preview"
      aria-labelledby="pilot-messages-heading"
      className="mx-auto max-w-3xl scroll-mt-6"
    >
      <h2 id="pilot-messages-heading" className={SECTION_TITLE}>
        Messages
      </h2>
      <div className={`${CARD} mt-4`}>
        <div className={CARD_HEAD}>
          <h3 className="text-lg font-extrabold text-white">Contact ops (demo)</h3>
        </div>
        <div className={CARD_BODY}>
          <div className="space-y-3 text-sm text-[#333333]">
            <p>Secure messages to your ops team</p>
            <p>Typical reply during business hours</p>
            <p>Urgent duty changes: call dispatch</p>
          </div>
          <button type="button" className={`${LINK} mt-4 inline-flex text-left`}>
            Open messages →
          </button>
          <p className="mt-4 text-xs text-[#666666]">Static demo — messaging not connected.</p>
        </div>
      </div>
    </div>
  );
}

function PilotProfilePreviewDashboard({
  heroAircraftImageSrc,
  heroImageIsCustom,
  heroUpload,
}: {
  heroAircraftImageSrc: string;
  heroImageIsCustom: boolean;
  heroUpload: { tenant: string; tailNumber: string };
}) {
  const { setPilotSubView } = useDemoOpsView();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadPending, startUploadTransition] = useTransition();
  const [isResetPending, startResetTransition] = useTransition();
  const [heroRev, setHeroRev] = useState(0);
  const [fboLeg, setFboLeg] = useState<"departure" | "arrival">("departure");

  const showStandardHeroPill = heroImageIsCustom || heroRev > 0;
  const heroActionBusy = isUploadPending || isResetPending;

  const displayHeroSrc =
    heroRev > 0
      ? `${heroAircraftImageSrc}${heroAircraftImageSrc.includes("?") ? "&" : "?"}rev=${heroRev}`
      : heroAircraftImageSrc;

  const onPickHeroPhoto = () => {
    fileInputRef.current?.click();
  };

  const onHeroFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const mime = (file.type || "").toLowerCase();
    const allowed = AIRCRAFT_HERO_IMAGE_SPECS.allowedMimeTypes as readonly string[];
    if (!allowed.includes(mime)) {
      return;
    }
    if (file.size > AIRCRAFT_HERO_IMAGE_SPECS.maxFileBytes) {
      return;
    }

    startUploadTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("tenant", heroUpload.tenant);
        fd.set("tailNumber", heroUpload.tailNumber);
        const result = await uploadDemo135AircraftHeroAction(fd);
        if (!result.ok) {
          return;
        }
        setHeroRev(Date.now());
        router.refresh();
      } catch {}
    });
  };

  const onResetStandardHero = () => {
    startResetTransition(async () => {
      const result = await resetDemo135AircraftHeroAction(heroUpload.tenant, heroUpload.tailNumber);
      if (!result.ok) {
        return;
      }
      setHeroRev(0);
      router.refresh();
    });
  };

  return (
    <div
      id="pilot-profile-preview"
      aria-labelledby="pilot-dashboard-heading"
      className="mx-auto max-w-6xl scroll-mt-6"
    >
      <h2 id="pilot-dashboard-heading" className={SECTION_TITLE}>
        Dashboard
      </h2>

      <input
        ref={fileInputRef}
        type="file"
        accept={AIRCRAFT_HERO_IMAGE_SPECS.allowedMimeTypes.join(",")}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onHeroFileChange}
      />

      {/* 1. Hero — one card: full-bleed photo + navy gradient (no split panels) */}
      <div className="mt-4 overflow-hidden rounded-sm border border-slate-200 bg-[#102b46] shadow-xl shadow-slate-900/10">
        <div className="relative min-h-[300px] lg:min-h-[300px]">
          <img
            src={displayHeroSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_42%] lg:object-[56%_42%]"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(12,17,30,0.95)_0%,rgba(12,17,30,0.85)_40%,rgba(12,17,30,0.5)_65%,rgba(12,17,30,0.2)_85%,rgba(12,17,30,0.15)_100%)]"
            aria-hidden
          />
          <div className="absolute bottom-3 right-3 z-30 flex max-w-[min(100%-1.5rem,20rem)] flex-col items-end gap-2 sm:bottom-4 sm:right-4 sm:max-w-none sm:flex-row sm:justify-end sm:gap-2">
            {showStandardHeroPill ? (
              <button
                type="button"
                disabled={heroActionBusy}
                onClick={onResetStandardHero}
                className="rounded-md border border-white/45 bg-[#102b46]/40 px-2 py-1.5 text-left text-[10px] font-medium leading-snug text-white/95 shadow-sm backdrop-blur-[2px] transition hover:bg-[#102b46]/55 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#102b46] enabled:cursor-pointer disabled:cursor-wait disabled:opacity-65 sm:px-2.5 sm:text-[11px]"
              >
                {isResetPending ? "Restoring…" : "Use Stock Photo"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={heroActionBusy}
              onClick={onPickHeroPhoto}
              className="rounded-md bg-[#75C043]/20 px-2 py-1.5 text-left text-[10px] font-medium leading-snug text-white/95 ring-1 ring-[#75C043]/35 backdrop-blur-[2px] transition hover:bg-[#75C043]/32 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#75C043]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#102b46] enabled:cursor-pointer disabled:cursor-wait disabled:opacity-70 sm:px-2.5 sm:text-[11px]"
            >
              {isUploadPending ? "Uploading…" : "Update Photo"}
            </button>
          </div>
          <div className="relative z-10 flex min-h-[300px] flex-col lg:flex-row">
            <div className="flex flex-1 flex-col justify-between px-5 pb-14 pt-5 sm:px-6 lg:max-w-[63%] lg:py-6 lg:pb-6 lg:pl-7 lg:pr-10">
              <div>
                <p className="font-serif text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.65rem]">
                  Good morning, James.
                </p>
                <p className="mt-2 text-sm font-medium leading-snug text-sky-200/90">
                  Your next trip is {PILOT_PREVIEW_NEXT_TRIP}.
                </p>
                <p className="mt-3 text-sm text-white/65">Tuesday, May 20, 2025</p>
                <div className="mt-5 h-px w-full bg-white/18" aria-hidden />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-3 lg:mt-8 lg:gap-x-2">
                <div className="flex gap-2.5">
                  <PlaneTakeoff className="mt-0.5 h-4 w-4 shrink-0 text-white/75" aria-hidden />
                  <div className="min-w-0">
                    <p className={PILOT_HERO_BRIEF_LABEL}>Trip</p>
                    <p className="mt-2 text-base font-extrabold tracking-tight text-white sm:text-lg">TPA → SJD</p>
                    <p className={PILOT_HERO_META}>Destination</p>
                    <p className="mt-0.5 text-sm font-medium text-white/90">Cabo San Lucas</p>
                  </div>
                </div>
                <div className="flex gap-2.5 border-l border-white/15 pl-4 sm:pl-5">
                  <Plane className="mt-0.5 h-4 w-4 shrink-0 text-white/75" aria-hidden />
                  <div className="min-w-0">
                    <p className={PILOT_HERO_BRIEF_LABEL}>Aircraft</p>
                    <p className="mt-2 text-base font-extrabold tracking-tight text-white sm:text-lg">HS-125</p>
                  </div>
                </div>
                <div className="flex gap-2.5 border-l border-white/15 pl-4 sm:pl-5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white/75" aria-hidden />
                  <div className="min-w-0">
                    <p className={PILOT_HERO_BRIEF_LABEL}>Report</p>
                    <p className="mt-2 text-base font-extrabold tabular-nums tracking-tight text-white sm:text-lg">
                      08:30 local
                    </p>
                    <p className={PILOT_HERO_META}>Planned release</p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums text-white/90">16:45 local</p>
                  </div>
                </div>
                <div className="flex gap-2.5 border-l border-white/15 pl-4 sm:pl-5">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/75" aria-hidden />
                  <div className="min-w-0">
                    <p className={PILOT_HERO_BRIEF_LABEL}>Status</p>
                    <div className="mt-2">
                      <span className="inline-flex rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-emerald-900/30">
                        {PILOT_PROFILE_PREVIEW_DEMO.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-8 text-xs leading-relaxed text-white/50 lg:mt-10">
                Review weather, FBO details, and documents before departure.
              </p>
            </div>
            <div className="hidden min-w-0 flex-1 lg:block" aria-hidden />
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs leading-snug text-[#666666]">
        Hero Photo: Landscape about {AIRCRAFT_HERO_IMAGE_SPECS.recommendedWidthPx}×
        {AIRCRAFT_HERO_IMAGE_SPECS.recommendedHeightPx}px (roughly 2:1 height; at least{" "}
        {AIRCRAFT_HERO_IMAGE_SPECS.minWidthPx}px wide for a sharp banner). JPEG, PNG, or WebP, up to{" "}
        {AIRCRAFT_HERO_IMAGE_SPECS.maxFileBytes / (1024 * 1024)} MB.
      </p>

      {/* 2. Schedule + weather + FBO (three-up) */}
      <div className="mt-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 shrink-0 text-[#0f172a]" strokeWidth={2} aria-hidden />
                <h3 className="font-serif text-lg font-bold tracking-tight text-[#0f172a] sm:text-xl">
                  My Schedule
                </h3>
              </div>
              <div className="mt-3 h-px w-full bg-slate-200" aria-hidden />
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-4 sm:px-5 sm:py-5">
                <p className="inline-flex rounded border border-blue-600 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                  Next Trip
                </p>
                <p className="mt-3 text-2xl font-bold tracking-tight text-[#0f172a] sm:text-[1.65rem]">
                  {PILOT_PREVIEW_SCHEDULE.route}
                </p>
                <p className="mt-1 text-base font-normal text-[#0f172a]">{PILOT_PREVIEW_SCHEDULE.destination}</p>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium text-[#0f172a]">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-[#0f172a]/80" aria-hidden />
                    {PILOT_PREVIEW_SCHEDULE.dateDisplay}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-[#0f172a]/80" aria-hidden />
                    {PILOT_PREVIEW_SCHEDULE.reportLocal}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Plane className="h-4 w-4 shrink-0 text-[#0f172a]/80" aria-hidden />
                    {PILOT_PREVIEW_SCHEDULE.aircraft}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="mt-4 w-fit text-left text-sm font-semibold text-blue-600 underline decoration-blue-600/30 underline-offset-2 transition hover:text-blue-700 hover:decoration-blue-700/50"
              >
                View full schedule
              </button>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 shrink-0 text-[#0f172a]" strokeWidth={2} aria-hidden />
                <h3 className="font-serif text-lg font-bold tracking-tight text-[#0f172a] sm:text-xl">
                  Weather at SJD
                </h3>
              </div>
              <div className="mt-3 h-px w-full bg-slate-200" aria-hidden />
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-4 sm:px-5 sm:py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-3xl font-bold tracking-tight text-[#0f172a] sm:text-[2rem]">
                      {PILOT_PREVIEW_WEATHER_SJD.tempC}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#0f172a]">
                      {PILOT_PREVIEW_WEATHER_SJD.condition}
                    </p>
                  </div>
                  <div className="relative h-[4.5rem] w-[5rem] shrink-0" aria-hidden>
                    <Sun className="absolute right-0 top-0 h-11 w-11 text-amber-400" strokeWidth={1.75} />
                    <Cloud className="absolute bottom-0 left-0 h-10 w-10 text-sky-300" strokeWidth={1.5} />
                    <Cloud
                      className="absolute bottom-1 left-4 h-8 w-8 text-sky-200/95"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 divide-x divide-slate-200 border-t border-slate-100 pt-4 text-[#0f172a]">
                <div className="flex flex-col gap-1 pr-2 text-center sm:pr-3">
                  <span className="inline-flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
                    <Wind className="h-4 w-4 shrink-0 text-[#0f172a]/75" aria-hidden />
                    {PILOT_PREVIEW_WEATHER_SJD.windKt}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Wind</span>
                </div>
                <div className="flex flex-col gap-1 px-2 text-center sm:px-3">
                  <span className="inline-flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
                    <Eye className="h-4 w-4 shrink-0 text-[#0f172a]/75" aria-hidden />
                    {PILOT_PREVIEW_WEATHER_SJD.visibility}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Visibility</span>
                </div>
                <div className="flex flex-col gap-1 pl-2 text-center sm:pl-3">
                  <span className="inline-flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
                    <Droplets className="h-4 w-4 shrink-0 text-[#0f172a]/75" aria-hidden />
                    {PILOT_PREVIEW_WEATHER_SJD.humidity}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Humidity</span>
                </div>
              </div>
              <button
                type="button"
                className="mt-4 w-fit text-left text-sm font-semibold text-blue-600 underline decoration-blue-600/30 underline-offset-2 transition hover:text-blue-700 hover:decoration-blue-700/50"
              >
                View full forecast
              </button>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <Fuel className="h-5 w-5 shrink-0 text-[#0f172a]" strokeWidth={2} aria-hidden />
                <h3 className="font-serif text-lg font-bold tracking-tight text-[#0f172a] sm:text-xl">
                  FBO at {PILOT_PREVIEW_FBO_BY_LEG[fboLeg].code}
                </h3>
              </div>
              <div className="mt-3 h-px w-full bg-slate-200" aria-hidden />
              <div
                className="mt-4 inline-flex w-full max-w-full rounded-full border border-slate-200 bg-slate-100 p-0.5"
                role="tablist"
                aria-label="FBO airport"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={fboLeg === "departure"}
                  className={`min-w-0 flex-1 rounded-full px-3 py-1.5 text-center text-xs font-semibold transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:text-sm ${
                    fboLeg === "departure"
                      ? "bg-white text-[#0f172a] shadow-sm shadow-slate-900/10"
                      : "text-slate-600 hover:text-[#0f172a]"
                  }`}
                  onClick={() => setFboLeg("departure")}
                >
                  Departure
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={fboLeg === "arrival"}
                  className={`min-w-0 flex-1 rounded-full px-3 py-1.5 text-center text-xs font-semibold transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:text-sm ${
                    fboLeg === "arrival"
                      ? "bg-white text-[#0f172a] shadow-sm shadow-slate-900/10"
                      : "text-slate-600 hover:text-[#0f172a]"
                  }`}
                  onClick={() => setFboLeg("arrival")}
                >
                  Arrival
                </button>
              </div>
              <div className="mt-4 min-h-0 flex-1 space-y-2">
                <p className="text-base font-bold leading-snug text-[#0f172a]">
                  {PILOT_PREVIEW_FBO_BY_LEG[fboLeg].title}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {PILOT_PREVIEW_FBO_BY_LEG[fboLeg].icaoLine}
                </p>
                <p className="text-sm text-[#0f172a]">{PILOT_PREVIEW_FBO_BY_LEG[fboLeg].badges}</p>
                <p className="text-sm text-[#0f172a]">{PILOT_PREVIEW_FBO_BY_LEG[fboLeg].services}</p>
              </div>
              <button
                type="button"
                className="mt-4 w-fit text-left text-sm font-semibold text-blue-600 underline decoration-blue-600/30 underline-offset-2 transition hover:text-blue-700 hover:decoration-blue-700/50"
              >
                View FBO details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quick Links */}
      <section className="mt-6" aria-labelledby="pilot-quick-links-heading">
        <h3
          id="pilot-quick-links-heading"
          className="text-xs font-semibold uppercase tracking-widest text-[#17324d]/75"
        >
          Quick Links
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
          <button
            type="button"
            onClick={() => setPilotSubView("medical-certifications")}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-amber-400/55 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/35"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0f7] text-[#102b46]">
              <Stethoscope className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#17324d]">Medical &amp; Certs</span>
              <span className="mt-0.5 block text-xs leading-snug text-[#666666]">
                Review medical, training, and currency
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-[#102b46]/70" aria-hidden>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPilotSubView("documents")}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-amber-400/55 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/35"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0f7] text-[#102b46]">
              <Upload className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#17324d]">Upload Document</span>
              <span className="mt-0.5 block text-xs leading-snug text-[#666666]">
                Add medical, invoice, or training files
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-[#102b46]/70" aria-hidden>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPilotSubView("messages")}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-amber-400/55 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/35"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0f7] text-[#102b46]">
              <MessageCircle className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#17324d]">Contact Ops</span>
              <span className="mt-0.5 block text-xs leading-snug text-[#666666]">
                Message dispatch or operations
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-[#102b46]/70" aria-hidden>
              →
            </span>
          </button>
        </div>
      </section>

    </div>
  );
}

function PilotProfilePreviewLayout({
  heroAircraftImageSrc,
  heroImageIsCustom,
  heroUpload,
}: {
  heroAircraftImageSrc: string;
  heroImageIsCustom: boolean;
  heroUpload: { tenant: string; tailNumber: string };
}) {
  const { pilotSubView } = useDemoOpsView();

  switch (pilotSubView) {
    case "my-profile":
      return <PilotMyProfileView />;
    case "medical-certifications":
      return <PilotMedicalCertificationsView />;
    case "documents":
      return <PilotDocumentsView />;
    case "messages":
      return <PilotMessagesView />;
    default:
      return (
        <PilotProfilePreviewDashboard
          heroAircraftImageSrc={heroAircraftImageSrc}
          heroImageIsCustom={heroImageIsCustom}
          heroUpload={heroUpload}
        />
      );
  }
}

function OpsAdminDashboard() {
  const { demoMedicalConfirmed } = useDemoOpsView();

  return (
    <div className="space-y-8">
      <section aria-labelledby="ops-snapshot-heading">
        <h2 id="ops-snapshot-heading" className={SECTION_TITLE}>
          Ops Snapshot
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {OPS_SNAPSHOT.map((row) => (
            <li key={row.label} className={`${CARD} flex flex-col`}>
              <div className={CARD_HEAD}>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/90">{row.label}</p>
              </div>
              <div className={`${CARD_BODY} flex flex-1 gap-3`}>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm ${row.iconWrap}`}
                >
                  <row.Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-2xl font-extrabold tracking-tight ${"valueClass" in row ? row.valueClass : "text-[#17324d]"}`}
                  >
                    {row.value}
                  </p>
                  <p className="mt-0.5 text-xs text-[#666666]">{row.sub}</p>
                </div>
                <MiniSparkline pathD={row.sparkPath} className={row.spark} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Schedule, fleet, and brief">
        <div className={`${CARD} xl:col-span-1`}>
          <div className={CARD_HEAD}>
            <h2 className="text-lg font-extrabold text-white">Today&apos;s Schedule Overview</h2>
          </div>
          <div className={CARD_BODY}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-[#17324d]">
                    <th className="pb-2 pr-2">Status</th>
                    <th className="pb-2 pr-2 text-right">Flights</th>
                    <th className="pb-2 pr-2 text-right">Pilots</th>
                    <th className="pb-2 text-right">Coverage</th>
                  </tr>
                </thead>
                <tbody className="text-[#333333]">
                  {SCHEDULE_ROWS.map((r) => (
                    <tr key={r.status} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-2">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} aria-hidden />
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">{r.flights}</td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">{r.pilots}</td>
                      <td className="py-2.5 text-right tabular-nums text-[#666666]">{r.coverage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className={`${LINK} mt-4 block text-left`}>
              View full schedule →
            </button>
          </div>
        </div>

        <div className={`${CARD} xl:col-span-1`}>
          <div className={CARD_HEAD}>
            <h2 className="text-center text-lg font-extrabold text-white">Fleet Status</h2>
          </div>
          <div className={`${CARD_BODY} pt-2`}>
            <FleetDonut />
          </div>
        </div>

        <div className={`${CARD} flex flex-col xl:col-span-1`}>
          <div className={CARD_HEAD}>
            <h2 className="text-lg font-extrabold text-white">Today&apos;s Ops Brief</h2>
          </div>
          <div className={`${CARD_BODY} flex flex-1 flex-col`}>
            <ul className="flex-1 space-y-3">
              {OPS_BRIEF.map((item) => (
                <li
                  key={item.title}
                  className="rounded-sm border border-slate-200/90 bg-[#f1f5f9] px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-[#17324d]">{item.title}</p>
                  <p className="text-xs text-[#666666]">{item.detail}</p>
                </li>
              ))}
            </ul>
            <button type="button" className={`${BTN_PRIMARY} mt-5`}>
              Open Ops Brief
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Pilots and alerts">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <h2 className="text-lg font-extrabold text-white">Pilot Readiness &amp; Compliance</h2>
          </div>
          <div className={CARD_BODY}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-[#17324d]">
                    <th className="pb-2 pr-3">Pilot</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Medical</th>
                    <th className="pb-2 pr-3">Certifications</th>
                    <th className="pb-2 pr-3">Training</th>
                    <th className="pb-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {PILOT_ROWS.map((p) => (
                    <tr key={p.name} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-[#17324d]">{p.name}</p>
                        <p className="text-xs text-[#666666]">{p.line}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${p.statusStyle}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td
                        className={`py-3 pr-3 text-xs ${p.status === "Not Ready" ? "text-red-600" : "text-[#333333]"}`}
                      >
                        {p.name === "James Wilson" ? (
                          <div>
                            <p>
                              {demoMedicalConfirmed ? JAMES_WILSON_MEDICAL_AFTER_CONFIRM : p.medical}
                            </p>
                            {demoMedicalConfirmed ? (
                              <p className="mt-1 text-[11px] leading-snug text-[#666666]">
                                Updated from uploaded medical
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          p.medical
                        )}
                      </td>
                      <td
                        className={`py-3 pr-3 text-xs ${p.certs.includes("overdue") ? "text-red-600" : "text-[#333333]"}`}
                      >
                        {p.certs}
                      </td>
                      <td className="py-3 pr-3 text-xs text-[#333333]">{p.training}</td>
                      <td className={`py-3 text-xs font-medium ${p.flagTone || "text-[#666666]"}`}>{p.flags}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className={`${LINK} mt-4 block text-left`}>
              View all pilot profiles →
            </button>
          </div>
        </div>

        <div className={CARD}>
          <div className={`${CARD_HEAD} flex items-center justify-between gap-2`}>
            <h2 className="text-lg font-extrabold text-white">Alerts &amp; Notifications</h2>
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">3</span>
          </div>
          <div className={CARD_BODY}>
            <ul className="space-y-3">
              {ALERT_ITEMS.map((a) => (
                <li
                  key={a.title}
                  className={`flex gap-3 rounded-sm border border-slate-100 border-l-4 py-3 pl-3 pr-3 ${a.tone}`}
                >
                  <AlertRowIcon kind={a.icon} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#17324d]">{a.title}</p>
                    <p className="text-xs text-[#666666]">{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className={`${LINK} mt-4 block text-left`}>
              View all alerts →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DemoOpsAdminPageClient({
  heroAircraftImageSrc,
  heroImageIsCustom,
  heroUpload,
}: {
  heroAircraftImageSrc: string;
  heroImageIsCustom: boolean;
  heroUpload: { tenant: string; tailNumber: string };
}) {
  const { view } = useDemoOpsView();
  if (view === "pilot-preview") {
    return (
      <PilotProfilePreviewLayout
        heroAircraftImageSrc={heroAircraftImageSrc}
        heroImageIsCustom={heroImageIsCustom}
        heroUpload={heroUpload}
      />
    );
  }
  return <OpsAdminDashboard />;
}
