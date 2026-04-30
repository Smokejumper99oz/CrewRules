/** Shared categorical tags for heuristic filter + AI decode overlays. */

export type OperationalNotamCategory =

  | "runway"

  | "ils"

  | "navaid"

  | "taxiway"

  | "airport"

  | "airspace"

  | "other";



export type OperationalNotamSeverity = "info" | "caution" | "warning" | "critical";



/**

 * Pilot-facing AI overlay for one NOTAM. Discriminates skip vs usable vs failure.

 * Never includes API keys.

 */

export type OperationalNotamDecodedOverlay =

  | {

      decodeStatus: "ok";

      plainEnglish: string;

      operationalImpact: string;

      severity: OperationalNotamSeverity;

      aiCategory: OperationalNotamCategory;

      pilotAction: string;

    }

  | { decodeStatus: "skipped" }

  | { decodeStatus: "error"; decodeErrorBrief?: string };



export type OperationalNotamValidity = {
  effective?: {
    iso?: string;
    repr?: string;
  };
  expires?: {
    iso?: string;
    repr?: string;
    value?: string;
    permanent?: boolean;
  };
  issued?: {
    iso?: string;
    repr?: string;
  };
};

export type OperationalNotamItem = {

  id: string;

  stationIcao: string;

  rawText: string;

  category: OperationalNotamCategory;

  /** Structured validity from AVWX JSON when present (not parsed from rawText). */

  validity?: OperationalNotamValidity;

  /** Population optional — server merges after AVWX ingest when decode runs. */

  decoded?: OperationalNotamDecodedOverlay;

};



export type OperationalNotamsBriefResult = {

  availability: "ok" | "unavailable";

  reason?: "not_configured" | "provider_error" | "timeout" | "network";

  departure: {

    stationIcao: string;

    items: OperationalNotamItem[];

    /** When AVWX station fetch+parse ran successfully (cached replay preserves this ISO time). */

    fetchedAt?: string;

  };

  arrival: {

    stationIcao: string;

    items: OperationalNotamItem[];

    /** When AVWX station fetch+parse ran successfully (cached replay preserves this ISO time). */

    fetchedAt?: string;

  };

  fetchedAt: string;

};


