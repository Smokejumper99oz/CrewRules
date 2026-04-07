/**
 * Pure text parser for ELP Crew Schedule pairing notification emails (plain text / stripped HTML body).
 * No I/O — safe to call from routes or tests.
 */

export type ElpLegAdded = {
  flightNumber: string;
  dep: string;
  arr: string;
  depText: string;
  arrText: string;
  blockText: string;
  deadhead: boolean;
  rawType: "added";
};

export type ElpLegDeleted = {
  flightNumber: string;
  dep: string;
  arr: string;
  depText: string;
  arrText: string;
  blockText: string;
  deadhead: boolean;
  rawType: "deleted";
};

export type ElpDutyModification = {
  reportText: string | null;
  releaseText: string | null;
  blockText: string | null;
  hotelName: string | null;
  hotelPhone: string | null;
};

export type ElpPairingNotificationParse = {
  pairingCode: string | null;
  pairingStatus: "modified" | "added" | "deleted" | null;
  legsAdded: ElpLegAdded[];
  legsDeleted: ElpLegDeleted[];
  dutyModifications: ElpDutyModification[];
};

const PAIRING_HEADLINE_RE =
  /Pairing\s+Number\s+([A-Z0-9]+)\s+has\s+been\s+(MODIFIED|ADDED|DELETED)/i;

/** Flight row: Added/Deleted, optional "- Flight" / "- DUT:", then flight, dep, arr, two date/times, block */
const LEG_ROW_RE =
  /^(Added|Deleted)(?:\s+-\s*Flight\s+|\s+-\s*DUT\s*:?\s*)?\s*(\S+)\s+([A-Z]{3})\s+([A-Z]{3})\s+(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?:\s*\([A-Z]\))?)\s+(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?:\s*\([A-Z]\))?)\s+(\d{1,2}:\d{2})\s*$/i;

const MODIFIED_REPORT_START_RE = /^Modified\s+Report\s+DT\s*:?\s*(.*)$/i;
const RELEASE_DT_RE = /^Release\s+DT\s*:?\s*(.+)$/i;
const BLOCK_RE = /^Block\s*:?\s*(.+)$/i;
const HOTEL_RE = /^Hotel\s*:?\s*(.+)$/i;
const HOTEL_PHONE_RE = /^Hotel\s+Phone\s*:?\s*(.+)$/i;

const FOOTER_CUT_RE = /please,?\s+click\s+here/i;

