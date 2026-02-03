# LES02 Fahrkurven-Analyse – Projektübersicht

**Technical Project Documentation**

---

## 1. Projektbeschreibung

Dieses Projekt entwickelt ein Software-Werkzeug zur **Echtzeit-Visualisierung von Aufzug-Fahrkurven** für Prüfstand-Techniker in der Aufzugkomponenten-Produktion. Das Tool ermöglicht die objektive Bewertung und Optimierung mechanischer Ventilparameter auf Basis präziser Sensordaten.

### Kernfunktion

> Ein internes Werkzeug für Prüfstand-Techniker zur Echtzeit-Visualisierung von Aufzug-Fahrkurven, um das Einstellen von Steuerventilen von Rätselraten in präzise, datengetriebene Anpassungen zu verwandeln.

---

## 2. Kontext und Motivation

### 2.1 Ist-Zustand (Current State)

Einsatz in Unternehmen welche Aufzugkomponenten fertigen, primär mechanische Steuerventile. Aufgrund von Fertigungstoleranzen muss jedes Ventil vor der Auslieferung auf einem Prüfstand individuell mechanisch voreingestellt werden.

**Aktuelle Probleme:**

* Ventil-Einstellung erfolgt heuristisch und subjektiv
* Mehrere mechanische Parameter beeinflussen die Fahrkurve mit überlappenden Effekten
* Wiederholte Testfahrten nötig, um optimale Einstellung zu finden
* Keine objektive Bewertung der Fahrkurvenqualität
* Inkonsistente Ergebnisse zwischen Chargen
* Prüfstände sind ein Produktionsengpass

### 2.2 Soll-Zustand (Target State)

* **Objektive Bewertung:** Fahrkurven werden in Echtzeit visualisiert und können mit Referenzkurve verglichen werden
* **Reduzierte Einstellzeit:** Techniker sehen sofort die Auswirkung mechanischer Anpassungen
* **Konsistente Qualität:** Standardisierte, reproduzierbare Einstellung über alle Ventile hinweg
* **Datengetriebene Optimierung:** Grundlage für zukünftige automatisierte Parameteroptimierung
* **Dokumentation:** Jede Fahrt kann für Qualitätssicherung und R&D archiviert werden

---

## 3. Projektziele

### 3.1 Phase 1: Prototyp (Proof of Concept)

**Ziel:** Funktionsfähiger Prototyp zur Einholung der Projektfreigabe

**Umfang:**

* Erfassung von Positionsdaten über CAN-Bus vom LES02 Schachtkopiersystem (Mock)
* Echtzeit-Berechnung von Geschwindigkeit und Beschleunigung aus Positionsdaten
* Live-Visualisierung als Diagramm im Web-UI
* Stabiler Betrieb während Testfahrten
* Demonstration des Potentials für Stakeholder

**Erfolg:** Ein Techniker kann eine Fahrkurve live beobachten und die Visualisierung ist sofort verständlich.

### 3.2 Phase 2: Produktionsversion

**Ziel:** Vollständige Version für den produktiven Einsatz am Prüfstand

**Zusätzliche Features:**

* Persistierung abgeschlossener Fahrten (SQLite)
* Historische Datenansicht (Browser für vergangene Fahrten)
* Referenzkurven-Overlay (Soll-Fahrkurve zum Vergleich)
* Vergleichsansicht (aufgezeichnete Fahrt vs. Referenz)
* Erweiterte Fehlerbehandlung und Diagnose
* Export-Funktionen (CSV, PNG)

**Erfolg:** Prüfstand-Techniker nutzen das Tool täglich zur Ventil-Einstellung und berichten messbare Zeitersparnis.

---

## 4. Non-Goals

Das Projekt umfasst **explizit nicht:**

* **Cloud-Backend:** System läuft vollständig lokal
* **User Accounts:** Keine Authentifizierung, kein Multi-User-Management
* **Steuerungsfunktion:** Tool ist rein analytisch, keine CAN-Nachrichten werden gesendet
* **Automatische Ventileinstellung:** Keine Regelung oder automatisierte Anpassung (perspektivisch möglich)
* **Sicherheitsrelevante Funktionen:** Keine Safety-Critical-Features
* **Mobile Apps:** Fokus auf Web-UI für Desktop/Tablet Ansicht mit CAN-Bus support

---

## 5. Zielgruppe

### 5.1 Primäre Nutzer

* **Prüfstand-Techniker** in der Produktion

### 5.2 Sekundäre / Zukünftige Nutzer

