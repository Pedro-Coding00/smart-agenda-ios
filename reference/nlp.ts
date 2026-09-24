// Parser linguaggio naturale italiano per il quick capture di Smart Agenda.
// Tutto locale: nessuna API esterna. Estrae data, ora, promemoria, categoria
// automatica e suggerisce la sezione (Devo / Voglio) dal testo.

export type AutoCategory =
  | "universita"
  | "cool"
  | "scazzi"
  | "varie"
  | "cose_mie"
  | "benessere";

export interface ParsedInput {
  remaining: string; // titolo ripulito
  scheduledAt?: number; // data + ora dell'impegno
  allDay?: boolean; // impegno senza ora indicata
  dueAt?: number; // scadenza ("entro venerdì", "deadline")
  reminderAt?: number; // quando inviare la notifica
  reminderMinutesBefore?: number;
  reminderEnabled: boolean;
  autoCategory: AutoCategory;
  section: "DEVO" | "VOGLIO" | null;
  journalWorthy: boolean;
}

const WEEKDAYS: Record<string, number> = {
  domenica: 0,
  lunedi: 1,
  lunedì: 1,
  martedi: 2,
  martedì: 2,
  mercoledi: 3,
  mercoledì: 3,
  giovedi: 4,
  giovedì: 4,
  venerdi: 5,
  venerdì: 5,
  sabato: 6,
};

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

const WORD_NUMBERS: Record<string, number> = {
  una: 1,
  uno: 1,
  un: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  undici: 11,
  dodici: 12,
  tredici: 13,
  quattordici: 14,
  quindici: 15,
  sedici: 16,
  diciassette: 17,
  diciotto: 18,
  diciannove: 19,
  venti: 20,
  ventuno: 21,
  ventidue: 22,
  ventitre: 23,
};

// Parole chiave per la categorizzazione automatica.
const CATEGORY_KEYWORDS: Record<AutoCategory, string[]> = {
  universita: [
    "esame",
    "esami",
    "universita",
    "università",
    "uni",
    "lezione",
    "lezioni",
    "prof",
    "professore",
    "professoressa",
    "tesi",
    "esercitazione",
    "laboratorio",
    "appello",
    "voto",
    "esame di",
    "materia",
    "corso",
    "ricevimento",
    "laurea",
  ],
  cool: [
    "concerto",
    "festa",
    "party",
    "cinema",
    "film",
    "viaggio",
    "gita",
    "exhibition",
    "mostra",
    "concerti",
    "aperitivo",
    "serata",
    "festival",
    "evento",
    "cool",
    "divertente",
  ],
  scazzi: [
    "bolletta",
    "bollette",
    "spesa",
    "farmacia",
    "posta",
    "banca",
    "documento",
    "ricarica",
    "medico",
    "dentista",
    "palestra pagamento",
    "affitto",
    "multa",
    "burocrazia",
    "comune",
    "asf",
    "ricarica telefonica",
    "passaporto",
    "carta identita",
    "carta d'identita",
  ],
  varie: [],
  cose_mie: [
    "diario",
    "progetto personale",
    "mio progetto",
    "passione",
    "hobby",
    "leggere",
    "libro",
    "scrivere",
    "disegnare",
    "musica",
    "chitarra",
    "piano",
    "cose mie",
  ],
  benessere: [
    "allenamento",
    "allenarmi",
    "palestra",
    "correre",
    "corsa",
    "dieta",
    "mangiare sano",
    "sonno",
    "dormire",
    "meditazione",
    "yoga",
    "acqua",
    "vitamine",
    "stretching",
    "benessere",
    "peso",
    "scale",
  ],
};

const WISH_SIGNALS = [
  "voglio",
  "vorrei",
  "mi piacerebbe",
  "un giorno",
  "prima o poi",
  "da fare per piacere",
  "idea",
  "sognare",
];

const DUTY_SIGNALS = [
  "devo",
  "dovrei",
  "obbligatorio",
  "scadenza",
  "entro",
  "consegna",
  "appuntamento",
  "ricordami di",
  "non dimenticare",
];

function stripAccentsLower(s: string): string {
  return s
    .toLowerCase()
    .replace(/'/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayAt(y: number, m: number, day: number, h?: number, min = 0): number {
  return h === undefined
    ? new Date(y, m, day, 23, 59, 59).getTime()
    : new Date(y, m, day, h, min, 0).getTime();
}

function classify(text: string): AutoCategory {
  const t = stripAccentsLower(text);
  let best: AutoCategory = "varie";
  let bestHits = 0;
  (Object.keys(CATEGORY_KEYWORDS) as AutoCategory[]).forEach((cat) => {
    let hits = 0;
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (t.includes(kw)) hits += 1;
    }
    if (hits > bestHits) {
      best = cat;
      bestHits = hits;
    }
  });
  return best;
}

function detectSection(text: string): "DEVO" | "VOGLIO" | null {
  const t = stripAccentsLower(text);
  const wishHit = WISH_SIGNALS.some((w) => t.includes(w));
  const dutyHit = DUTY_SIGNALS.some((w) => t.includes(w));
  if (wishHit && !dutyHit) return "VOGLIO";
  if (dutyHit) return "DEVO";
  return null;
}

function detectJournalWorthy(text: string): boolean {
  const t = stripAccentsLower(text);
  return (
    t.includes("nota") ||
    t.includes("ricorda che") ||
    t.includes("da ricordare") ||
    t.includes("appunto") ||
    t.includes("diario")
  );
}

