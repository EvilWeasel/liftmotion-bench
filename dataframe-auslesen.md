# LES02 CAN-Datenframes – Struktur & Interpretation

## Ziel dieses Dokuments

Dieses Dokument beschreibt die logische Struktur, Bedeutung und zeitliche Einordnung der vom **Ants LES02** über den CAN-Bus übertragenen Datenframes. Der Fokus liegt auf dem **Verständnis der Datenformate**, ihrer **semantischen Bedeutung** sowie einer **sauberen gedanklichen Modellierung**, die eine spätere Implementierung in Software erleichtert.

---

## Grundannahmen zur CAN-Kommunikation

Das Ants LES02 ist ein **reiner Sender** auf dem CAN-Bus. Es existiert genau eine definierte Ausnahme: das gezielte Senden einer *LES-Unlock*-Nachricht durch eine externe Auswerteeinheit.

Die Kommunikation basiert auf folgenden Konstanten:

- **CAN 2.0A (11-Bit-Identifier)**
- Zwei logisch getrennte, redundante Kanäle:
  - **Master**: gerade CAN-IDs
  - **Slave**: ungerade CAN-IDs
- Nachrichten werden strikt durch die CAN-ID semantisch klassifiziert
- Die Nutzdatenlänge beträgt entweder **4 Byte** oder **8 Byte**, abhängig vom Nachrichtentyp

Die Kanäle senden alternierend Positionsdaten, sodass sich effektiv ein **2-ms-Raster** ergibt.

---

## Abstraktes Modell eines LES02-CAN-Frames

Unabhängig vom konkreten Nachrichtentyp lässt sich jede CAN-Nachricht des LES02 auf folgendes abstraktes Datenmodell abbilden:

```text
CANFrame
├── can_id        (11 Bit)
├── channel       (Master | Slave)
├── message_type  (System | Error | Status | Position)
├── dlc           (4 oder 8)
├── data[1..8]    (roh, unverändert)
├── timestamp     (lokal erfasst)
```

Dieses Modell trennt strikt zwischen:

- **Transportebene** (CAN-ID, DLC)
- **Semantik** (Nachrichtentyp, Kanal)
- **Zeitbezug** (lokaler Empfangszeitpunkt)

---

## Ableitung von Kanal und Nachrichtentyp

### Kanalzuordnung

Die Zuordnung zu Master oder Slave erfolgt ausschließlich über die **Parität der CAN-ID**:

- Gerade ID → Master
- Ungerade ID → Slave

Diese Information ist essenziell für:

- Plausibilitätsprüfungen
- Redundanzvergleiche
- Fehlerdiagnose bei Kanalabweichungen

### Nachrichtentypen

Der Nachrichtentyp ergibt sich direkt aus dem Basiswert der CAN-ID:

| Basis-ID | Typ                | Beschreibung               |
| -------: | ------------------ | -------------------------- |
|     0x10 | Systemnachricht    | Lock/Unlock, Gerätezustand |
|     0x20 | Fehlernachricht    | Diagnostische Fehlercodes  |
|     0x30 | Statusnachricht    | Betriebszustände           |
|     0x80 | Positionsnachricht | Absolute Position          |

Der Slave verwendet jeweils die **Basis-ID + 1**.

---

## Positionsdatenframes

### Struktur

Positionsnachrichten besitzen eine **Datenlänge von 4 Byte** und stellen den zeitkritischsten Teil der Kommunikation dar.

```text
Byte 1–3 : Globale Position (MSB first)
Byte 4   : nicht spezifiziert
```

Die Position ist als **24-Bit-Wert** kodiert und repräsentiert eine absolute Lage entlang des Schachts. Die physikalische Einheit ergibt sich aus der Gerätekonfiguration und ist nicht Bestandteil des CAN-Protokolls.

### Semantik

- Jeder Kanal liefert eine eigene Positionsmessung
- Die Werte sind unabhängig voneinander zu bewerten
- Abweichungen zwischen Master und Slave sind ein sicherheitsrelevantes Ereignis

### Zeitliche Einordnung

- Master: alle 4 ms
- Slave: phasenverschoben um 2 ms

Daraus ergibt sich ein **interleaved Datenstrom**, der für eine Auswertung zunächst zeitlich sortiert werden sollte.

---

## Statusnachrichten

Statusnachrichten besitzen stets eine Länge von **8 Byte** und werden außerhalb des Normalbetriebs gesendet.

```text
Byte 8 : Sub-Status
```

Relevante Sub-Status-Werte:

- `0x0F` – Kanal startet hoch

  * Byte 1–4: CRC der Gerätesoftware
- `0xF0` – Kanal betriebsbereit

Die übrigen Bytes sind im betriebsbereiten Zustand nicht spezifiziert.

---

## Systemnachrichten (Lock / Unlock)

Systemnachrichten dienen primär der **Sicherheitssteuerung**.

```text
Byte 1–2 : Unlock-Schlüssel (nur bei Locked-Zustand)
Byte 8   : Sub-Systemstatus
```

Mögliche Sub-Systemstatus-Werte:

- `0xF0` – LES-Locked
- `0xFF` – LES-Unlock

Der Unlock-Schlüssel ist **zeitabhängig** und nur für ein Zeitfenster von ca. 30 ms gültig. Er stellt somit einen synchronisationskritischen Bestandteil der Kommunikation dar.

---

## Fehlernachrichten

Fehlernachrichten werden ebenfalls mit **8 Byte** übertragen.

```text
Byte 8   : Fehlercode
Byte 1–7 : herstellerspezifische Zusatzinformationen
```

Der Fehlercode ist ein **primärer Diagnoseindikator**. Die übrigen Bytes sind als Kontextdaten zu verstehen und primär für Herstelleranalysen vorgesehen.

Fehler werden kanalweise gemeldet und müssen im Gesamtsystem korreliert betrachtet werden.

---

## Plausibilität und Redundanz

Das Protokoll geht explizit davon aus, dass:

- CAN-CRC allein nicht ausreicht
- Positionsdaten logisch geprüft werden müssen

Typische Plausibilitätskriterien sind:

- Maximal zulässige Geschwindigkeiten
- Konsistenz zwischen Master- und Slave-Position
- Monotone Positionsänderung im Normalbetrieb

Diese Prüfungen liegen vollständig in der Verantwortung der Auswerteeinheit.