function normalizeWhitespace(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function stripDutyAsterisk(v: string): string {
  return v.replace(/\*\s*$/g, "").trim();
}

function inferDeadhead(flightNumber: string, fullLine: string): boolean {
  const fn = flightNumber.trim();
  if (/^WN/i.test(fn)) return true;
  const line = fullLine.toUpperCase();
  if (/\bDH\b/.test(fullLine) || /\bDEADHEAD\b/i.test(fullLine)) return true;
  if (/DHD\s*[:.]?\s*D\b/i.test(line)) return true;
  return false;
}

function mapStatus(word: string | undefined): ElpPairingNotificationParse["pairingStatus"] {
  if (!word) return null;
  const u = word.toUpperCase();
  if (u === "MODIFIED") return "modified";
  if (u === "ADDED") return "added";
  if (u === "DELETED") return "deleted";
  return null;
}

export function parseElpPairingNotification(body: string): ElpPairingNotificationParse {
  const legsAdded: ElpLegAdded[] = [];
  const legsDeleted: ElpLegDeleted[] = [];
  const dutyModifications: ElpDutyModification[] = [];

  let pairingCode: string | null = null;
  let pairingStatus: ElpPairingNotificationParse["pairingStatus"] = null;

  const flat = normalizeWhitespace(body);
  const headline = flat.match(PAIRING_HEADLINE_RE);
  if (headline) {
    pairingCode = headline[1] ?? null;
    pairingStatus = mapStatus(headline[2]);
  }

  let lines = flat.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const footerIdx = lines.findIndex((l) => FOOTER_CUT_RE.test(l));
  if (footerIdx >= 0) lines = lines.slice(0, footerIdx);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    const legM = line.match(LEG_ROW_RE);
    if (legM) {
      const kind = legM[1]!.toLowerCase();
      const flightNumber = legM[2]!;
      const dep = legM[3]!.toUpperCase();
      const arr = legM[4]!.toUpperCase();
      const depText = legM[5]!.trim();
      const arrText = legM[6]!.trim();
      const blockText = legM[7]!.trim();
      const deadhead = inferDeadhead(flightNumber, line);

      if (kind === "added") {
        legsAdded.push({
          flightNumber,
          dep,
          arr,
          depText,
          arrText,
          blockText,
          deadhead,
          rawType: "added",
        });
      } else {
        legsDeleted.push({
          flightNumber,
          dep,
          arr,
          depText,
          arrText,
          blockText,
          deadhead,
          rawType: "deleted",
        });
      }
      i += 1;
      continue;
    }

    const modM = line.match(MODIFIED_REPORT_START_RE);
    if (modM) {
      const duty: ElpDutyModification = {
        reportText:
          modM[1] != null && String(modM[1]).trim() !== ""
            ? stripDutyAsterisk(String(modM[1]).trim())
            : null,
        releaseText: null,
        blockText: null,
        hotelName: null,
        hotelPhone: null,
      };
      i += 1;
      while (i < lines.length) {
        const inner = lines[i]!;
        if (
          LEG_ROW_RE.test(inner) ||
          MODIFIED_REPORT_START_RE.test(inner) ||
          /^(Added|Deleted)\b/i.test(inner)
        ) {
          break;
        }
        const releaseMatch = inner.match(RELEASE_DT_RE);
        if (releaseMatch) {
          duty.releaseText = stripDutyAsterisk(releaseMatch[1]!.trim());
          i += 1;
          continue;
        }
        const blockMatch = inner.match(BLOCK_RE);
        if (blockMatch) {
          duty.blockText = stripDutyAsterisk(blockMatch[1]!.trim());
          i += 1;
          continue;
        }
        const phoneMatch = inner.match(HOTEL_PHONE_RE);
        if (phoneMatch) {
          duty.hotelPhone = stripDutyAsterisk(phoneMatch[1]!.trim());
          i += 1;
          continue;
        }
        const hotelMatch = inner.match(HOTEL_RE);
        if (hotelMatch && !/^Hotel\s+Phone/i.test(inner)) {
          duty.hotelName = stripDutyAsterisk(hotelMatch[1]!.trim());
          i += 1;
          continue;
        }
        break;
      }
      dutyModifications.push(duty);
      continue;
    }

    i += 1;
  }

  return {
    pairingCode,
    pairingStatus,
    legsAdded,
    legsDeleted,
    dutyModifications,
  };
}

/*
 * --- Inline examples (S3090A-style shape) — paste into a REPL or test to inspect output ---
 *
 * const sample = `
 * Pairing Notification
 *
 * Your Schedule with Pairing Number S3090A has been MODIFIED
 *
 * Added WN479 BDL MCO 04/07 16:55 (S) 04/07 19:55 (S) 00:00
 * Deleted 1683 BDL MCO 04/07 09:15 (E) 04/07 12:21 (E) 03:06
 *
 * Modified Report DT : 04/07 16:10*
 * Release DT : 04/08 00:17
 * Block: 02:57
 * Hotel: N/A
 *
 * Please, click here to acknowledge this notification.
 * `;
 *
 * // Expected roughly:
 * // parseElpPairingNotification(sample) => {
 * //   pairingCode: "S3090A",
 * //   pairingStatus: "modified",
 * //   legsAdded: [{ flightNumber: "WN479", dep: "BDL", arr: "MCO", depText: "04/07 16:55 (S)", arrText: "04/07 19:55 (S)", blockText: "00:00", deadhead: true, rawType: "added" }],
 * //   legsDeleted: [{ flightNumber: "1683", dep: "BDL", arr: "MCO", depText: "04/07 09:15 (E)", arrText: "04/07 12:21 (E)", blockText: "03:06", deadhead: false, rawType: "deleted" }],
 * //   dutyModifications: [{ reportText: "04/07 16:10", releaseText: "04/08 00:17", blockText: "02:57", hotelName: "N/A", hotelPhone: null }]
 * // }
 */
