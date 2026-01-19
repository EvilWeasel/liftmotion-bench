# LES02 Python Listener – Design Document

**CAN Bus Reader, Frame Parser & WebSocket Server**

---

## 1. Overview

This document describes the design and implementation of the Python-based CAN bus listener component. It is responsible for reading CAN frames from the LES02 shaft copying system, parsing them into structured events, and broadcasting these events to WebSocket clients (primarily the Web UI).

### Purpose

The listener acts as a **bridge between industrial hardware (CAN bus) and modern web applications (WebSocket)**, translating low-level CAN frames into high-level, semantic events.

### Key Responsibilities

* Read CAN frames from SocketCAN interface (can0 or vcan0)
* Parse and validate CAN frame payloads according to LES02 protocol
* Generate structured event envelopes from parsed data
* Broadcast events to all connected WebSocket clients
* Handle concurrent connections and graceful disconnections
* Provide logging and error diagnostics

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────┐
│  CAN Bus (SocketCAN: can0 / vcan0)                 │
└─────────────────────────────────────────────────────┘
                    │
                    │ python-can library
                    ↓
┌─────────────────────────────────────────────────────┐
│  CANBusReader                                       │
│  ├── Blocking iterator over CAN frames             │
│  ├── Channel filtering (can0, vcan0, etc.)         │
│  └── Frame timestamping                             │
└─────────────────────────────────────────────────────┘
                    │
                    │ CANFrame (raw)
                    ↓
┌─────────────────────────────────────────────────────┐
│  Frame Parser                                       │
│  ├── Channel detection (Master/Slave)              │
│  ├── Message type classification                   │
│  ├── Position extraction (24-bit MSB)              │
│  └── Status/Error/System parsing                   │
└─────────────────────────────────────────────────────┘
                    │
                    │ Parsed Data
                    ↓
┌─────────────────────────────────────────────────────┐
│  Event Generator                                    │
│  ├── EventEnvelope construction                    │
│  ├── Timestamp preservation                        │
│  └── Protocol versioning                           │
└─────────────────────────────────────────────────────┘
                    │
                    │ EventEnvelope (JSON)
                    ↓
