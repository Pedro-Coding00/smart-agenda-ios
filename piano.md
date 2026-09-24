# Smart Agenda — Piano v3: app nativa iOS senza abbonamento

> Versione 3.1 · 23 settembre 2026 (aggiunto il motore di automatismo, §3.8). Sostituisce `BLUEPRINT.md` v1.0 e il Piano v2.
> Da mettere nella radice del nuovo repository come `PIANO.md` e da indicare all'agente come fonte di verità.
> Lingua di lavoro: italiano.

**Vincoli confermati dal proprietario**
- Mac Intel (Xcode 27 non disponibile).
- iPhone 14 (compatibile con iOS 27; niente Apple Intelligence né Foundation Models).
- Nessun abbonamento Apple Developer da 99 $/anno.
- Obiettivo: un'**app nativa installata sul telefono**, l'idea da cui è nato il progetto.

---

## 1. Cosa è cambiato rispetto al piano originale

| Area | Piano originale (v1.0) | Piano v3 | Perché |
|---|---|---|---|
| **Piattaforma** | PWA React + Convex | **App nativa SwiftUI**, installata in sideload | Idea originale; notifiche e sicurezza più semplici |
| **Compilazione** | Server di sviluppo della piattaforma | **GitHub Actions** (Mac in cloud) produce un `.ipa` non firmato | Il Mac Intel non ha Xcode 27 |
| **Installazione** | Browser / "Aggiungi alla Home" | **SideStore** firma l'app con un Apple ID gratuito e la rinnova ogni 7 giorni dal telefono | Senza 99 $/anno |
| **Backend** | Convex (cloud) | **Nessuno**: SwiftData, dati solo sul telefono | Privacy reale, zero superficie d'attacco |
| **Autenticazione** | Email OTP + ospite anonimo | **Nessuna**; blocco con Face ID facoltativo | I dati non lasciano il dispositivo |
| **Promemoria** | Web Notification API (non funziona su iPhone) | **Notifiche locali iOS**: funzionano offline e con l'app chiusa | Non richiedono l'abbonamento |
| **Parser** | `nlp.ts` condiviso client/backend | Porting in **Swift** delle stesse regole, pacchetto separato e testabile | Stesso comportamento, fuso orario del dispositivo |
| **Diario** | Auto-alimentato dagli impegni | **Raccolta curata**: scrivi solo ciò che vuoi conservare; collegamento facoltativo a un impegno | Tua correzione |
| **Archivio** | Non esisteva | **Nuovo**: registro sintetico automatico delle cose fatte + ricerca "quando ho fatto X?" | Prende il posto dell'auto-diario |
| **Automatismo** | Solo regole a parole chiave | **Motore a 3 livelli** (§3.8): regole, apprendimento dalle tue correzioni, similarità semantica sul telefono (Apple NaturalLanguage, italiano supportato); LLM locale piccolo facoltativo in Fase 6 | L'iPhone 14 non ha Apple Intelligence, ma le altre funzioni di linguaggio di iOS sono disponibili |
| **Voci completate** | Restano per sempre in "Fatte" | "Fatte" mostra 14 giorni, poi le voci finiscono nell'Archivio | Domanda §9.2 |
| **Schema** | `kind` e `section` sovrapposti, validazione spenta | Modello SwiftData tipizzato; `section` obbligatoria; `kind` = `event` / `task` | Stati incoerenti |
| **Modifica / ricorrenze** | Parziale / fuori scope | Modifica completa + ricorrenza **settimanale** | Domanda §9.6 |
| **Backup / export** | Assenti | Backup iCloud dell'iPhone (automatico) + export JSON | Domanda §9.7 |
| **UX** | — | Undo di 5 s · tag correggibili nell'anteprima · sezione "Scadute" | Proposte approvate |
| **Test / CI** | Nessuno | `swift test` sul parser (≥ 40 casi) + build iOS in CI | Domanda §9.5 |
| **Stile** | Neobrutalism, bordeaux #7c2434 | Invariato, riportato in SwiftUI | — |