* Feld-Service-Techniker
* Installations-Techniker beim Kunden
* R&D für Langzeit-Datenanalyse

### 5.3 Nutzer-Charakteristika

* Technisch versiert, aber keine Software-Entwickler
* Erwartung: Zuverlässigkeit und Ease-of-Use
* UI muss ohne ausführliche Erklärung nutzbar sein
* Arbeitsumgebung: industrieller Prüfstand, möglicherweise rau/laut

---

## 6. System-Architektur (High-Level)

### 6.1 Architektur-Prinzipien

* **Einfach und robust** vor Feature-Reichtum
* **Strikte Trennung** von Datenquelle, Verarbeitung und Visualisierung
* **Lokale Ausführung** ohne Cloud-Abhängigkeit, Zugriff auf WebUI nur auf gleicher Hardware oder lokales Netzwerk (RFC-1918)
* **Fail-Safe Verhalten** bevorzugt vor Feature-Vollständigkeit
* **Austauschbare Datenquellen** (Live CAN, Mock, Replay)

### 6.2 Komponenten-Übersicht

```
┌─────────────────────────────────────────────────────────┐
│  Elevator / Test Bench                                  │
│  ↓                                                      │
│  Kübler Ants LES02 Shaft Copying System                 │
└─────────────────────────────────────────────────────────┘
                    │
                    │ CAN-Bus (250 kbit/s, SocketCAN)
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Python CAN Listener & WebSocket Server                 │
│  ├── CAN Reader (can0 / vcan0)                          │
│  ├── Frame Parser (Position, Status, Error, System)     │
│  ├── Event Generator (EventEnvelope)                    │
│  └── WebSocket Broadcaster (ws://localhost:8765)        │
└─────────────────────────────────────────────────────────┘
                    │
                    │ WebSocket (JSON Events)
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Next.js Web UI                                         │
│  ├── WebSocket Client                                   │
│  ├── Live Chart Visualization                           │
│  ├── Historical Data Browser (Phase 2)                  │
│  └── Reference Curve Overlay (Phase 2)                  │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Datenfluss

1. **Sensor → CAN-Bus:** LES02 sendet absolute Positionswerte alle 2ms (abwechselnd Master/Slave -> Plausibilitätsprüfung)
2. **CAN → Python:** CAN-Reader filtert Position-Frames und verarbeitet diese in Lesbare Werte für Position, Geschwindigkeit und Beschleunigung
3. **Python → WebSocket:** Parser erstellt daraus `motion_sample` Events und sendet diese über Websocket
4. **WebSocket → Web-UI:** Browser empfängt Events als JSON-Stream
5. **Web-UI → Chart:** Live-Update des Liniendiagramms (Position/Geschwindigkeit/Beschleunigung über Zeit)

---

## 7. Hardware und Systemanforderungen

### 7.1 Sensor

* **Gerät:** Kübler Ants LES02 Schachtkopiersystem
* **Funktion:** Absoluter Positionssensor für Aufzuganlagen
* **Auflösung:** 1 mm
* **Maximale Geschwindigkeit:** 8 m/s (funktional bis 12 m/s)
* **Redundanz:** Dual-Channel (Master & Slave) für Safety

### 7.2 CAN-Bus Kommunikation

* **Protokoll:** CAN 2.0A (11-Bit Identifier)
* **Baudrate:** 250 kbit/s
* **Relevante CAN-IDs:**
  * `0x80` – Position Master
  * `0x81` – Position Slave
  * `0x10/0x11` – System (Lock/Unlock)
  * `0x20/0x21` – Error
  * `0x30/0x31` – Status
* **Sendeintervall Positionsdaten:** alle 2 ms (effektiv 500 Hz)

### 7.3 Zielplattform

**Prototyp & Entwicklung:**

* Laptop mit NixOS/Linux
* Virtuelles CAN-Interface (vcan0) für Entwicklung ohne Hardware
* USB-CAN-Interface

**Produktiv:**

* Raspberry Pi am Prüfstand montiert **oder**
* Industrie-PC am Prüfstand
* Kein Internet-Zugang erforderlich
* geg. Zugriff auf lokales Netz -> Web-UI erreichbar innerhalb des Netzwerks

---

## 8. Funktionale Anforderungen

### 8.1 Phase 1 (Prototyp)

| Requirement ID | Beschreibung                                                      | Priorität |
| -------------- | ----------------------------------------------------------------- | --------- |
| FR-P1-01       | System empfängt CAN Position-Frames von LES02                     | Muss      |
| FR-P1-02       | System parsed Positionswerte aus CAN-Payload                      | Muss      |
| FR-P1-03       | System broadcasted `motion_sample` Events via WebSocket           | Muss      |
| FR-P1-04       | Web-UI empfängt Events und zeigt Live-Chart                       | Muss      |
| FR-P1-05       | Chart aktualisiert sich kontinuierlich während Fahrt              | Muss      |
| FR-P1-06       | System zeigt Verbindungsstatus (WebSocket connected/disconnected) | Muss      |
| FR-P1-07       | System funktioniert mit Mock-Datenquelle (ohne echtes CAN)        | Muss      |
| FR-P1-08       | UI ist im Dark Mode optimiert                                     | Sollte    |
| FR-P2-09       | Berechnung und Anzeige von Geschwindigkeit (abgeleitet)           | Muss      |
| FR-P2-10       | Berechnung und Anzeige von Beschleunigung (abgeleitet)            | Muss      |

### 8.2 Phase 2 (Produktionsversion)

| Requirement ID | Beschreibung                                            | Priorität |
| -------------- | ------------------------------------------------------- | --------- |
| FR-P2-01       | System persistiert abgeschlossene Fahrten in SQLite     | Muss      |
| FR-P2-02       | Web-UI zeigt Liste historischer Fahrten (Datum/Zeit)    | Muss      |
| FR-P2-03       | Nutzer kann historische Fahrt auswählen und anzeigen    | Muss      |
| FR-P2-04       | System kann Referenzkurve (Soll-Profil) laden           | Sollte    |
| FR-P2-05       | Web-UI zeigt Overlay: aufgezeichnete Fahrt vs. Referenz | Sollte    |
| FR-P2-06       | Export-Funktion: Fahrt als CSV                          | Kann      |
| FR-P2-07       | Export-Funktion: Chart als PNG                          | Kann      |


---

## 9. Key Design Principles

### 9.1 Architektur

* **Separation of Concerns:** CAN-Parsing, Event-Generierung und UI sind unabhängige Module
* **Austauschbare Datenquellen:** Live CAN, Mock, Replay nutzen dasselbe Interface
* **Event-Driven:** Unidirektionaler Datenfluss (Sensor → Parser → WebSocket → UI)
* **Stateless Communication:** WebSocket ist broadcast-only, keine Request/Response-Pattern

### 9.2 EventEnvelope Datenmodell

**EventEnvelope** ist ein eigens entwickelter Kommunikations-Standard für diesen Stack. Aktuell wird er ausschließlich für das unidirektionale Senden von `motion_sample`-Events vom Python-Modul zum Next.js WebUI genutzt. Das Datenmodell ist aber so gestaltet, dass in Zukunft leicht weitere Typen (wie `run_start`, `run_stop` oder auch Kommandos in Richtung Python-Modul) und Payloads hinzugefügt werden können.

Definition:

```python
@dataclass
class EventEnvelope:
    proto: int          # Protokollversion (z.B. 1)
    type: str           # Event-Typ, z.B. "motion_sample", später evtl. auch "run_start", "run_stop", etc.
    ts: float           # Unix-Timestamp (Sekunden, hohe Präzision)
    source: str         # Datenquelle, z.B. "les02"
    payload: dict       # Flexible Payload, z.B. {"channel": "master", "position_raw": 12345}
