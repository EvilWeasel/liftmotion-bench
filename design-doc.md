# Projekt: LES02 Fahrkurven-Analyse

## 1. Ziel des Projekts

Ziel ist ein Software-Werkzeug, das die Fahrkurve eines Aufzugs auf Basis von Positionsdaten eines **Kübler Ants LES02** Schachtkopiersystems erfasst, auswertet und visualisiert.

Konkret soll das Tool:

- Positionsdaten über den CAN-Bus auslesen
- daraus Geschwindigkeit (und optional Beschleunigung) berechnen
- Messläufe (z. B. 30 Sekunden) aufzeichnen
- die Ergebnisse als Graph darstellen
- perspektivisch eine **Live-Visualisierung über ein Web-UI (React)** ermöglichen

Das Tool ist **rein analytisch** und greift nicht steuernd in den Aufzug ein.

---

## 2. Hardware- & Systemannahmen

### Sensor

- Gerät: **Kübler Ants LES02**
- Funktion: Absoluter Positionssensor
- Auflösung: 1 mm
- Max. Geschwindigkeit: 8 m/s (funktional bis 12 m/s)

### Kommunikation

- Bus: **CAN (SocketCAN unter Linux)**
- Baudrate: 250 kbit/s
- CAN-IDs:
  - `0x80`: Position Master
  - `0x81`: Position Slave
- Payload:
  - Bytes 1–3: absolute Position (MSB first)
  - Byte 4: nicht relevant
- Sendeintervall: alle 2 ms (effektiv 500 Hz)

### Zielplattform

- Demo auf Laptop mit **NixOS**
  - Später Raspi
- USB–CAN-Interface (z. B. CANable, Peak, Kvaser)

---

## 3. NixOS System-Setup

### Kernel-Module

Folgende Module müssen verfügbar sein:

- `can`
- `can_raw`
- `can_dev`

### Systempakete

```nix
environment.systemPackages = with pkgs; [
  can-utils
];
```

### CAN-Interface aktivieren

```bash
sudo ip link set can0 up type can bitrate 250000
```

Test:

```bash
candump can0
```

---

## 4. Entwicklungsumgebung (Python Dev-Shell)

Empfohlene Dev-Shell:

```nix
pkgs.mkShell {
  packages = with pkgs; [
    python312
    python312Packages.python-can
    python312Packages.numpy
    python312Packages.matplotlib
    python312Packages.pandas
    python312Packages.fastapi
    python312Packages.uvicorn
    can-utils
  ];
}
```

---

## 5. Architektur-Übersicht

### Grundprinzip

**Strikte Trennung von Datenquelle und Verarbeitung**.

```
[Datenquelle]
   | (CAN / Replay / Simulation)
   v
[Python Sampler]
   |
   +--> CSV / Snapshot
   +--> WebSocket Stream
   v
[Analyse & Filter]
   v
[Visualisierung]
```

---

## 6. Internes Datenmodell

Alle weiteren Schritte arbeiten ausschließlich mit diesem Modell:

```python
@dataclass
class PositionSample:
    timestamp: float      # Sekunden
    position_mm: int
    channel: str          # "master" | "slave"
```

---

## 7. Datenquellen (austauschbar)

### 1. Live-CAN-Quelle

- liest Frames von `can0`
- filtert IDs `0x80` und `0x81`
- wandelt CAN-Payload in `PositionSample`

### 2. Replay-Quelle

- liest CSV oder JSON mit gespeicherten Samples
- reproduziert Zeitabstände

### 3. Simulationsquelle (Mock)

- erzeugt synthetische Fahrkurven (z. B. S-Kurve)
- ideal für Entwicklung ohne Hardware

Optional:

- Nutzung von **vcan** (virtuelles CAN-Interface) unter Linux

---

## 8. Signalverarbeitung

### Geschwindigkeit

```
v[i] = (pos[i] - pos[i-1]) / Δt
```

### Beschleunigung (optional)

```
a[i] = (v[i] - v[i-1]) / Δt
```

### Wichtige Praxisregeln

- Rohdatenrate: ~500 Hz
- UI-Rate: 30–100 Hz
- Downsampling und Glättung in Python

---

## 9. Snapshot & Offline-POC

### Ablauf

1. Messung für feste Dauer (z. B. 30 s)
2. Speicherung der Samples (CSV)
3. Auswertung mit NumPy
4. Darstellung mit Matplotlib

Ziel:

- schneller Proof of Concept
- Debugging der Signalqualität

---

## 10. Live-Visualisierung (Web-UI)

### Backend

- Python
- **FastAPI**
- WebSocket-Endpunkt `/ws`
- sendet reduzierte Datenrate (z. B. 50 Hz)

### Frontend

- React
- WebSocket-Verbindung zum Backend
- Live-Plot (z. B. Recharts, uPlot)

### Datenfluss

```
CAN → Python → WebSocket → React → Graph
```

---

## 11. Entwicklungsstrategie

### Phase 1 – Ohne Hardware

- Simulation + vcan
- Parser, Analyse, Plots

### Phase 2 – Snapshot-Messungen

- CSV-Logging
- Offline-Auswertung

### Phase 3 – Live vor Ort

- echtes CAN-Interface
- identischer Codepfad
- ggf. Feintuning (Timing, Filter)

---

## 12. Abgrenzung & Sicherheit

- Kein Senden von CAN-Nachrichten
- Keine Steuerung des Aufzugs
- Keine sicherheitsrelevante Funktion
- Tool dient ausschließlich Analyse & Visualisierung

---

## 13. Erweiterungen (optional)

- Start/Stop Trigger
- Ringbuffer (letzte Fahrt)
- Export (CSV, PNG)
- Mehrere Kurven (Position, Geschwindigkeit, Beschleunigung)
- Replay im Web-UI

---

## 14. Zusammenfassung

Das Projekt kombiniert:

- industrielle Sensordaten (CAN)
- saubere Software-Architektur
- Offline- und Live-Auswertung
- moderne Web-Visualisierung

Durch Mocking, Simulation und vcan kann nahezu die komplette Entwicklung **vor dem realen Testaufbau** erfolgen.