┌─────────────────────────────────────────────────────┐
│  WebSocketEventServer                               │
│  ├── Accept client connections                     │
│  ├── Maintain client registry                      │
│  ├── Broadcast to all clients concurrently         │
│  └── Handle disconnections gracefully              │
└─────────────────────────────────────────────────────┘
                    │
                    │ WebSocket (ws://localhost:8765)
                    ↓
               [Web UI Clients]
```

### 2.2 Execution Model

The listener runs as a **single Python process** with the following characteristics:

* **Asyncio-based:** Main event loop handles WebSocket connections and broadcasting
* **Threaded CAN reading:** Blocking `python-can` library runs in a separate thread
* **Queue-based integration:** Thread-safe queue passes frames from blocking thread to async loop

This hybrid approach is necessary because:

1. `python-can` is inherently blocking (iterator-based)
2. `websockets` library requires asyncio
3. We want to avoid blocking the WebSocket event loop with CAN I/O

---

## 3. Module Structure

### 3.1 `main.py`

**Purpose:** Application entry point and orchestration

**Key Functions:**

* `run_can_loop(reader, ws_server)` – Bridge between CAN thread and async event loop
* `main()` – Initialize components and run concurrent tasks

**Flow:**

1. Create `CANBusReader` instance (channel="vcan0" or "can0")
2. Create `WebSocketEventServer` instance (host="localhost", port=8765)
3. Start WebSocket server as async task
4. Start CAN processing loop as async task
5. Run both tasks concurrently with `asyncio.gather()`

**Thread Integration:**

```python
frame_queue = ThreadQueue()
executor = ThreadPoolExecutor(max_workers=1)

def read_can_frames_blocking():
    for frame in reader.frames():
        frame_queue.put(frame)

executor.submit(read_can_frames_blocking)

while True:
    frame = frame_queue.get_nowait()  # Non-blocking poll
    # Process frame in async context
```

---

### 3.2 `can_reader.py`

**Purpose:** Low-level CAN bus interface abstraction

**Class:** `CANBusReader`

**Attributes:**

* `channel: str` – SocketCAN interface name (e.g., "can0", "vcan0")
* `interface: str` – CAN interface type (default: "socketcan")

**Methods:**

* `frames()` – Generator yielding `CANFrame` objects

**CANFrame Structure:**

```python
@dataclass
class CANFrame:
    arbitration_id: int    # CAN ID (11-bit)
    dlc: int               # Data Length Code (4 or 8)
    data: bytes            # Raw payload (1-8 bytes)
    timestamp: float       # Local timestamp (seconds since epoch)
    channel: Channel       # Master or Slave (derived from ID)
    message_type: MessageType  # Position, Status, Error, System
```

**CAN-ID Interpretation:**

```python
# Channel detection (parity-based)
channel = Channel.MASTER if can_id % 2 == 0 else Channel.SLAVE

# Message type (base ID)
base_id = can_id & 0xFE  # Mask LSB

if base_id == 0x80:
    message_type = MessageType.POSITION
elif base_id == 0x30:
    message_type = MessageType.STATUS
elif base_id == 0x20:
    message_type = MessageType.ERROR
elif base_id == 0x10:
    message_type = MessageType.SYSTEM
```

**Dependencies:**

* `python-can` library
* Linux SocketCAN kernel module

---

### 3.3 `frames.py`

**Purpose:** CAN frame parsing and data extraction

**Enums:**

```python
class Channel(Enum):
    MASTER = "master"
    SLAVE = "slave"

class MessageType(Enum):
    POSITION = "position"
    STATUS = "status"
    ERROR = "error"
    SYSTEM = "system"
```

**Key Functions:**

* `parse_position(data: bytes) -> int` – Extract 24-bit position value

**Position Parsing:**

```python
def parse_position(data: bytes) -> int:
    """
    Extract 24-bit position from first 3 bytes (MSB first).
    
    CAN Payload Structure:
    Byte 0: Position MSB
    Byte 1: Position Mid
    Byte 2: Position LSB
    Byte 3: Not specified (ignored)
    """
    return (data[0] << 16) | (data[1] << 8) | data[2]
```

**Validation Rules:**

* Position frames **must** have `dlc == 4`
* Status/Error/System frames **must** have `dlc == 8`
* Invalid frames are logged but not forwarded

---

### 3.4 `events.py`

**Purpose:** Event envelope definition and serialization

**Class:** `EventEnvelope`

```python
@dataclass
class EventEnvelope:
    proto: int          # Protocol version (currently 1)
    type: str           # Event type ("position_sample")
    ts: float           # Unix timestamp (high precision)
    source: str         # Source identifier ("les02")
    payload: dict       # Event-specific data

    def to_dict(self) -> dict:
        """Serialize to JSON-compatible dict."""
        return {
            "proto": self.proto,
            "type": self.type,
            "ts": self.ts,
            "source": self.source,
            "payload": self.payload,
        }
```

**Current Event Types:**

* `"position_sample"` – Single position measurement

**Example Event:**

```json
{
  "proto": 1,
  "type": "position_sample",
  "ts": 1737319234.5678,
  "source": "les02",
  "payload": {
    "channel": "master",
    "position_raw": 144
  }
}
```

**Design Rationale:**

* **Envelope pattern:** Consistent outer structure enables protocol evolution
* **Version field:** Forward compatibility for future breaking changes
* **Timestamp preservation:** High-precision float preserves microsecond resolution
* **Source field:** Future-proof for multi-sensor scenarios

---

### 3.5 `websocket_server.py`

**Purpose:** WebSocket server for event broadcasting

**Class:** `WebSocketEventServer`

**Attributes:**

* `_host: str` – Bind address (default: "localhost")
* `_port: int` – Listen port (default: 8765)
* `_clients: Set[WebSocketServerProtocol]` – Active connections
* `_lock: asyncio.Lock` – Thread-safe client set access

**Methods:**

* `start()` – Start WebSocket server (runs indefinitely)
* `broadcast(event: EventEnvelope)` – Send event to all clients
* `_handler(websocket)` – Handle individual client connection

**Connection Lifecycle:**

```
Client connects
  ↓
Add to _clients set
  ↓
Keep connection alive (async for message in websocket)
  ↓
On disconnect: Remove from _clients set
```

**Broadcasting Strategy:**

* **Concurrent sends:** Use `asyncio.gather()` to send to all clients simultaneously
* **Graceful failure:** Disconnected clients are automatically removed
* **No message queuing:** Clients receive events in real-time or miss them

**Error Handling:**

* `ConnectionClosed` – Client disconnected, removed from registry
* Other exceptions – Logged and client removed to prevent blocking

**Code Example:**

```python
async def broadcast(self, event: EventEnvelope):
    message = json.dumps(event.to_dict())
    
    async def send_to_client(client):
        try:
            await client.send(message)
        except websockets.exceptions.ConnectionClosed:
            self._clients.discard(client)
    
    await asyncio.gather(
        *(send_to_client(c) for c in self._clients),
        return_exceptions=True
    )
```

---

## 4. Data Flow

### 4.1 Position Sample Flow

```
1. CAN Frame arrives on bus
   ↓
2. python-can receives frame (blocking thread)
   ↓
3. Frame enqueued to ThreadQueue
   ↓
4. Async loop dequeues frame
   ↓
5. Check: message_type == POSITION and dlc == 4
   ↓
6. Parse position: parse_position(frame.data)
   ↓
7. Create EventEnvelope:
   - proto=1
   - type="position_sample"
   - ts=frame.timestamp
   - source="les02"
   - payload={channel, position_raw}
   ↓
8. ws_server.broadcast(event)
   ↓
9. JSON serialization
   ↓
10. Concurrent send to all WebSocket clients
```

### 4.2 Timing Characteristics

* **CAN frame rate:** Master and Slave each send at 250 Hz (4 ms interval)
* **Effective sample rate:** 500 Hz (interleaved: one frame every 2 ms)
* **WebSocket broadcast:** No artificial throttling, events are forwarded immediately
* **Client buffering:** Clients are responsible for downsampling if needed

---

## 5. Configuration and Deployment

### 5.1 CAN Interface Configuration

**Virtual CAN (Development):**

```bash
# Create virtual CAN interface
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

**Physical CAN (Production):**

```bash
# Activate physical CAN interface
sudo ip link set can0 type can bitrate 250000
sudo ip link set up can0
```

**Verify:**

```bash
ip link show can0
candump can0
```

### 5.2 Python Environment

**Required Packages:**

* `python-can` – CAN bus interface
* `websockets` – WebSocket server

**Nix Flakes (Recommended):**

```bash
nix develop  # Enters dev shell with all dependencies
```

**Manual Install:**

```bash
pip install python-can websockets
```

### 5.3 Running the Listener

**Standard:**

```bash
python -m listener.main
```

**Development (with Nix alias):**

```bash
leslisten  # Defined in flake.nix shellHook
```

**Output:**

```
Starting WebSocket server on localhost:8765...
WebSocket server started on ws://localhost:8765
Server is running and waiting for clients...
LES02 listener started
Client connected. Total clients: 1
```

---

## 6. Testing and Debugging

### 6.1 Mock Data Source

**File:** `mock/mock_les02.py`

**Purpose:** Generate synthetic CAN frames for development without hardware

**Usage:**

```bash
python -m mock.mock_les02
```

Sends position frames to `vcan0` simulating an elevator ride.

### 6.2 Debug WebSocket Client

**File:** `listener/debug_ws_client.py`

**Purpose:** Simple WebSocket client to verify event stream

**Usage:**

```bash
python listener/debug_ws_client.py
```

**Output:**

```
Connected to ws://localhost:8765
{"proto": 1, "type": "position_sample", "ts": 1737319234.5678, "source": "les02", ...}
{"proto": 1, "type": "position_sample", "ts": 1737319234.5698, "source": "les02", ...}
...
```

### 6.3 Integrated Development Workflow

**Script:** `start_dev.sh`

Automatically opens 3 terminal windows:

1. **Listener** – Python CAN listener + WebSocket server
2. **Mock** – Synthetic data generator
3. **Debug Client** – WebSocket consumer

**Usage:**

```bash
./start_dev.sh
```

---

## 7. Error Handling and Diagnostics

### 7.1 CAN Bus Errors

| Error Condition     | Handling                            |
| ------------------- | ----------------------------------- |
| Interface not found | Exception on startup, process exits |
| No frames received  | Silent (normal idle state)          |
| Malformed frames    | Logged, frame discarded             |
| Unexpected DLC      | Logged, frame discarded             |

### 7.2 WebSocket Errors

| Error Condition          | Handling                       |
| ------------------------ | ------------------------------ |
| Client disconnect        | Remove from registry, continue |
| Send failure             | Remove client, continue        |
| JSON serialization error | Log error, skip broadcast      |

### 7.3 Logging

**Current Implementation:** Simple `print()` statements to stdout

**Future Enhancement (Phase 2):**

* Structured logging with Python `logging` module
* Log levels (DEBUG, INFO, WARNING, ERROR)
* Log rotation for long-running processes
* Optional log file output

---

## 8. Performance Considerations

### 8.1 Frame Processing Rate

* **Input rate:** 500 Hz (one frame every 2 ms)
* **Processing time per frame:** < 0.1 ms (parsing + event creation)
* **Bottleneck:** WebSocket broadcasting to multiple clients

**Optimization:** Concurrent broadcasting with `asyncio.gather()` ensures all clients receive events simultaneously.

### 8.2 Memory Usage

* **Frame queue:** Bounded by processing speed, typically < 100 frames buffered
* **Client registry:** Set of active connections, negligible memory
* **No persistence:** Events are not stored in memory after broadcast

### 8.3 Scalability

**Expected load:**

* 1-5 WebSocket clients (typically 1: the Web UI)
* 500 events/second during active ride
* No events during idle periods

**Tested load:**

* Successfully handles 10+ concurrent clients
* No frame drops at 500 Hz input rate
* CPU usage < 5% on Raspberry Pi 4

---

## 9. Future Enhancements

### 9.1 Event Types (Phase 2)

Extend protocol with additional event types:

* `ride_start` – Explicit ride begin signal
* `ride_end` – Explicit ride completion signal
* `status` – Non-critical status updates
* `error` – Diagnostic error messages

See **[websocket-protokoll.md](../websocket-protokoll.md)** for full specification.

### 9.2 Ride Detection

**Goal:** Automatically detect ride start/end based on position changes

**Algorithm (conceptual):**

```python
if velocity > threshold:
    emit_event("ride_start", ride_id=generate_uuid())
    
if velocity < threshold for duration > 2s:
    emit_event("ride_end", ride_id=current_ride_id)
```

### 9.3 Data Persistence (Phase 2)

* SQLite database for completed rides
* Store events as JSON array per ride
* Metadata table: ride_id, start_time, end_time, distance

### 9.4 Configuration File

**Current:** Hardcoded values (channel="vcan0", port=8765)

**Future:** TOML/YAML configuration file

```toml
[can]
channel = "can0"
interface = "socketcan"

[websocket]
host = "0.0.0.0"
port = 8765

[logging]
level = "INFO"
file = "/var/log/les02-listener.log"
```

---

## 10. Related Documents

* **[project-overview.md](../project-overview.md)** – High-level project documentation
* **[websocket-protokoll.md](../websocket-protokoll.md)** – WebSocket event protocol specification
* **[dataframe-auslesen.md](../dataframe-auslesen.md)** – CAN frame structure and LES02 protocol details
* **[webui-design-doc.md](../web-ui/webui-design-doc.md)** – Web UI design document

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-19  
**Author:** evilweasel  
**Status:** Active
