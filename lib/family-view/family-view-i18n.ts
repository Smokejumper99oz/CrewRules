export type FamilyViewLang = "en" | "es" | "de";

export const SUPPORTED_LANGS: FamilyViewLang[] = ["en", "es", "de"];

export function resolveLang(raw: string | undefined | null): FamilyViewLang {
  if (raw === "es" || raw === "de") return raw;
  return "en";
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
  deadheadBadge: string;
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
  deadheadBadge: "Deadhead",
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
  deadheadBadge: "Deadhead",
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
  deadheadBadge: "Deadhead",
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

  glossaryTitle: "Luftfahrtbegriffe",
  glossaryDescription: "Ein verständlicher Leitfaden zu den Begriffen in diesem Zeitplan.",
};

export const TRANSLATIONS: Record<FamilyViewLang, FamilyViewStrings> = { en, es, de };

export function getStrings(lang: FamilyViewLang): FamilyViewStrings {
  return TRANSLATIONS[lang];
}
