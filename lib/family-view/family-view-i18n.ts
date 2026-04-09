export type FamilyViewLang = "en" | "es" | "de";

export const SUPPORTED_LANGS: FamilyViewLang[] = ["en", "es", "de"];

export function resolveLang(raw: string | undefined | null): FamilyViewLang {
  if (raw === "es" || raw === "de") return raw;
  return "en";
}

/** Frontier bid period `name` (JAN…DEC) → localized calendar month label for family-facing copy. */
const BID_NAME_TO_MONTH_INDEX: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

export function familyViewBidMonthFamilyLabel(bidName: string, lang: FamilyViewLang): string {
  const code = bidName.trim().toUpperCase();
  const monthIndex = BID_NAME_TO_MONTH_INDEX[code];
  if (monthIndex == null) {
    return bidName.trim();
  }
  const locale = lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : "en-US";
  const d = new Date(Date.UTC(2000, monthIndex, 1));
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(d);
}

export type FamilyViewStrings = {
  // Header / navigation
  familyView: string;
  tabSchedule: string;
  tabAviationTerms: string;
  langLabel: string; // display name of this language

  // Section headers
  sectionToday: string;
  sectionWeekAhead: string;
  sectionUpcoming: string;
  sectionCurrentTrip: string;
  sectionNextTrip: string;

  // Status labels
  dayOff: string;
  dutyStarts: string;
  overnight: string;
  dayTrip: string;
  headingToWork: string;
  commutingHome: string;
  comingHome: string;
  tripEnds: string;
  onCall: string;
  timeOff: string;

  // Detail text
  travelingTo: string;        // "Traveling to" — city appended after
  timingDepends: string;      // commute home timing disclaimer
  /** Bottom line: "Commute home [inThePeriod], …" — pass inTheMorning / inTheAfternoon / inTheEvening */
  commuteHomeAfterLanding: (inThePeriod: string) => string;
  commuteHome: string;        // "Commute home" prefix on the home row
  ifFlightsAvailable: string; // "if flights are available" suffix on the home row
  currently: string;          // prefix "Currently"

  // Trip overview
  daysAway: string;           // "X Days Away" — X is prepended
  day: string;                // "Day"
  of: string;                 // "of"

  // Time-of-day labels
  inTheMorning: string;       // "in the morning"
  inTheAfternoon: string;     // "in the afternoon"
  inTheEvening: string;       // "in the evening"
  sometime: string;           // "sometime"

  // Trip-overview labels
  at: string;                 // "at [time]"
  around: string;             // "around [time]"
  earlyMorning: string;       // "early [weekday] morning"

  // Home arrival
  home: string;               // "Home" label on home-time row
  homeOn: string;             // "Home [day] [time]" → prefix "Home"

  // Warning message
  nextTripStarts: string;     // "Next trip starts"
  wontMakeItHome: string;     // "[name] most likely won't make it home…"
  nameWontMakeIt: (name: string) => string;
  only: string;               // "Only"
  hoursGap: string;           // "hours between trips"
  aboutADay: string;
  aboutXDays: (n: number) => string;
  daysBetweenTrips: string;   // "days between trips"

  // Flying today section
  flyingToday: string;
  recurrentTraining: string;
  travelToTraining: string;
  travelFromTraining: string;
  /** Prefix before city on last training day (company deadhead home), e.g. "Leaving" */
  leavingFrom: string;
  deadheadBadge: string;
  commuteBadge: string;
  pilotOperating: string;
  flightCancelled: string;
  delayed: string;            // "Delayed +" prefix, then "+N min"

  // Commute flights
  likelyYourFlight: (firstName: string) => string;
  backupOption: string;
  departureLabel: string;
  arrivalLabel: string;

  // Home base trip details
  departs: string;            // "Departs [time]"
  arrives: string;            // "Arrives [time]"

  // Last day detail (non-commuter)
  tripEndsAt: string;         // "Trip Ends at" — time/city appended

  // Disabled state
  familyViewDisabled: string;
  familyViewDisabledLink: string;
  familyViewDisabledSuffix: string;

  // Empty state
  nothingScheduled: string;

  /** One-line context: Frontier bid periods vs calendar months. */
  currentBidPeriodNote: (bidName: string, dateRangeLabel: string) => string;
  /** Small footer under Upcoming: next date block not shown yet (family-friendly; pilot first name). */
  upcomingFooterNextBidWaiting: (
    pilotFirstName: string | null | undefined,
    /** Localized month from next bid `name` (e.g. May), via {@link familyViewBidMonthFamilyLabel}. */
    bidMonthLabel: string
  ) => string;
  /** Small footer under Upcoming: more dates may still appear (family-friendly). */
  upcomingFooterNextBidTeaser: (
    pilotFirstName: string | null | undefined,
    bidMonthLabel: string
  ) => string;

  // Glossary
  glossaryTitle: string;
  glossaryDescription: string;
};