export function parseItalianQuickCapture(
  raw: string,
  now: number = Date.now(),
): ParsedInput {
  let text = raw.trim();
  const nowDate = new Date(now);

  let day: { y: number; m: number; d: number } | undefined;
  let hour: number | undefined;
  let minute = 0;
  let hasTime = false;

  // --- ORE ---
  // "alle 15", "alle 15:30", "alla una", "alle 9 e mezza"
  const timeMatch = text.match(
    /\b(?:alle?|ora|per)\s+(\d{1,2})(?::(\d{2}))?(?:\s*e\s*(?:mezza|un\s*quarto))?/i,
  );
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    if (timeMatch[2]) {
      minute = parseInt(timeMatch[2], 10);
    } else if (/mezza/i.test(timeMatch[0])) {
      minute = 30;
    } else if (/un\s*quarto/i.test(timeMatch[0])) {
      minute = 15;
    }
    if (hour >= 0 && hour <= 23) {
      hasTime = true;
      text = text.replace(timeMatch[0], " ");
    }
  }

  // --- DATE ---

  // oggi / domani / dopodomani
  if (/\boggi\b/i.test(text)) {
    day = { y: nowDate.getFullYear(), m: nowDate.getMonth(), d: nowDate.getDate() };
    text = text.replace(/\boggi\b\s*/i, " ");
  } else if (/\bdopodomani\b/i.test(text)) {
    const dd = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 2);
    day = { y: dd.getFullYear(), m: dd.getMonth(), d: dd.getDate() };
    text = text.replace(/\bdopodomani\b\s*/i, " ");
  } else if (/\bdomani\b/i.test(text)) {
    const dm = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1);
    day = { y: dm.getFullYear(), m: dm.getMonth(), d: dm.getDate() };
    text = text.replace(/\bdomani\b\s*/i, " ");
  }

  // "tra X giorni" (numeri o parole)
  if (!day) {
    const inDays = text.match(/\btra\s+(\d+|una|due|tre|quattro|cinque|sei|sette)\s+giorn[oi]\b/i);
    if (inDays) {
      const n = /^\d+$/.test(inDays[1])
        ? parseInt(inDays[1], 10)
        : WORD_NUMBERS[inDays[1].toLowerCase()] ?? 1;
      const dd = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + n);
      day = { y: dd.getFullYear(), m: dd.getMonth(), d: dd.getDate() };
      text = text.replace(inDays[0], " ");
    }
  }

  // giorno della settimana: "venerdì", "prossimo lunedì"
  if (!day) {
    const wdMatch = text.match(
      /\b(?:prossim[oa]\s+)?(domenica|lunedì|martedì|mercoledì|giovedì|venerdì|sabato)\b/i,
    );
    if (wdMatch) {
      const target = WEEKDAYS[wdMatch[1].toLowerCase()];
      const current = nowDate.getDay();
      let diff = (target - current + 7) % 7;
      if (diff === 0) diff = 7; // il prossimo, non oggi
      const dd = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + diff);
      day = { y: dd.getFullYear(), m: dd.getMonth(), d: dd.getDate() };
      text = text.replace(wdMatch[0], " ");
    }
  }

  // data completa: "25 dicembre", "3 marzo"
  if (!day) {
    const fullDate = text.match(
      /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/i,
    );
    if (fullDate) {
      const d = parseInt(fullDate[1], 10);
      const m = MONTHS.indexOf(fullDate[2].toLowerCase());
      let y = nowDate.getFullYear();
      if (m !== -1) {
        // se la data è già passata quest'anno, assume l'anno prossimo
        const candidate = new Date(y, m, d, 23, 59, 59).getTime();
        if (candidate < now) y += 1;
        day = { y, m, d };
        text = text.replace(fullDate[0], " ");
      }
    }
  }

  // scadenza esplicita: "entro venerdì" / "deadline 25" (già coperta dal weekday)
  // "entro" senza data: lascia il testo intatto, nessuna scadenza

  // --- PROMEMORIA ---
  // "ricordamelo 30 minuti prima", "promemoria 1 ora prima"
  let reminderMinutesBefore: number | undefined;
  const remMatch = text.match(
    /\b(?:ricordamelo?|promemoria)\s+(?:(\d+)\s*(minut[oi]|ore|ora)|mezz'ora)\s+prima\b/i,
  );
  if (remMatch) {
    if (/mezz'ora/i.test(remMatch[0])) {
      reminderMinutesBefore = 30;
    } else if (/^ore?$|^ora$|ore/i.test(remMatch[2] ?? "")) {
      reminderMinutesBefore = parseInt(remMatch[1], 10) * 60;
    } else {
      reminderMinutesBefore = parseInt(remMatch[1], 10);
    }
    text = text.replace(remMatch[0], " ");
  }

  // --- COSTRUZIONE RISULTATO ---
  let scheduledAt: number | undefined;
  let allDay = false;
  let dueAt: number | undefined;

  if (day) {
    if (hasTime && hour !== undefined) {
      scheduledAt = dayAt(day.y, day.m, day.d, hour, minute);
    } else {
      allDay = true;
      scheduledAt = dayAt(day.y, day.m, day.d); // fine giornata
    }
  }

  if (/\bentro\b|\bscadenza\b|\bdeadline\b/i.test(text) && day) {
    dueAt = scheduledAt;
  }

  let reminderAt: number | undefined;
  const reminderEnabled = scheduledAt !== undefined;
  if (scheduledAt !== undefined && reminderMinutesBefore !== undefined) {
    reminderAt = scheduledAt - reminderMinutesBefore * 60 * 1000;
  }

  // titolo ripulito
  const remaining = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  return {
    remaining: remaining.length > 0 ? remaining : raw.trim(),
    scheduledAt,
    allDay,
    dueAt,
    reminderAt,
    reminderMinutesBefore,
    reminderEnabled,
    autoCategory: classify(raw),
    section: detectSection(raw),
    journalWorthy: detectJournalWorthy(raw),
  };
}