**Cosa si riusa dal progetto attuale**:
- le regole e i casi di `nlp.ts`;
- i 6 argomenti predefiniti;
- i token di colore e il tema;
- la struttura delle schermate.

Il codice React e Convex resta come riferimento. Non serve migrare dati, a meno che tu ne abbia già inseriti di importanti: in quel caso si fa un'esportazione una tantum da Convex e un'importazione JSON nell'app.

---

## 2. Il percorso: compilazione in cloud + sideload

```
[Agente AI] → scrive Swift nel repository GitHub
     ↓ push
[GitHub Actions, macOS + Xcode] → compila → SmartAgenda.ipa (non firmato) come artefatto
     ↓ scarichi l'.ipa sull'iPhone (Safari/File)
[SideStore sull'iPhone] → lo firma con il tuo Apple ID gratuito → installa
     ↓ ogni 7 giorni
[LocalDevVPN + SideStore "Refresh All"] → rinnova la firma, i dati restano
```

### Perché funziona
- **Compilazione**: i runner macOS di GitHub hanno Xcode aggiornato. Il Mac Intel non serve per compilare.
- **Firma gratuita**: un Apple ID gratuito può firmare app per uso personale. I limiti sono 7 giorni di validità, 3 app attive e 10 App ID a settimana.
- **Nessun Mac collegato per i rinnovi**: SideStore rinnova la firma direttamente sul telefono. Il computer serve **una sola volta** per l'installazione iniziale (iloader, che gira anche su Mac Intel).
- **Notifiche locali**: non richiedono l'abbonamento a pagamento.

### Costi
- **0 €**, con il **repository pubblico**: minuti macOS illimitati su GitHub Actions. Il codice non contiene dati personali, perché quelli stanno solo sul telefono.
- **Repository privato**: circa 200 minuti macOS al mese sul piano gratuito (moltiplicatore 10x), cioè circa 20–30 build. Per ridurle:
  - i test del parser girano su runner Linux, che costano poco;
  - la build iOS parte solo sul branch `main` o a mano.

### Rischi ("zona grigia") e mitigazioni

| Rischio | Mitigazione |
|---|---|
| SideStore simula un Mac verso Apple per firmare: tollerato ma non ufficiale; Apple può cambiare le regole | Usare un **Apple ID secondario** dedicato alla firma; export JSON regolare; piano B (§2.3) |
| Server "anisette" pubblici e vecchi possono causare il blocco dell'Apple ID | Usare il server anisette ufficiale di SideStore; mai quelli di terzi sconosciuti; Apple ID secondario |
| Dimenticare il rinnovo per più di 7 giorni: l'app non si apre | I dati **non si perdono**: dopo il rinnovo l'app riparte. Promemoria settimanale nel calendario iOS "Rinnova SideStore" |
| Un aggiornamento iOS rompe temporaneamente SideStore | Non aggiornare iOS subito; seguire il canale SideStore; export JSON prima di ogni aggiornamento |
| Il file di pairing si invalida (reset del telefono o altri casi) | Rifarlo con iloader dal Mac (5 minuti) |

**Da evitare**:
- servizi a pagamento di "certificati enterprise" condivisi: vengono revocati spesso, sono inaffidabili e installano profili di terzi sul tuo telefono;
- il jailbreak.

### 2.3 Piano B, se il sideload diventa scomodo

**PWA con Web Push.** L'iPhone 14 supporta le push web per le app aggiunte alla Home (iOS 16.4+). Si riprende il Piano v2, ramo PWA: stesso diario e archivio, backend Convex.

**Variante AltStore Classic.** Rinnovo tramite AltServer sul Mac Intel, con il Mac acceso sulla stessa Wi-Fi una volta a settimana. Più macchinosa, ma non usa la VPN.

---

## 3. Piano rifinito completo

