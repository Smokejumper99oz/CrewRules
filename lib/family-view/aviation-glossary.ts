import type { FamilyViewLang } from "./family-view-i18n";

export type GlossaryTerm = {
  term: string;
  definition: string;
};

export type GlossaryCategory = {
  category: string;
  terms: GlossaryTerm[];
};

const en: GlossaryCategory[] = [
  {
    category: "Life on the Road",
    terms: [
      {
        term: "Deadhead",
        definition:
          "A deadheading pilot is traveling as a passenger — usually in full uniform in the main cabin — but is on duty and getting paid. The airline needs them somewhere else to operate a flight.",
      },
      {
        term: "Overnight",
        definition:
          "A scheduled rest stop away from home between trip days. The airline books a hotel. The pilot returns to flying the next day.",
      },
      {
        term: "Red-Eye",
        definition:
          "A flight that departs late at night and arrives early in the morning. Named for the tired, red eyes passengers and crew have after flying through the night.",
      },
      {
        term: "Crash Pad",
        definition:
          "A shared apartment or house near the crew base, used by commuter pilots who need a place to sleep before or after trips without flying all the way home. Think of it as a bunk house for pilots.",
      },
      {
        term: "TAFB",
        definition:
          "Time Away From Base. Tracks how long a pilot is away from their home base on a trip. Longer TAFB usually means additional pay.",
      },
    ],
  },
  {
    category: "The Schedule",
    terms: [
      {
        term: "Pairing (or Trip)",
        definition:
          "A complete sequence of flights, overnights, and rest periods that make up a single work assignment. A 4-day pairing means the pilot is away from base for 4 days flying a set of pre-planned routes.",
      },
      {
        term: "Duty Starts / Report Time",
        definition:
          "The official time a pilot's work shift begins — usually 60 to 90 minutes before the first flight's departure. This is when they check in at the airport, review weather, and brief with the crew.",
      },
      {
        term: "Block Time",
        definition:
          "The time from when the aircraft pushes back from the gate to when it parks at the destination gate. It is different from flight time and is used to calculate pay.",
      },
      {
        term: "Reserve / On Call",
        definition:
          "A pilot on reserve is available and on standby in case the airline needs them — for example, if another pilot calls in sick. They must be reachable and ready to report on short notice.",
      },
      {
        term: "Open Time",
        definition:
          "Trips that are available for pilots to voluntarily pick up, usually for extra pay. When a pilot picks up a trip from open time it may start from their home airport instead of their base.",
      },
    ],
  },
  {
    category: "Commuting",
    terms: [
      {
        term: "Commuter Pilot",
        definition:
          "A pilot whose home is in a different city from their assigned crew base. They travel to and from base on their own time — often using free or discounted airline passes — before and after each trip.",
      },
      {
        term: "Crew Base",
        definition:
          "The airport where a pilot is officially assigned. All trips begin and end here. A pilot based in San Juan starts every trip in San Juan, even if they live in Tampa.",
      },
      {
        term: "Jump Seat",
        definition:
          "A small fold-down seat in the cockpit or cabin used by off-duty crew members to travel between cities, often for free. Commuter pilots use jump seats to get to and from their crew base.",
      },
      {
        term: "Deviation",
        definition:
          "When a pilot arranges to go home (to their personal residence) instead of following the company's standard routing back to base after training or a trip. Requires approval and is done at the pilot's own expense.",
      },
    ],
  },
  {
    category: "Training",
    terms: [
      {
        term: "Simulator (Sim)",
        definition:
          "A full-motion flight simulator that replicates the cockpit of a real aircraft. Pilots use it for recurrent training, emergency procedures, and checkrides — without leaving the ground.",
      },
      {
        term: "Recurrent Training",
        definition:
          "Mandatory training that all pilots must complete every year to keep their certificates current. Includes simulator sessions, ground school, and emergency procedure reviews.",
      },
      {
        term: "Ground School (rgs)",
        definition:
          "Classroom-style training where pilots study systems, procedures, regulations, and company policies. Usually happens the day before simulator sessions during recurrent training.",
      },
      {
        term: "Checkride",
        definition:
          "An evaluation by an FAA examiner or company check airman to verify a pilot's skills and knowledge. Passing a checkride is required to earn or maintain a certificate or rating.",
      },
      {
        term: "IOE (Initial Operating Experience)",
        definition:
          "A new pilot's first real flights with passengers after completing their type rating training. An experienced check captain supervises to ensure the new pilot is ready to fly the line solo.",
      },
    ],
  },
  {
    category: "In the Air",
    terms: [
      {
        term: "Type Rating",
        definition:
          "A certification that allows a pilot to fly a specific aircraft type — for example, an Airbus A320 or a Boeing 737. Each type requires separate training and testing.",
      },
      {
        term: "Captain / First Officer",
        definition:
          "A Captain sits in the left seat and is the final authority on the aircraft. A First Officer (co-pilot) sits in the right seat. Both are fully qualified pilots — the Captain has more experience and seniority.",
      },
      {
        term: "Wheels Up / Block Out",
        definition:
          "When the plane lifts off the runway (wheels up) or pushes back from the gate (block out). Pilots often use these phrases when saying when they actually departed.",
      },
    ],
  },
];