const en: FamilyViewStrings = {
  familyView: "Family View",
  tabSchedule: "Schedule",
  tabAviationTerms: "Aviation Terms",
  langLabel: "EN",

  sectionToday: "Today",
  sectionWeekAhead: "Week Ahead",
  sectionUpcoming: "Upcoming",
  sectionCurrentTrip: "Current Trip Overview",
  sectionNextTrip: "Next Trip Overview",

  dayOff: "Day Off",
  dutyStarts: "Duty Starts",
  overnight: "Overnight",
  dayTrip: "Day Trip",
  headingToWork: "Heading to Work",
  commutingHome: "Commuting Home",
  comingHome: "Coming Home",
  tripEnds: "Trip Ends",
  onCall: "On Call",
  timeOff: "Time Off",

  travelingTo: "Traveling to",
  timingDepends: "Timing depends on available flights and seat options",
  commuteHomeAfterLanding: (inThe) =>
    `Commute home ${inThe}, depending on available flights and seat options.`,
  commuteHome: "Commute home",
  ifFlightsAvailable: "if flights are available",
  currently: "Currently",

  daysAway: "Days Away",
  day: "Day",
  of: "of",

  inTheMorning: "in the morning",
  inTheAfternoon: "in the afternoon",
  inTheEvening: "in the evening",
  sometime: "sometime",

  at: "at",
  around: "around",
  earlyMorning: "early morning",

  home: "Home",
  homeOn: "Home",

  nextTripStarts: "Next trip starts",
  wontMakeItHome: "most likely won't make it home before the next trip",
  nameWontMakeIt: (name) => `${name} most likely won't make it home before the next trip`,
  only: "Only",
  hoursGap: "hours between trips",
  aboutADay: "about a day between trips",
  aboutXDays: (n) => `about ${n} days between trips`,
  daysBetweenTrips: "days between trips",

  flyingToday: "Flying Today",
  recurrentTraining: "Recurrent Training",
  travelToTraining: "Travel to Training",
  travelFromTraining: "Travel from Training",
  leavingFrom: "Leaving",
  deadheadBadge: "Deadhead",
  commuteBadge: "Commute",
  pilotOperating: "Pilot Operating",
  flightCancelled: "Flight Cancelled",
  delayed: "Delayed",

  likelyYourFlight: (firstName) => `Likely ${firstName}'s flight`,
  backupOption: "Backup option",
  departureLabel: "Departure:",
  arrivalLabel: "Arrival:",

  departs: "Departs",
  arrives: "Arrives",

  tripEndsAt: "Trip Ends at",

  familyViewDisabled: "Family View is not enabled yet.",
  familyViewDisabledLink: "Settings → Family View",
  familyViewDisabledSuffix: "to start sharing your schedule with family.",

  nothingScheduled: "Nothing scheduled",

  currentBidPeriodNote: (bidName, dateRangeLabel) =>
    `Frontier bid period: ${bidName} (${dateRangeLabel}). Schedules follow bid months, not calendar months.`,

  upcomingFooterNextBidWaiting: (pilotFirstName, bidMonthLabel) => {
    const name = (pilotFirstName ?? "").trim();
    const updateClause = name
      ? `once ${name} updates the schedule`
      : `once the schedule is updated`;
    return `The ${bidMonthLabel} schedule isn’t available yet. More days will appear ${updateClause} in CrewRules™ (most airlines release the next month around mid-month).`;
  },
  upcomingFooterNextBidTeaser: (pilotFirstName, bidMonthLabel) => {
    const name = (pilotFirstName ?? "").trim();
    const whenClause = name
      ? `when ${name} updates the schedule`
      : `when the schedule is updated`;
    return `More days for the ${bidMonthLabel} schedule may appear ${whenClause} in CrewRules™. Those blocks often don’t line up with a normal calendar month.`;
  },

  glossaryTitle: "Aviation Terms",
  glossaryDescription: "A plain-English guide to the words you'll see on this schedule.",
};