### 3.1 Obiettivo
Un'agenda nativa sull'iPhone di cui fidarsi ogni giorno. Deve permettere di:
- catturare un impegno in una riga;
- ricevere i promemoria sempre;
- tenere un diario curato;
- ritrovare "quando ho fatto X".

**Criterio di successo**: 2 settimane di uso quotidiano con queste condizioni:
- nessun promemoria perso;
- nessun impegno nel giorno sbagliato;
- nessuna perdita di dati dopo i rinnovi di SideStore.

### 3.2 Requisiti funzionali
1. **Quick capture in italiano**:
   - estrae data, ora, promemoria, categoria e sezione da una riga;
   - anteprima dei tag durante la digitazione, correggibili con un tap.
2. **Calendario settimanale** lun→dom con indicatore di carico; tap sul giorno → vista giornata ordinata per orario.
3. **Sezioni Devo / Voglio** (Devo: Università, Scazzi, Cose da fare; Voglio: Roba cool, Cose mie, Benessere):
   - liste attive;
   - lista "Fatte" limitata a 14 giorni.
4. **Schede argomento** con conteggio e casella **"chiedi"**:
   - prossimo impegno;
   - riepilogo;
   - elenco;
   - "quando ho fatto X?" sull'Archivio.
5. **Diario (curato)**:
   - voci libere: titolo facoltativo, testo, data, argomento facoltativo;
   - collegamento facoltativo a un impegno;
   - niente viene aggiunto in automatico;
   - su un impegno completato, pulsante "Scrivi nel diario" che precompila la voce.
6. **Archivio (automatico)**:
   - ogni completamento diventa una riga sintetica: data, titolo, argomento;
   - ricerca per testo (ultima occorrenza + tutte le date);
   - filtri per argomento e periodo.
7. **Promemoria locali** 10 min / 1 ora / 1 giorno prima, con app chiusa.
8. **Modifica completa** ed **eliminazione** degli impegni.
9. **Ricorrenza settimanale** (giorni della settimana, data di fine facoltativa).
10. **Sezione "Scadute"** in cima alla vista Oggi.
11. **Undo di 5 s** dopo completamento o eliminazione.
12. **Export / import JSON** dalle impostazioni, tramite il foglio di condivisione iOS.
13. **Argomenti predefiniti** (6 preset), modificabili.
14. **Blocco con Face ID** (facoltativo, dalle impostazioni).

### 3.3 Requisiti non funzionali
- **Stile**: Neobrutalism Minimalism.
  - angoli vivi;
  - bordi neri 2 pt;
  - ombre piatte con offset;
  - scala di grigi + bordeaux #7c2434;
  - copy in italiano, serio e premium.
- **Fuso orario**: quello del dispositivo (Europe/Rome), con cambio d'ora corretto. Prossimo cambio: domenica 25/10/2026.
- **Privacy**:
  - nessun server;
  - nessuna rete;
  - nessuna analitica;
  - dati solo in SwiftData, inclusi nel backup iCloud dell'iPhone.
