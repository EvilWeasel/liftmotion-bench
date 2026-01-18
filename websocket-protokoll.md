# LES02 WebSocket Event Protocol

**Version 1**

---

## 1. Zweck

Dieses Dokument beschreibt das **applikationsspezifische Event-Protokoll** für die WebSocket-Kommunikation zwischen:

* **Python LES02-Auswerteeinheit** (Server)
* **WebUI (Next.js)** (Client)

Das Protokoll dient dem **Live-Streaming von Messdaten**, der **Signalisierung von Fahrten**, sowie der **bidirektionalen Steuerung** (Commands).
Persistenz (z. B. SQLite) ist **nicht Teil** des Protokolls, Events sind jedoch so gestaltet, dass sie direkt speicherbar sind.

---

## 2. Transportannahmen

* WebSocket über TCP
* UTF-8 kodierte JSON-Nachrichten
* Nachrichtenreihenfolge ist relevant
* Verbindung ist zustandsbehaftet

---

## 3. Allgemeine Event-Struktur (Envelope)

Jede Nachricht folgt derselben äußeren Struktur:

```json
{
  "proto": 1,
  "type": "<event-type>",
  "ts": <unix_timestamp_seconds>,
  "source": "<sender>",
  "payload": { }
}
```

### Felder

| Feld      | Typ    | Beschreibung                       |
| --------- | ------ | ---------------------------------- |
| `proto`   | number | Protokollversion                   |
| `type`    | string | Event-Typ                          |
| `ts`      | number | Unix-Zeitstempel (Sekunden, float) |
| `source`  | string | Absenderkennung                    |
| `payload` | object | Ereignisspezifische Daten          |

---

## 4. Event-Typen: Übersicht

### Python → WebUI

* `ride_start`
* `position_sample`
* `ride_end`
* `status`
* `error`

### WebUI → Python

* `command:start_test_ride`
* `command:stop` (optional)

---

## 5. Event-Definitionen

### 5.1 `ride_start`

Signalisiert den Beginn einer neuen Fahrt.

```json
{
  "type": "ride_start",
  "payload": {
    "ride_id": "<string>",
    "direction": "up" | "down",
    "expected_distance": <number>,
    "unit": "m"
  }
}
```

---

### 5.2 `position_sample`

Zeitkritisches Positionsereignis.

```json
{
  "type": "position_sample",
  "payload": {
    "ride_id": "<string>",
    "channel": "master" | "slave",
    "position_raw": <integer>,
    "position": <number>,
    "unit": "m"
  }
}
```

**Hinweis:**
Geschwindigkeit und Beschleunigung sind **nicht Bestandteil** des Protokolls und werden aus den Samples abgeleitet.

---

### 5.3 `ride_end`

Explizites Ende einer Fahrt.

```json
{
  "type": "ride_end",
  "payload": {
    "ride_id": "<string>",
    "reason": "completed" | "aborted" | "error"
  }
}
```

---

### 5.4 `status`

Nicht-zeitkritische Statusinformationen.

```json
{
  "type": "status",
  "payload": {
    "channel": "master" | "slave",
    "state": "<string>"
  }
}
```

---

### 5.5 `error`

Diagnostisches Ereignis.

```json
{
  "type": "error",
  "payload": {
    "channel": "master" | "slave" | "system",
    "code": "<string>",
    "details": "<string>"
  }
}
```

---

## 6. Commands (WebUI → Python)

### 6.1 `command:start_test_ride`

Startet eine Testfahrt.

```json
{
  "type": "command:start_test_ride",
  "payload": {
    "distance": <number>,
    "unit": "m"
  }
}
```

---

## 7. Semantische Regeln

* Events sind **append-only** und können 1:1 persistiert werden
* `ride_id` identifiziert eine Fahrt eindeutig
* Reihenfolge der `position_sample`-Events ist relevant
* Commands erzeugen **keine direkte Antwort**, sondern resultierende Events

---

## 8. Nicht-Ziele des Protokolls

* Keine CAN-Frame-Repräsentation
* Keine Filter-, Glättungs- oder Analysewerte
* Keine UI-spezifischen Darstellungsdaten

---

## 9. Trennung der Verantwortlichkeiten

| Ebene     | Verantwortung                       |
| --------- | ----------------------------------- |
| CAN       | Rohdaten                            |
| Python    | Interpretation, Validierung, Events |
| WebSocket | Transport                           |
| WebUI     | Visualisierung, Analyse             |

---