const es: FamilyViewStrings = {
  familyView: "Vista Familiar",
  tabSchedule: "Horario",
  tabAviationTerms: "Términos",
  langLabel: "ES",

  sectionToday: "Hoy",
  sectionWeekAhead: "Próxima Semana",
  sectionUpcoming: "Próximamente",
  sectionCurrentTrip: "Viaje Actual",
  sectionNextTrip: "Próximo Viaje",

  dayOff: "Día Libre",
  dutyStarts: "Inicio de Servicio",
  overnight: "Noche Fuera",
  dayTrip: "Viaje de Día",
  headingToWork: "Viajando al Trabajo",
  commutingHome: "Regresando a Casa",
  comingHome: "Llegando a Casa",
  tripEnds: "Fin del Viaje",
  onCall: "De Guardia",
  timeOff: "Tiempo Libre",

  travelingTo: "Viajando a",
  timingDepends: "Depende de los vuelos y asientos disponibles",
  commuteHomeAfterLanding: (inThe) =>
    `Regreso a casa ${inThe}, según los vuelos y asientos disponibles.`,
  commuteHome: "Regreso a casa",
  ifFlightsAvailable: "si hay vuelos disponibles",
  currently: "Actualmente",

  daysAway: "Días Fuera",
  day: "Día",
  of: "de",

  inTheMorning: "en la mañana",
  inTheAfternoon: "en la tarde",
  inTheEvening: "en la noche",
  sometime: "en algún momento",

  at: "a las",
  around: "alrededor de las",
  earlyMorning: "madrugada",

  home: "En Casa",
  homeOn: "En casa",

  nextTripStarts: "El próximo viaje comienza",
  wontMakeItHome: "probablemente no llegará a casa antes del próximo viaje",
  nameWontMakeIt: (name) => `${name} probablemente no llegará a casa antes del próximo viaje`,
  only: "Solo",
  hoursGap: "horas entre viajes",
  aboutADay: "aproximadamente un día entre viajes",
  aboutXDays: (n) => `aproximadamente ${n} días entre viajes`,
  daysBetweenTrips: "días entre viajes",

  flyingToday: "Volando Hoy",
  recurrentTraining: "Entrenamiento",
  travelToTraining: "Viaje al entrenamiento",
  travelFromTraining: "Viaje desde el entrenamiento",
  leavingFrom: "Saliendo de",
  deadheadBadge: "Deadhead",
  commuteBadge: "Commute",
  pilotOperating: "Piloto al Mando",
  flightCancelled: "Vuelo Cancelado",
  delayed: "Retrasado",

  likelyYourFlight: (firstName) => `Probablemente el vuelo de ${firstName}`,
  backupOption: "Opción alternativa",
  departureLabel: "Salida:",
  arrivalLabel: "Llegada:",

  departs: "Sale",
  arrives: "Llega",

  tripEndsAt: "Fin del Viaje a las",

  familyViewDisabled: "La Vista Familiar no está activada aún.",
  familyViewDisabledLink: "Configuración → Vista Familiar",
  familyViewDisabledSuffix: "para compartir tu horario con la familia.",

  nothingScheduled: "Nada programado",

  currentBidPeriodNote: (bidName, dateRangeLabel) =>
    `Período de bid Frontier: ${bidName} (${dateRangeLabel}). Los horarios siguen los meses de bid, no los meses naturales.`,

  upcomingFooterNextBidWaiting: (pilotFirstName, bidMonthLabel) => {
    const name = (pilotFirstName ?? "").trim();
    const clause = name
      ? `cuando ${name} actualice el horario`
      : `cuando se actualice el horario`;
    return `El horario de ${bidMonthLabel} aún no está disponible. Aparecerán más días ${clause} en CrewRules™ (la mayoría de las aerolíneas publican el mes siguiente hacia mediados de mes).`;
  },
  upcomingFooterNextBidTeaser: (pilotFirstName, bidMonthLabel) => {
    const name = (pilotFirstName ?? "").trim();
    const clause = name
      ? `cuando ${name} actualice el horario`
      : `cuando se actualice el horario`;
    return `Pueden aparecer más días en el horario de ${bidMonthLabel} ${clause} en CrewRules™. Esos bloques a menudo no coinciden con un mes natural.`;
  },

  glossaryTitle: "Términos de Aviación",
  glossaryDescription: "Guía en español de las palabras que verás en este horario.",
};