const es: GlossaryCategory[] = [
  {
    category: "La Vida de Viaje",
    terms: [
      {
        term: "Deadhead",
        definition:
          "Un piloto en 'deadhead' viaja como pasajero — usualmente de uniforme completo en la cabina principal — pero está de servicio y recibiendo su pago. La aerolínea lo necesita en otro aeropuerto para operar un vuelo.",
      },
      {
        term: "Noche Fuera (Overnight)",
        definition:
          "Una parada de descanso programada fuera del hogar entre días de trabajo. La aerolínea reserva el hotel. El piloto retoma sus vuelos al día siguiente.",
      },
      {
        term: "Vuelo Nocturno (Red-Eye)",
        definition:
          "Un vuelo que sale tarde por la noche y llega temprano en la mañana. El nombre viene del aspecto cansado de los ojos de pasajeros y tripulación tras volar de noche.",
      },
      {
        term: "Crash Pad",
        definition:
          "Un apartamento o casa compartida cerca de la base de la tripulación, usado por pilotos que hacen commute y necesitan un lugar para dormir antes o después de sus viajes sin volar hasta su hogar.",
      },
      {
        term: "TAFB",
        definition:
          "Tiempo Fuera de Base. Registra cuánto tiempo el piloto está fuera durante un viaje. Un TAFB más largo generalmente significa compensación adicional.",
      },
    ],
  },
  {
    category: "El Horario",
    terms: [
      {
        term: "Pairing / Viaje",
        definition:
          "Una secuencia completa de vuelos, noches fuera y periodos de descanso que conforman una asignación de trabajo. Un pairing de 4 días significa que el piloto estará fuera de la base por 4 días volando rutas predeterminadas.",
      },
      {
        term: "Inicio de Servicio / Hora de Presentación",
        definition:
          "La hora oficial de inicio del turno — generalmente 60 a 90 minutos antes de la salida del primer vuelo. Es cuando el piloto se presenta en el aeropuerto, revisa el clima e informa con la tripulación.",
      },
      {
        term: "Tiempo de Bloque",
        definition:
          "El tiempo desde que el avión abandona la puerta hasta que llega a la puerta de destino. Se usa para calcular el pago y es diferente del tiempo de vuelo.",
      },
      {
        term: "Reserva / De Guardia",
        definition:
          "Un piloto en reserva está disponible en espera por si la aerolínea lo necesita — por ejemplo, si otro piloto llama para reportarse enfermo. Debe estar localizable y listo para presentarse con poco aviso.",
      },
      {
        term: "Tiempo Libre (Open Time)",
        definition:
          "Viajes disponibles para que los pilotos los tomen voluntariamente, generalmente con pago adicional. Cuando un piloto toma uno de estos viajes, puede comenzar desde su aeropuerto de origen.",
      },
    ],
  },
  {
    category: "El Commute",
    terms: [
      {
        term: "Piloto Commuter",
        definition:
          "Un piloto cuyo hogar está en una ciudad diferente a su base de tripulación asignada. Viajan hacia y desde la base por su propia cuenta — a menudo usando pases de vuelo gratuitos o con descuento.",
      },
      {
        term: "Base de la Tripulación",
        definition:
          "El aeropuerto donde el piloto está asignado oficialmente. Todos los viajes comienzan y terminan aquí. Un piloto con base en San Juan inicia cada viaje en San Juan, aunque viva en Tampa.",
      },
      {
        term: "Jump Seat",
        definition:
          "Un asiento plegable pequeño en la cabina usado por tripulantes fuera de servicio para viajar entre ciudades, a menudo de forma gratuita. Los pilotos commuter lo usan para llegar a su base.",
      },
      {
        term: "Desvío (Deviation)",
        definition:
          "Cuando un piloto arregla regresar a su casa personal en lugar de seguir la ruta estándar de la compañía hacia la base después de un entrenamiento o viaje. Se hace a cuenta del piloto.",
      },
    ],
  },
  {
    category: "Entrenamiento",
    terms: [
      {
        term: "Simulador",
        definition:
          "Un simulador de vuelo de movimiento completo que replica la cabina de un avión real. Los pilotos lo usan para entrenamiento periódico, procedimientos de emergencia y evaluaciones — sin despegar del suelo.",
      },
      {
        term: "Entrenamiento Recurrente",
        definition:
          "Entrenamiento obligatorio que todos los pilotos deben completar cada año para mantener sus certificaciones vigentes. Incluye sesiones de simulador, clases teóricas y repaso de procedimientos de emergencia.",
      },
      {
        term: "Clases Teóricas (Ground School)",
        definition:
          "Entrenamiento en el aula donde los pilotos estudian sistemas, procedimientos, reglamentos y políticas de la compañía. Generalmente ocurre el día antes de las sesiones de simulador.",
      },
      {
        term: "Checkride (Prueba de Vuelo)",
        definition:
          "Una evaluación por un inspector de la FAA o un piloto verificador para confirmar las habilidades y conocimientos del piloto. Es necesaria para obtener o mantener una certificación.",
      },
      {
        term: "IOE (Experiencia Operacional Inicial)",
        definition:
          "Los primeros vuelos reales de un piloto nuevo con pasajeros tras completar su entrenamiento. Un piloto verificador experimentado supervisa para confirmar que está listo para volar solo.",
      },
    ],
  },
  {
    category: "En el Aire",
    terms: [
      {
        term: "Habilitación de Tipo",
        definition:
          "Una certificación que permite a un piloto volar un tipo de avión específico — por ejemplo, un Airbus A320 o un Boeing 737. Cada tipo requiere entrenamiento y examen por separado.",
      },
      {
        term: "Capitán / Primer Oficial",
        definition:
          "El Capitán ocupa el asiento izquierdo y tiene la autoridad final en el avión. El Primer Oficial (copiloto) ocupa el asiento derecho. Ambos son pilotos completamente certificados.",
      },
      {
        term: "Wheels Up / Block Out",
        definition:
          "Cuando el avión despega (wheels up) o sale de la puerta de embarque (block out). Los pilotos usan estas frases para indicar cuándo salieron exactamente.",
      },
    ],
  },
];