- **Accessibilità**: VoiceOver, Dynamic Type, contrasto AA, target touch ≥ 44 pt.
- **Compatibilità**: iOS 17 come versione minima (iOS 26/27 sull'iPhone 14).

### 3.4 Architettura

| Livello | Scelta |
|---|---|
| Progetto | **XcodeGen** (`project.yml` → `.xcodeproj` generato). L'agente non modifica mai `.pbxproj` a mano: è la prima causa di progetti corrotti |
| UI | SwiftUI, navigazione a tab: Oggi · Settimana · Devo/Voglio · Argomenti · Diario · Archivio |
| Dati | SwiftData, modelli nel §3.5 |
| Logica | Pacchetto Swift `AgendaCore`, senza dipendenze da UI: parser, ricorrenze, ricerca, "chiedi". Testabile con `swift test` anche su Linux |
| Promemoria | `UNUserNotificationCenter`. iOS tiene al massimo **64** notifiche in coda: si pianificano le 64 più vicine e si ripianificano all'apertura dell'app e a ogni modifica |
| Tema | `Theme.swift` con i token (colori, bordo, ombra) e modificatori `.neoCard()`, `.neoButton()` |
| CI | GitHub Actions: job Linux `swift test` (a ogni push) + job macOS `xcodebuild` → `.ipa` non firmato come artefatto |
| Distribuzione | SideStore + LocalDevVPN sull'iPhone, Apple ID secondario |

### 3.5 Modello dati (SwiftData)

```
Topic      id, name, section (DEVO|VOGLIO), icon, order, isPreset
Entry      id, title, notes?, kind (event|task), section (DEVO|VOGLIO), topic
           startsAt?: Date, allDay: Bool
           reminderOffsetMin?: 10|60|1440
           recurrence?: { weekdays: [Int], until: Date? }
           completedAt?: Date, createdAt, updatedAt
DiaryNote  id, date, title?, body, topic?, entry?, createdAt, updatedAt      // curato
ArchiveItem id, entryId, occurrenceDate, title, topicName, doneAt            // automatico
           vincolo: univoco su (entryId, occurrenceDate)
LearnedHint id, token (lemma), topic, section, weight, updatedAt           // apprendimento (§3.8)
EmbeddingCache id, sourceId, vector: Data, modelVersion                    // similarità (§3.8)
```

**Regole**
- **Completamento**: si imposta `completedAt` e si fa un *upsert* su `ArchiveItem`. Se l'impegno viene riaperto, la riga d'archivio si rimuove. Completare due volte non crea doppioni.
- **Ricorrenze**: le occorrenze si calcolano al momento, non si copiano nel database. Ogni occorrenza completata crea una riga d'archivio.
- **Parser**: produce `Date` nel fuso del dispositivo. Un anno non scritto va verso il futuro ("5 gennaio" scritto a settembre = anno successivo).

### 3.6 Fuori scope
- più utenti;
- sync con più dispositivi (richiederebbe CloudKit, quindi l'abbonamento);
- widget (possibile più avanti: consuma un App ID in più);
- AI in cloud (nessun dato esce dal telefono);
- inglese nel parser;
- ricorrenze non settimanali;
- App Store.

### 3.8 Motore di automatismo (senza Apple Intelligence)

**Cosa non cambia.** Estrarre data, ora, promemoria e ricorrenze è compito del parser a regole, già nel v1.0 nessuna AI era coinvolta. Qui le regole sono **meglio** di un modello linguistico: sono deterministiche, testabili e non sbagliano un "martedì" di un giorno.

**Dove le sole regole si inceppano.**
- **Categorie**: "allenamento gambe" non contiene "palestra", quindi rischia di finire nella categoria sbagliata.
- **"Chiedi"**: capisce solo domande nella forma prevista.

La soluzione è un motore a livelli, tutto sul telefono e offline dopo il primo avvio.

| Livello | Cosa fa | Tecnologia | Quando |
|---|---|---|---|
| **1. Regole** | Date, ore, promemoria, ricorrenze; parole chiave per argomento e sezione | `AgendaCore` (Swift puro, testato) | Fase 1 |
| **2. Apprendimento personale** | Ogni volta che correggi un tag, l'app memorizza parole ed etichetta. Un classificatore Naive Bayes allenato **sulla tua storia** (poche centinaia di righe di Swift, niente librerie) propone la categoria. Dopo 2–3 correzioni simili sbaglia sempre meno | `AgendaCore` + tabella `LearnedHint` | Fase 2 |
| **3. Similarità semantica** | Confronta il significato della frase con le voci passate e con una descrizione di ogni argomento: "allenamento gambe" viene riconosciuto come vicino a "palestra". Serve anche alla ricerca "quando ho fatto X?", che trova voci scritte con altre parole | Apple **NaturalLanguage**: `NLContextualEmbedding` (iOS 17+, italiano supportato; i dati del modello si scaricano una volta, poi offline) + lemmatizzazione `NLTagger` | Fasi 2–3 |
| **4. LLM locale (facoltativo)** | Solo per le domande libere nel "chiedi". Il modello **traduce** la domanda in una richiesta strutturata (intento + parole + periodo); la risposta la calcola l'app sui tuoi dati, così il modello non può inventare date | Modello piccolo da 1–1,5 miliardi di parametri, quantizzato a 4 bit (~0,7–1 GB), con MLX Swift o llama.cpp, scaricato su richiesta | Fase 6 facoltativa, solo se dopo 2 settimane il "chiedi" a intenti non basta |

**Come si combinano i livelli per la categoria**
1. Le regole danno una proposta con un grado di confidenza.
2. Se la confidenza è bassa, decide chi è più sicuro tra apprendimento (livello 2) e similarità (livello 3).
3. Se anche così è incerta, il tag compare con un "?" nell'anteprima e basta un tap per confermare. La conferma alimenta il livello 2.

**Intenti del "chiedi" (livelli 1 + 3, senza LLM)**
- Prossimo impegno.
- Riepilogo di oggi, della settimana, di un argomento.
- Quando ho fatto X / l'ultima volta che.
- Quante volte X in un periodo.
- Cosa c'è di scaduto.
- Cosa ho scritto nel diario su X.

Le domande vengono riconosciute con modelli di frase e sinonimi, e la parola chiave X si cerca per significato, non solo per testo esatto.

**Limiti onesti**
- Senza LLM, domande molto libere ("com'è andato il mese in università?") ricevono un riepilogo standard, non una risposta scritta su misura.
- Un LLM da 1B parla un italiano mediocre. Per questo, nel livello 4, lo si usa solo per capire la domanda, mai per scrivere la risposta.

### 3.9 Decisioni sulle 9 domande aperte del blueprint
1. **Piattaforma**: nativa SwiftUI in sideload. Il porting diventa il piano principale, la PWA resta il piano B.
2. **Voci completate**: "Fatte" di 14 giorni, poi Archivio. Nessuna eliminazione.
3. **Validazione schema**: superata. SwiftData è tipizzato; i modelli sono versionati con `VersionedSchema` dalla prima release, per le migrazioni future.
4. **Notifiche**: notifiche locali. Il limite web sparisce.
5. **Test e CI**: `swift test` sul parser (≥ 40 casi) + build iOS in CI a ogni merge su `main`.
6. **Modifica e ricorrenze**: incluse; solo ricorrenza settimanale.
7. **Export**: JSON manuale e import, più il backup iCloud del telefono.
8. **Produzione**: la "produzione" è la build installata con SideStore dal branch `main`. Ogni `.ipa` ha una versione (`CFBundleShortVersionString`).
9. **Collaudo**: checklist del §6.

---

## 4. Scelta del modello (menu Freebuff)

Criteri: **DeepSWE** (sviluppo reale su più file), **Terminal-Bench 2.1** (build e correzione di errori da log: cruciale qui, perché l'agente vede gli errori di compilazione solo dai log della CI) e **WebDev Arena** (qualità visiva, voti umani). Dati BenchLM / Arena.ai / Artificial Analysis, settembre 2026. Differenze sotto 2–3 punti = pareggio.

| Modello | DeepSWE | T-Bench 2.1 | WebDev Arena | Note |
|---|---|---|---|---|
| DeepSeek V4.1 Flash | **74,2** | **90,6** | #17 · 1616 | Il più forte tra i gratuiti; etichetta "Data" (il codice può finire in addestramento: accettabile, il codice non contiene dati personali) |
| Gemini 3.8 Flash (Pro) | 73,8 | 89,4 | #22 · 1583 | Pari a DeepSeek, il più veloce, senza "Data" |
| MiMo 2.6 Pro (Pro) | 71,9 | 89,9 | 1628 provvisorio | Lento (~39 s al primo token), appena uscito |
| MiMo 2.6 Flash | 67,9 | 87,6 | n.d. | Alternativa gratuita senza "Data" |
| GPT-5.6 Luna | 67,2 | 84,7 (v2.0) | #37 · 1520 | Migliore nella correzione di bug (SWE-bench Vals 93,0) |
| GLM 5.3 Flash | 63,4 | 84,3 | #18 · 1612 | Ragionamento profondo, legge immagini, senza "Data" |
| Muse Spark 1.2 / Solar Pro 4 | 59,3 / — | 82,9 / 57,0 | #35 / #90 | Da evitare |

**Swift**: non esiste un benchmark affidabile e comparabile per questi modelli. La verifica vera è la compilazione in CI, quindi si dà più peso a Terminal-Bench.

| Ruolo | Piano gratuito | Con piano Pro |
|---|---|---|
| Sviluppo (logica, dati, notifiche, CI) | **DeepSeek V4.1 Flash** | Gemini 3.8 Flash |
| Design e UI (con screenshot dell'iPhone) | **GLM 5.3 Flash** | GLM 5.3 Flash |
| Decisioni difficili / architettura | **GLM 5.3 Flash** | MiMo 2.6 Pro |
| Revisione a fine fase | **GPT-5.6 Luna** | GPT-5.6 Luna |

**Regola d'oro**: chi scrive il codice non lo revisiona. Ogni fase si chiude con la revisione di un modello diverso.

---

## 5. Produzione in fasi

**Ordine**:
1. prima si dimostra che la catena build → installazione funziona (è il rischio più alto);
2. poi le fondamenta (dati, parser, tema);
3. poi le funzioni;
4. il design fine per ultimo.

Ogni fase tocca un gruppo compatto di file.

### Fase 0 — Setup (tu, circa 1 ora, nessun modello)
1. Creare un **Apple ID secondario** per la firma. Non serve sull'iPhone come account iCloud: si usa solo dentro SideStore.
2. Creare un account GitHub e un repository **pubblico** `smart-agenda-ios`. Se privato, vedi i costi nel §2.
3. Installare **SideStore** sull'iPhone con **iloader** dal Mac Intel: genera il pairing file, poi installare **LocalDevVPN** dall'App Store. Seguire la guida ufficiale su docs.sidestore.io.
4. Scegliere il bundle ID (es. `it.piero.smartagenda`).
5. Mettere questo file nel repository come `PIANO.md`.
- **Fatto quando**: SideStore si apre sull'iPhone e fa "Refresh" senza errori.

### Fase 1 — Pipeline e fondamenta
- **Modello**: DeepSeek V4.1 Flash (Pro: Gemini 3.8 Flash). **Revisione**: GPT-5.6 Luna.
- **Parte A: prima la pipeline** (non passare alla parte B finché non funziona):
  - `project.yml` XcodeGen;
  - app minima "Smart Agenda" con il tema;
  - workflow GitHub Actions: job Linux `swift test` e job macOS `xcodegen` + `xcodebuild archive` con `CODE_SIGNING_ALLOWED=NO`, impacchettamento in `Payload/` → `.ipa`, caricamento come artefatto;
  - installazione tramite SideStore e prova di una notifica locale di test.
- **Parte B: fondamenta**:
  - pacchetto `AgendaCore` con il porting del parser da `nlp.ts`;
  - almeno 40 test, tra cui: cambio d'ora del 25/10, "stasera", "domani" scritto alle 23:30, "il 5 gennaio" scritto a settembre, "prossimo venerdì", "tra 3 giorni", ore "alle 9" e "alle 21", casi negativi;
  - modelli SwiftData del §3.5 con `VersionedSchema`;
  - `Theme.swift` completo;
  - preset dei 6 argomenti.
- **Fatto quando**:
  - l'app installata da SideStore si apre e mostra una notifica di test ad app chiusa;
  - CI verde;
  - test del parser verdi.

### Fase 2 — Agenda e promemoria
- **Modello**: DeepSeek V4.1 Flash (Pro: Gemini 3.8 Flash). **Revisione**: GPT-5.6 Luna.
- **Attività**:
  - quick capture con anteprima e tag correggibili;
  - vista Oggi con "Scadute";
  - calendario settimanale e vista giornata;
  - Devo/Voglio con "Fatte" di 14 giorni;
  - modifica ed eliminazione;
  - ricorrenza settimanale;
  - pianificatore delle notifiche: finestra delle 64, ripianificazione a ogni modifica e all'apertura dell'app, cancellazione all'eliminazione o al completamento;
  - **motore di categorizzazione, livelli 2 e 3** (§3.8): `LearnedHint` + Naive Bayes, `NLContextualEmbedding` con cache, combinazione per confidenza, tag con "?" quando è incerta. Classificatore e combinazione stanno in `AgendaCore`, con test; l'embedding è dietro un protocollo, così i test usano un finto embedding.
- **Fatto quando**: gli scenari 1–5, 9 e 14–15 del §6 passano sul telefono.

### Fase 3 — Diario, Archivio, "chiedi", export
- **Modello**: DeepSeek V4.1 Flash (Pro: Gemini 3.8 Flash). **Revisione**: GPT-5.6 Luna.
- **Attività**:
  - Diario curato con "Scrivi nel diario" da un impegno completato;
  - Archivio automatico con upsert e rimozione se l'impegno viene riaperto;
  - schede argomento con la casella "chiedi": intenti del §3.8, ricerca "quando ho fatto X?" per significato (livello 3);
  - export e import JSON;
  - blocco con Face ID.
- **Fatto quando**: gli scenari 6–8 e 11–13 del §6 passano.

### Fase 4 — UX e design
- **Modello**: GLM 5.3 Flash, a cui mandi screenshot dall'iPhone. **Revisione**: GPT-5.6 Luna.
- **Attività**:
  - rifinitura neobrutalist di tutte le schermate;
  - undo di 5 s;
  - stati vuoti ed errori in italiano;
  - animazioni sobrie;
  - Dynamic Type e VoiceOver;
  - icona dell'app;
  - leggibilità del Diario.
- **Fatto quando**: scenario 10 del §6 passa e le schermate sono coerenti tra loro.

### Fase 5 — Collaudo e uso reale
- **Modello**: GPT-5.6 Luna (revisione finale di tutto il repository rispetto a questo piano). Correzioni: DeepSeek V4.1 Flash.
- **Attività**:
  - checklist del §6 completa sul telefono;
  - build `1.0` da `main`;
  - promemoria settimanale "Rinnova SideStore" nel calendario iOS;
  - 2 settimane di uso, annotando i problemi in `NOTE_USO.md`.
- **Fatto quando**: criterio di successo del §3.1 raggiunto, compreso almeno un rinnovo SideStore senza perdita di dati.

### Fase 6 (facoltativa) — LLM locale per il "chiedi"
- **Quando**: solo se in `NOTE_USO.md` risultano domande frequenti che gli intenti non capiscono.
- **Modello di sviluppo**: DeepSeek V4.1 Flash (Pro: Gemini 3.8 Flash). Scelta del modello locale: GLM 5.3 Flash. **Revisione**: GPT-5.6 Luna.
- **Attività**:
  - integrare MLX Swift o llama.cpp;
  - modello da 1–1,5 miliardi di parametri a 4 bit, scaricato su richiesta dalle impostazioni;
  - prompt che produce **solo JSON** {intento, parole, periodo}, validato;
  - se il JSON non è valido si torna al "chiedi" a intenti.
  - **Prima di integrare**: misurare memoria e velocità sull'iPhone 14 (A15, 6 GB) con 2–3 modelli candidati.
- **Fatto quando**:
  - 20 domande libere di prova danno una richiesta corretta in almeno 16 casi;
  - la risposta arriva in meno di 3 s;
  - nessun crash per memoria.

---

## 6. Checklist di collaudo (sull'iPhone)
1. "Dentista domani alle 17 promemoria 1 ora" → impegno corretto, tag giusti, notifica alle 16:00 **con app chiusa**.
2. Impegno creato alle 23:30 per "domani" → finisce nel giorno giusto.
3. Impegno dopo il cambio d'ora del 25/10 → ora corretta.
4. Modifica dell'orario → la vecchia notifica è cancellata e la nuova pianificata.
5. Oltre 64 promemoria futuri → i più vicini arrivano tutti.
6. Completare → riaprire → completare → una sola riga in Archivio.
7. "Quando ho fatto palestra?" → date corrette, la più recente in cima.
8. "Scrivi nel diario" da un impegno completato → nota collegata; nessuna nota creata in automatico.
9. Ricorrenza "palestra lun e gio" → occorrenze e promemoria corretti per 4 settimane.
10. Undo dopo l'eliminazione → voce ripristinata con il suo promemoria.
11. Tag categoria corretto con un tap nell'anteprima → salvato con il tag corretto.
12. Export JSON → import su installazione pulita → dati identici.
13. Rinnovo SideStore (o app scaduta e poi rinnovata) → dati intatti.
14. "Allenamento gambe giovedì alle 18" (nessuna parola chiave "palestra") → argomento Benessere proposto, oppure "?" con un tap per confermare.
15. Corretto 2 volte "riunione tesi" → Università: la terza volta la categoria è proposta correttamente senza correzione.
16. "Quando ho fatto palestra?" trova anche voci intitolate "allenamento" o "corsa".

---

## 7. Prompt di avvio per ogni fase

> Leggi `PIANO.md`. Esegui **solo la Fase N**. Non modificare mai `.pbxproj`: modifica `project.yml` (XcodeGen). Rispetta il modello dati del §3.5 e i criteri "Fatto quando". La logica va in `AgendaCore`, con test. Alla fine: file modificati, esito della CI (link al run), criteri soddisfatti o no, deviazioni dal piano con motivo. Rispondi in italiano.

Revisione (con un modello diverso):

> Agisci come revisore esterno. Confronta il codice con `PIANO.md`, Fase N. Segnala: criteri non soddisfatti, bug (date, fuso orario, notifiche, doppioni in Archivio), deviazioni non dichiarate. Non modificare il codice. Rispondi in italiano.

---

## 8. Fonti
- Compatibilità iOS 27 (iPhone 14 incluso; Apple Intelligence solo su 15 Pro o successivi): https://www.macrumors.com/2026/09/14/ios-27-compatible-iphones/
- Requisiti Xcode (26.x fino a Sequoia/Tahoe, 27 solo Apple silicon): https://developer.apple.com/xcode/system-requirements , https://blakecrosley.com/blog/xcode-27-drops-intel
- Account Apple gratuito e a pagamento (7 giorni, 3 dispositivi, niente push remote né CloudKit): https://developer.apple.com/support/compare-memberships/
- SideStore, FAQ (rinnovo sul dispositivo, 3 app, 10 App ID, rischio anisette): https://docs.sidestore.io/docs/faq
- SideStore + LocalDevVPN su iOS 26 (computer una volta sola, iloader): https://fr0stb1rd.gitlab.io/posts/ios-26-unlimited-sideload-sidestore-livecontainer/
- Minuti macOS gratuiti su GitHub Actions: https://dev.to/maclessdev/github-actions-free-macos-minutes-explained-33p7
- Apple NaturalLanguage, modelli multilingua (NLContextualEmbedding, italiano incluso): https://developer.apple.com/videos/play/wwdc2023/10042/
- Benchmark modelli: https://arena.ai/leaderboard/code/ · https://benchlm.ai/models/ (deepseek-v4-1-flash, glm-5-3-flash, gpt-5-6-luna, gemini-3-8-flash, mimo-v2-6-pro, mimo-v2-6-flash, muse-spark-1-2, solar-pro-4)
