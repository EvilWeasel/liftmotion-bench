# LES02 Web UI – Design Document

**Next.js Frontend for Elevator Ride Curve Visualization**

---

## 1. Overview

This document describes the design and implementation of the Next.js-based web user interface for the LES02 ride curve analysis system. The Web UI is responsible for consuming live event streams via WebSocket, visualizing ride curves in real-time, and providing historical data browsing capabilities (Phase 2).

### Purpose

The Web UI provides technicians with an **immediate, visual understanding of elevator ride characteristics** during test bench operation. It translates raw position data into actionable insights through live charts and overlays.

### Key Responsibilities

* Establish and maintain WebSocket connection to Python listener
* Receive and parse `EventEnvelope` messages
* Render live-updating line charts (time vs. position)
* Display connection status and diagnostics
* Provide dark/light mode toggle
* Browse and display historical rides (Phase 2)
* Overlay reference curves for comparison (Phase 2)

---

## 2. Technology Stack

### 2.1 Core Framework

* **Next.js 16** – React framework with App Router
* **React 19** – UI library
* **TypeScript** – Mandatory for all code

### 2.2 Styling

* **Tailwind CSS 4** – Utility-first CSS framework
* **shadcn/ui** – Component library for consistent design
* **Dark mode first** – Primary theme with light mode support

### 2.3 Build & Development

* **Bun** – Fast JavaScript runtime and package manager
* **ESLint** – Code quality and style enforcement
* **TypeScript strict mode** – Maximum type safety

---

## 3. Architecture

### 3.1 Component Hierarchy

```
app/
├── layout.tsx                 # Root layout with theme provider
├── page.tsx                   # Main dashboard page
└── components/
    ├── LiveChart.tsx          # Real-time position chart
    ├── ConnectionStatus.tsx   # WebSocket connection indicator
    ├── ThemeToggle.tsx        # Dark/light mode switcher
    └── HistoricalBrowser.tsx  # Ride history list (Phase 2)
```

### 3.2 Data Flow

```
WebSocket Server (ws://localhost:8765)
    │
    │ EventEnvelope (JSON)
    ↓
WebSocket Client Hook (useWebSocket)
    │
    │ Parsed Event
    ↓
State Management (React useState)
    │
    ├─→ Connection Status Component
    ├─→ Live Chart Component
    └─→ Data Buffer (position samples)
```

---

## 4. WebSocket Integration

### 4.1 Connection Management

**Custom Hook:** `useWebSocket(url: string)`

```typescript
interface UseWebSocketReturn {
  isConnected: boolean;
  lastEvent: EventEnvelope | null;
  error: Error | null;
  reconnect: () => void;
}

const { isConnected, lastEvent } = useWebSocket("ws://localhost:8765");
```

**Features:**

* Automatic connection on mount
* Automatic reconnection on disconnect (exponential backoff)
* Parse JSON messages into `EventEnvelope` objects
* Error handling and logging

**Connection States:**

* `CONNECTING` – Initial connection attempt
* `CONNECTED` – Active WebSocket connection
* `DISCONNECTED` – Connection lost, attempting reconnect
* `ERROR` – Persistent connection failure

### 4.2 Event Processing

**Type Definition:**

```typescript
interface EventEnvelope {
  proto: number;
  type: string;
  ts: number;
  source: string;
  payload: Record<string, any>;
}

interface PositionSamplePayload {
  channel: "master" | "slave";
  position_raw: number;
}
```

**Event Handling:**

```typescript
useEffect(() => {
  if (lastEvent?.type === "position_sample") {
    const payload = lastEvent.payload as PositionSamplePayload;
    addSample({
      timestamp: lastEvent.ts,
      channel: payload.channel,
      position: payload.position_raw,
    });
  }
}, [lastEvent]);
```

---

## 5. Live Chart Visualization

### 5.1 Requirements

**Phase 1 (Prototype):**

* Line chart: X-axis = time, Y-axis = position
* Live updates as events arrive
* Smooth animation without jank
* Auto-scaling axes
* Clear visual distinction between master/slave channels

**Phase 2:**

* Reference curve overlay
* Velocity derived curve (secondary Y-axis)
* Acceleration derived curve (optional)
* Zoom and pan controls
* Export as PNG/SVG