const de: FamilyViewStrings = {
  familyView: "Familienansicht",
  tabSchedule: "Zeitplan",
  tabAviationTerms: "Begriffe",
  langLabel: "DE",

  sectionToday: "Heute",
  sectionWeekAhead: "Nächste Woche",
  sectionUpcoming: "Demnächst",
  sectionCurrentTrip: "Aktueller Dienst",
  sectionNextTrip: "Nächster Dienst",

  dayOff: "Freier Tag",
  dutyStarts: "Dienstbeginn",
  overnight: "Auswärts",
  dayTrip: "Tagesreise",
  headingToWork: "Auf dem Weg zur Arbeit",
  commutingHome: "Heimreise",
  comingHome: "Kommt nach Hause",
  tripEnds: "Trip endet",
  onCall: "Bereitschaft",
  timeOff: "Freizeit",

  travelingTo: "Reise nach",
  timingDepends: "Abhängig von verfügbaren Flügen und Sitzplätzen",
  commuteHomeAfterLanding: (inThe) =>
    `Pendeln nach Hause ${inThe}, abhängig von verfügbaren Flügen und Sitzplätzen.`,
  commuteHome: "Heimreise",
  ifFlightsAvailable: "wenn Flüge verfügbar sind",
  currently: "Aktuell",

  daysAway: "Tage unterwegs",
  day: "Tag",
  of: "von",

  inTheMorning: "am Morgen",
  inTheAfternoon: "am Nachmittag",
  inTheEvening: "am Abend",
  sometime: "irgendwann",

  at: "um",
  around: "gegen",
  earlyMorning: "früh morgens",

  home: "Zuhause",
  homeOn: "Zuhause",

  nextTripStarts: "Nächster Dienst beginnt",
  wontMakeItHome: "kommt wahrscheinlich nicht nach Hause",
  nameWontMakeIt: (name) => `${name} kommt wahrscheinlich nicht nach Hause`,
  only: "Nur",
  hoursGap: "Stunden zwischen den Trips",
  aboutADay: "etwa einen Tag zwischen den Trips",
  aboutXDays: (n) => `etwa ${n} Tage zwischen den Trips`,
  daysBetweenTrips: "Tage zwischen den Trips",

  flyingToday: "Fliegt heute",
  recurrentTraining: "Recurrent Training",
  travelToTraining: "Anreise zum Training",
  travelFromTraining: "Abreise vom Training",
  leavingFrom: "Abflug von",
  deadheadBadge: "Deadhead",
  commuteBadge: "Commute",
  pilotOperating: "Als Pilot im Dienst",
  flightCancelled: "Flug gestrichen",
  delayed: "Verspätet",

  likelyYourFlight: (firstName) => `Wahrscheinlich ${firstName}s Flug`,
  backupOption: "Ausweichoption",
  departureLabel: "Abflug:",
  arrivalLabel: "Ankunft:",

  departs: "Abflug",
  arrives: "Ankunft",

  tripEndsAt: "Trip endet um",

  familyViewDisabled: "Die Familienansicht ist noch nicht aktiviert.",
  familyViewDisabledLink: "Einstellungen → Familienansicht",
  familyViewDisabledSuffix: "um deinen Zeitplan mit der Familie zu teilen.",

  nothingScheduled: "Nichts geplant",

  currentBidPeriodNote: (bidName, dateRangeLabel) =>
    `Frontier-Bid-Zeitraum: ${bidName} (${dateRangeLabel}). Zeitpläne folgen Bid-Monaten, nicht kalendermonatlich.`,

  upcomingFooterNextBidWaiting: (pilotFirstName, bidMonthLabel) => {
    const name = (pilotFirstName ?? "").trim();
    const clause = name
      ? `sobald ${name} den Zeitplan in CrewRules™ aktualisiert`
      : `sobald der Zeitplan in CrewRules™ aktualisiert wird`;
    return `Der Zeitplan für ${bidMonthLabel} ist noch nicht verfügbar. Es erscheinen mehr Tage, ${clause} (die meisten Airlines veröffentlichen den nächsten Monat etwa Mitte des Vormonats).`;
  },
  upcomingFooterNextBidTeaser: (pilotFirstName, bidMonthLabel) => {
    const name = (pilotFirstName ?? "").trim();
    const clause = name
      ? `wenn ${name} den Zeitplan in CrewRules™ aktualisiert`
      : `wenn der Zeitplan in CrewRules™ aktualisiert wird`;
    return `Es können noch weitere Tage für den Zeitplan ${bidMonthLabel} dazukommen, ${clause}. Solche Blöcke entsprechen oft nicht dem gewöhnlichen Kalendermonat.`;
  },

  glossaryTitle: "Luftfahrtbegriffe",
  glossaryDescription: "Ein verständlicher Leitfaden zu den Begriffen in diesem Zeitplan.",
};

export const TRANSLATIONS: Record<FamilyViewLang, FamilyViewStrings> = { en, es, de };

export function getStrings(lang: FamilyViewLang): FamilyViewStrings {
  return TRANSLATIONS[lang];
}