const de: GlossaryCategory[] = [
  {
    category: "Unterwegs",
    terms: [
      {
        term: "Deadhead",
        definition:
          "Ein Deadhead-Pilot reist als Passagier — meist in voller Uniform in der Kabine — ist aber im Dienst und wird bezahlt. Die Airline benötigt ihn an einem anderen Ort, um einen Flug zu besetzen.",
      },
      {
        term: "Übernachtung (Overnight)",
        definition:
          "Ein geplanter Ruhestopp außerhalb des Zuhauses zwischen Arbeitstagen. Die Airline bucht das Hotel. Der Pilot fliegt am nächsten Tag weiter.",
      },
      {
        term: "Nachtflug (Red-Eye)",
        definition:
          "Ein Flug, der spät nachts abfliegt und früh morgens ankommt. Der Name kommt von den müden, geröteten Augen der Passagiere und Besatzung nach einem Nachtflug.",
      },
      {
        term: "Crash Pad",
        definition:
          "Eine geteilte Wohnung oder ein Haus in der Nähe der Crew-Basis, das Pendler-Piloten nutzen, um vor oder nach Trips einen Schlafplatz zu haben, ohne jedes Mal nach Hause zu fliegen.",
      },
      {
        term: "TAFB",
        definition:
          "Zeit außerhalb der Basis (Time Away From Base). Misst, wie lange ein Pilot auf einem Trip unterwegs ist. Längere TAFB bedeutet in der Regel zusätzliche Vergütung.",
      },
    ],
  },
  {
    category: "Der Dienstplan",
    terms: [
      {
        term: "Pairing / Trip",
        definition:
          "Eine vollständige Abfolge von Flügen, Übernachtungen und Ruhezeiten, die einen Arbeitseinsatz bilden. Ein 4-Tage-Pairing bedeutet, dass der Pilot 4 Tage lang auf geplanten Strecken unterwegs ist.",
      },
      {
        term: "Dienstbeginn / Meldezeit",
        definition:
          "Die offizielle Startzeit der Schicht — meist 60 bis 90 Minuten vor dem ersten Abflug. Dann meldet sich der Pilot am Flughafen, prüft das Wetter und bespricht den Einsatz mit der Crew.",
      },
      {
        term: "Blockzeit",
        definition:
          "Die Zeit vom Verlassen des Gates bis zum Andocken am Zielgate. Sie unterscheidet sich von der reinen Flugzeit und wird für die Berechnung der Vergütung verwendet.",
      },
      {
        term: "Reserve / Bereitschaft",
        definition:
          "Ein Pilot in Bereitschaft ist verfügbar und wartet auf Abruf — falls die Airline ihn kurzfristig benötigt, z.B. wenn ein anderer Pilot ausfällt. Er muss erreichbar und einsatzbereit sein.",
      },
      {
        term: "Open Time (freie Trips)",
        definition:
          "Trips, die Piloten freiwillig übernehmen können, meist mit Zusatzvergütung. Dabei kann der Trip vom Heimatflughafen statt von der Basis abfliegen.",
      },
    ],
  },
  {
    category: "Pendeln zur Basis",
    terms: [
      {
        term: "Pendler-Pilot",
        definition:
          "Ein Pilot, dessen Zuhause in einer anderen Stadt liegt als seine zugeteilte Crew-Basis. Er reist auf eigene Kosten — oft mit kostenlosen oder vergünstigten Airline-Tickets — vor und nach jedem Trip.",
      },
      {
        term: "Crew-Basis",
        definition:
          "Der Flughafen, dem ein Pilot offiziell zugeteilt ist. Alle Trips beginnen und enden hier. Ein in San Juan stationierter Pilot startet jeden Trip in San Juan — auch wenn er in Tampa wohnt.",
      },
      {
        term: "Jump Seat",
        definition:
          "Ein kleiner Klappsitz im Cockpit oder in der Kabine, den nicht im Dienst befindliche Crewmitglieder zum Reisen nutzen — oft kostenlos. Pendler-Piloten nutzen ihn, um zur Basis zu kommen.",
      },
      {
        term: "Deviation (Abweichung)",
        definition:
          "Wenn ein Pilot nach einem Training oder Trip direkt nach Hause fliegt statt über die firmeneigene Route zur Basis zurückzukehren. Erfolgt auf eigene Kosten.",
      },
    ],
  },
  {
    category: "Training",
    terms: [
      {
        term: "Simulator",
        definition:
          "Ein Vollbewegungssimulator, der das Cockpit eines echten Flugzeugs nachbildet. Piloten nutzen ihn für regelmäßiges Training, Notfallverfahren und Prüfungen — ohne den Boden zu verlassen.",
      },
      {
        term: "Wiederkehrendes Training",
        definition:
          "Pflichttraining, das alle Piloten jährlich absolvieren müssen, um ihre Zertifizierungen aufrechtzuerhalten. Beinhaltet Simulator-Sitzungen, Theorieunterricht und Notfallverfahren.",
      },
      {
        term: "Bodenunterricht (Ground School)",
        definition:
          "Theoretischer Unterricht, bei dem Piloten Systeme, Verfahren, Vorschriften und Unternehmensrichtlinien studieren. Findet meist am Tag vor den Simulator-Sitzungen statt.",
      },
      {
        term: "Prüfungsflug (Checkride)",
        definition:
          "Eine Bewertung durch einen FAA-Prüfer oder firmeneigenen Checkpiloten zur Bestätigung der Fähigkeiten des Piloten. Erforderlich, um eine Lizenz oder Berechtigung zu erwerben oder zu erhalten.",
      },
      {
        term: "IOE (Erstmalige Betriebserfahrung)",
        definition:
          "Die ersten echten Flüge eines neuen Piloten mit Passagieren nach Abschluss der Ausbildung. Ein erfahrener Checkpilot überwacht, um sicherzustellen, dass der neue Pilot bereit ist.",
      },
    ],
  },
  {
    category: "Im Flugzeug",
    terms: [
      {
        term: "Musterberechtigung",
        definition:
          "Eine Berechtigung, die einem Piloten erlaubt, einen bestimmten Flugzeugtyp zu fliegen — z.B. einen Airbus A320 oder Boeing 737. Jeder Typ erfordert separate Ausbildung und Prüfung.",
      },
      {
        term: "Kapitän / Erster Offizier",
        definition:
          "Der Kapitän sitzt links und hat die letzte Entscheidungsgewalt an Bord. Der Erste Offizier (Kopilot) sitzt rechts. Beide sind vollständig ausgebildete Piloten — der Kapitän hat mehr Erfahrung.",
      },
      {
        term: "Wheels Up / Block Out",
        definition:
          "Wenn das Flugzeug abhebt (Wheels Up) oder vom Gate wegrollt (Block Out). Piloten verwenden diese Begriffe, um den genauen Abflugzeitpunkt anzugeben.",
      },
    ],
  },
];

export const AVIATION_GLOSSARY: Record<FamilyViewLang, GlossaryCategory[]> = { en, es, de };