### 5.2 Charting Library (Open Decision)

**Options under evaluation:**

| Library                 | Pros                                            | Cons                                   |
| ----------------------- | ----------------------------------------------- | -------------------------------------- |
| **shadcn/ui charts**    | Consistent with design system, TypeScript-first | Limited live-update capabilities       |
| **Recharts**            | Declarative API, React-friendly                 | Performance concerns at high frequency |
| **uPlot**               | High performance, small bundle                  | Imperative API, steeper learning curve |
| **Custom SVG/Canvas**   | Full control, optimized for our use case        | Development time, maintenance burden   |
| **Framer Motion + SVG** | Smooth animations, React integration            | Performance unknown for live data      |

**Decision Criteria:**

1. Performance with 500 Hz data input (with downsampling)
2. Maintainability and documentation quality
3. Visual clarity and customization options
4. Bundle size impact

### 5.3 Data Management

**Downsampling Strategy:**

* **Input rate:** 500 Hz from WebSocket (one event every 2 ms)
* **Display rate:** 30-60 Hz (UI refresh rate)
* **Downsampling:** Keep every Nth sample or use time-based bucketing

**Ring Buffer:**

* Fixed-size buffer (e.g., last 10,000 samples)
* Automatic eviction of oldest samples
* Prevents unbounded memory growth during long rides

**Code Example:**

```typescript
const MAX_SAMPLES = 10000;
const [samples, setSamples] = useState<PositionSample[]>([]);

const addSample = (sample: PositionSample) => {
  setSamples((prev) => {
    const updated = [...prev, sample];
    if (updated.length > MAX_SAMPLES) {
      return updated.slice(-MAX_SAMPLES);
    }
    return updated;
  });
};
```

---

## 6. User Interface Design

### 6.1 Design Principles

* **Minimalistic** – Focus on the chart, minimal UI chrome
* **Professional** – Technical, calm aesthetic
* **Self-explanatory** – No manual required for basic operation
* **Error transparency** – Never fail silently

### 6.2 Layout (Phase 1)

```
┌────────────────────────────────────────────────────┐
│ [Theme Toggle]  LES02 Ride Curve Analyzer          │
│                                    [● Connected]    │
├────────────────────────────────────────────────────┤
│                                                    │
│                                                    │
│                 [Live Chart]                       │
│              (Position vs. Time)                   │
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤
│ Status: Receiving data | Last update: 0.5s ago    │
└────────────────────────────────────────────────────┘
```

### 6.3 Color Scheme

**Dark Mode (Primary):**

* Background: `#0a0a0a` (near black)
* Card background: `#121212`
* Text: `#e4e4e7` (zinc-200)
* Accent: `#3b82f6` (blue-500)
* Master channel: `#10b981` (green-500)
* Slave channel: `#f59e0b` (amber-500)

**Light Mode:**

* Background: `#ffffff`
* Card background: `#f9fafb` (gray-50)
* Text: `#18181b` (zinc-900)
* Accent: `#2563eb` (blue-600)
* Master channel: `#059669` (green-600)
* Slave channel: `#d97706` (amber-600)

### 6.4 Typography

* **Headings:** Inter font (via next/font)
* **Body:** Inter font
* **Monospace (for data):** JetBrains Mono or system monospace

---

## 7. Phase 1: Prototype Scope

### 7.1 Features

| Feature                 | Description                               | Priority     |
| ----------------------- | ----------------------------------------- | ------------ |
| WebSocket connection    | Establish connection to listener          | Must         |
| Connection status UI    | Visual indicator (connected/disconnected) | Must         |
| Live chart rendering    | Position vs. time line chart              | Must         |
| Auto-scaling axes       | Chart adjusts to data range               | Must         |
| Dark mode               | Primary theme                             | Must         |
| Light mode toggle       | Switch between themes                     | Should       |
| Channel differentiation | Visual distinction master/slave           | Should       |
| Data rate display       | Show events/second                        | Nice to have |

### 7.2 Out of Scope (Phase 1)

* Historical data browsing
* Data persistence
* Reference curve overlay
* Export functionality
* Velocity/acceleration calculation
* Multi-ride comparison
* User authentication

---

## 8. Phase 2: Production Features