```

*Hinweis: Die Erweiterbarkeit auf neue Eventtypen und Richtungen (z.B. Kommandos von der WebUI zum Python-Modul) ist möglich aber aktuell nicht geplant.*

### 9.3 UX Principles

* **Minimalistisch:** Fokus auf Kernfunktionalität
* **Professionell:** Technisches, ruhiges Design
* **Selbsterklärend:** Keine Dokumentation nötig für Basis-Features
* **Fehler-Transparenz:** Fehlerzustände müssen immer klar kommuniziert werden und dürfen nicht unbemerkt bleiben

---

## 10. Offene Entscheidungen

Die folgenden Punkte sind noch nicht final spezifiziert:

| Thema                           | Status        | Bemerkungen                                        |
| ------------------------------- | ------------- | -------------------------------------------------- |
| **Charting Library**            | Offen         | shadcn/ui charts, Recharts, oder Custom SVG/Canvas |
| **Referenzkurven-Format**       | Offen         | JSON, CSV, oder Datenbank-basiert                  |
| **SQLite-Schema**               | Konzeptionell | Details für Phase 2, bewusst unterspecified        |
| **Geschwindigkeits-Glättung**   | Offen         | Algorithmus (Moving Average, Savitzky-Golay, etc.) |
| **Ride Detection**              | Offen         | Automatische Erkennung von Fahrtbeginn/-ende       |
| **Hardware-Specs Raspberry Pi** | Offen         | Modell und Performance-Tests stehen aus            |

---

## 11. Erfolgskriterien

### 11.1 Prototyp

* Ein Techniker kann eine Fahrkurve live beobachten
* Die Visualisierung ist sofort verständlich
* Das System ist stabil und reagiert flüssig
* Stakeholder können das Potential klar erkennen
* Projektfreigabe wird erteilt

### 11.2 Produktionsversion

* Prüfstand-Techniker nutzen das Tool täglich
* Messbare Zeitersparnis bei der Ventileinstellung
* Konsistentere Ergebnisse zwischen Chargen
* Positive Rückmeldungen von Endnutzern
* System läuft stabil über mehrere Wochen ohne Ausfall

---

## 12. Technologie-Stack

### 12.1 Backend (Python Listener)

* **Sprache:** Python 3.13
* **Libraries:**
  * `python-can` – CAN-Bus Interface
  * `websockets` – WebSocket Server
  * `asyncio` – Async Event Loop
* **OS:** Linux (NixOS, Debian, Ubuntu)
* **CAN Interface:** SocketCAN (can0, vcan0)

### 12.2 Frontend (Web UI)

* **Framework:** Next.js 16 (React 19)
* **Sprache:** TypeScript (mandatory)
* **Styling:** Tailwind CSS 4
* **Components:** shadcn/ui
* **Charting:** TBD (siehe offene Entscheidungen)

### 12.3 Entwicklungsumgebung

* **Nix Flakes:** Reproduzierbare Dev-Shell für alle Abhängigkeiten
* **Mock-System:** Vollständige Entwicklung ohne Hardware möglich
* **vcan:** Virtuelles CAN-Interface für lokales Testing

---

## 13. Projektstruktur

```
ants-les02/
├── listener/               # Python CAN Listener & WebSocket Server
│   ├── main.py            # Entry Point
│   ├── can_reader.py      # CAN Bus Interface
│   ├── frames.py          # CAN Frame Parsing
│   ├── events.py          # EventEnvelope Definition
│   ├── websocket_server.py # WebSocket Broadcaster
│   └── listener.design.md  # Detailed Design Doc (Listener)
├── mock/                   # Mock-Datenquellen für Entwicklung
├── web-ui/                 # Next.js Web UI
│   └── webui-design-doc.md # Detailed Design Doc (Web UI)
├── flake.nix               # Nix Development Environment
├── start_dev.sh            # Dev Startup Script
├── project-overview.md     # Dieses Dokument
└── readme.md               # Quick Start Guide
```

---

## 14. Zeitplan und Status

**Aktueller Status (Januar 2026):**

* ✅ CAN-Frame-Parsing implementiert und getestet
* ✅ WebSocket-Server funktionsfähig
* ✅ Event-Protokoll definiert (`motion_sample`)
* ✅ Mock-System für Entwicklung ohne Hardware
* ✅ Entwicklungsumgebung mit Nix Flakes
* 🔄 Web-UI Grundstruktur vorhanden (Next.js 16, React 19)
* 🔄 Charting-Implementierung in Arbeit
* ⏳ Phase 1 Prototyp: In Entwicklung
* ⏳ Phase 2: Planung

**Nächste Schritte:**

1. Finalisierung der Live-Chart-Visualisierung
2. Integration-Testing: Python Listener ↔ Web-UI
3. Hardware-Test mit echtem LES02 Sensor
4. User-Testing mit Prüfstand-Techniker
5. Präsentation für Projektfreigabe

---

## 15. Weitere Dokumente

* **[listener.design.md](listener/listener.design.md)** – Detailliertes Design-Dokument für Python CAN Listener & WebSocket Server
* **[webui-design-doc.md](web-ui/webui-design-doc.md)** – Detailliertes Design-Dokument für Next.js Web UI
* **[websocket-protokoll.md](websocket-protokoll.md)** – Vollständige WebSocket-Event-Protokoll-Spezifikation
* **[dataframe-auslesen.md](dataframe-auslesen.md)** – CAN-Datenframe-Struktur und Interpretation (LES02-spezifisch)
* **[readme.md](readme.md)** – Quick Start Guide und Setup-Anleitung