### 8.1 Historical Data Browser

**UI Components:**

* Table of past rides (date, time, duration, distance)
* Search and filter by date range
* Click to load ride into chart
* Delete rides

**Data Source:**

* REST API endpoint to Python backend
* Backend queries SQLite database
* Returns ride metadata + full sample array

**API Design (Conceptual):**

```
GET /api/rides              → List of ride metadata
GET /api/rides/:id          → Full ride data (samples)
DELETE /api/rides/:id       → Delete ride
```

### 8.2 Reference Curve Overlay

**Requirements:**

* Load standardized "ideal" ride curve
* Display as semi-transparent overlay on chart
* Toggle visibility
* Visual comparison: recorded vs. reference

**Reference Curve Format:**

* JSON array of `{time, position}` tuples
* Normalized to relative time (0 = ride start)
* Stored in database or loaded from file

**UI Control:**

* Checkbox: "Show reference curve"
* Dropdown: Select reference curve (multiple profiles)

### 8.3 Derived Metrics

**Velocity:**

```typescript
const calculateVelocity = (samples: PositionSample[]) => {
  return samples.map((s, i) => {
    if (i === 0) return { ...s, velocity: 0 };
    const dt = samples[i].timestamp - samples[i - 1].timestamp;
    const dp = samples[i].position - samples[i - 1].position;
    return { ...s, velocity: dp / dt };
  });
};
```

**Acceleration:**

```typescript
const calculateAcceleration = (samplesWithVelocity: VelocitySample[]) => {
  return samplesWithVelocity.map((s, i) => {
    if (i === 0) return { ...s, acceleration: 0 };
    const dt = samplesWithVelocity[i].timestamp - samplesWithVelocity[i - 1].timestamp;
    const dv = samplesWithVelocity[i].velocity - samplesWithVelocity[i - 1].velocity;
    return { ...s, acceleration: dv / dt };
  });
};
```

**Display:**

* Toggle buttons: "Position | Velocity | Acceleration"
* Multi-series chart (position + velocity + acceleration)

---

## 9. Error Handling

### 9.1 Connection Errors

| Error Condition             | User Feedback                        | Handling                                  |
| --------------------------- | ------------------------------------ | ----------------------------------------- |
| WebSocket connection failed | Red indicator + "Disconnected"       | Auto-retry with backoff                   |
| Connection lost during ride | Orange indicator + "Reconnecting..." | Attempt reconnect, preserve buffered data |
| Server not reachable        | Red indicator + "Server offline"     | Manual retry button                       |

### 9.2 Data Errors

| Error Condition        | User Feedback                | Handling                           |
| ---------------------- | ---------------------------- | ---------------------------------- |
| Malformed JSON         | Console error + skip message | Continue processing next message   |
| Unknown event type     | Console warning              | Ignore unknown event               |
| Missing payload fields | Console error + skip         | Validate payload before processing |

### 9.3 UI Error Boundaries

* React Error Boundary wraps main chart component
* Fallback UI: "Chart error occurred. [Reload]"
* Prevents entire app crash from chart rendering errors

---

## 10. Performance Optimization

### 10.1 React Optimization

* **useMemo:** Memoize expensive calculations (velocity, acceleration)
* **useCallback:** Prevent unnecessary re-renders
* **React.memo:** Wrap chart component if re-renders are costly
* **Virtual scrolling:** For historical ride list (Phase 2)

### 10.2 WebSocket Optimization

* **Batching:** Process multiple events in single render cycle
* **Throttling:** Limit chart updates to 60 FPS
* **Backpressure:** If processing can't keep up, drop frames intelligently

### 10.3 Bundle Optimization

* **Code splitting:** Lazy load Phase 2 features
* **Tree shaking:** Remove unused shadcn/ui components
* **Font subsetting:** Load only required glyphs

**Target Bundle Size:**

* Initial load: < 150 KB gzipped
* Full app (Phase 2): < 300 KB gzipped

---

## 11. Development Workflow

### 11.1 Local Development

**Start Dev Server:**

```bash
cd web-ui
bun install      # First time only
bun run dev      # Start Next.js dev server
```

**Access:**

* Web UI: http://localhost:3000
* WebSocket: ws://localhost:8765 (listener must be running)

**Hot Reload:**

* File changes trigger instant reload
* WebSocket connection persists across reloads

### 11.2 Integrated Testing

**Full Stack:**

```bash
./start_dev.sh  # Starts listener + mock + debug client
# Manually start web-ui in separate terminal:
cd web-ui && bun run dev
```

**Test Scenarios:**

1. **Live data:** Listener + Mock → Web UI displays moving chart
2. **Reconnection:** Stop listener → UI shows disconnected → Restart listener → Auto-reconnect
3. **No data:** Listener running, no mock → UI shows "Waiting for data"

---

## 12. Deployment

### 12.1 Build for Production

```bash
cd web-ui
bun run build    # Creates optimized production build
bun run start    # Runs production server
```

### 12.2 Raspberry Pi Deployment

**Option 1: Node.js production server**

```bash
bun run build
bun run start    # Runs on port 3000
```

**Option 2: Static export + nginx**

```javascript
// next.config.ts
const config = {
  output: 'export',  // Generate static HTML/CSS/JS
};
```

Serve static files with nginx or Python `http.server`.

**WebSocket URL Configuration:**

* Development: `ws://localhost:8765`
* Production: `ws://<raspberry-pi-ip>:8765`
* Environment variable: `NEXT_PUBLIC_WS_URL`

---

## 13. Accessibility

### 13.1 Requirements

* **Keyboard navigation:** All interactive elements accessible via keyboard
* **ARIA labels:** Proper labels for status indicators and buttons
* **Focus indicators:** Visible focus states
* **Color contrast:** WCAG AA compliant (4.5:1 for normal text)

### 13.2 Screen Reader Support

* Connection status announced on change
* Data flow changes announced (optional, may be too noisy)
* Error messages announced with `role="alert"`

---

## 14. Internationalization

**Phase 1:** German only (hardcoded strings)

**Phase 2 (optional):**

* `next-intl` or built-in i18n
* Language toggle: German ↔ English
* Translation files: `locales/de.json`, `locales/en.json`

**String Examples:**

* German: "Verbunden", "Getrennt", "Fahrkurve"
* English: "Connected", "Disconnected", "Ride Curve"

---

## 15. Testing Strategy

### 15.1 Unit Tests (Future)

* **Library:** Vitest or Jest
* **Coverage:** Utility functions (velocity calculation, data parsing)

### 15.2 Integration Tests (Future)

* **Library:** Playwright
* **Scenarios:**
  * WebSocket connection establishment
  * Chart rendering with mock data
  * Theme toggle functionality

### 15.3 Manual Testing

* Test on Chrome, Firefox, Safari
* Test on tablet (touch interactions)
* Test with real CAN hardware at test bench

---

## 16. Known Limitations

### 16.1 Browser Compatibility

* **Target:** Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
* **Not supported:** Internet Explorer

### 16.2 Performance

* High-frequency data (500 Hz) requires downsampling for smooth rendering
* Chart may lag with 10+ concurrent clients (unlikely scenario)

### 16.3 WebSocket Reliability

* No message persistence: if connection drops, data during dropout is lost
* Phase 2 mitigation: Buffer on server side with reconnect recovery

---

## 17. Future Enhancements

### 17.1 Advanced Charting

* Cursor crosshair with value display
* Time range selection (zoom to specific interval)
* Multiple Y-axes (position, velocity, acceleration)
* Annotations (mark interesting points)

### 17.2 Data Export

* Export ride as CSV (timestamp, position, velocity, acceleration)
* Export chart as PNG/SVG
* Print-friendly ride report

### 17.3 Real-Time Collaboration

* Multiple technicians view same live ride (already supported)
* Shared cursor position
* Comments/annotations (requires backend changes)

### 17.4 Predictive Insights

* "Current ride quality score" based on reference curve deviation
* Suggested valve adjustments (AI/ML, long-term)

---

## 18. Related Documents

* **[project-overview.md](../project-overview.md)** – High-level project documentation
* **[listener.design.md](../listener/listener.design.md)** – Python listener design document
* **[websocket-protokoll.md](../websocket-protokoll.md)** – WebSocket event protocol specification

---

**Document Version:** 2.0  
**Last Updated:** 2026-01-19  
**Author:** evilweasel  
**Status:** Active
