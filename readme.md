# LES02 Fahrkurven-Analyse

Real-time elevator ride curve visualization tool for test bench technicians. Reads position data from Kübler Ants LES02 shaft copying systems via CAN bus and streams live ride curves to a web interface.

## Quick Start

### Prerequisites

* Linux system with Nix package manager installed
* Nix Flakes enabled (add `experimental-features = nix-command flakes` to `~/.config/nix/nix.conf`)

### Setup

```bash
# Clone repository
git clone <repository-url>
cd ants-les02/wzr

# Enter Nix development shell (automatically installs all dependencies)
nix develop

# Create virtual CAN interface (for development without hardware)
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

### Running the System

**Option 1: Automated (recommended for development)**

```bash
./start_dev.sh
```

This opens 3 terminal windows:

* **Listener** – Python CAN reader + WebSocket server
* **Mock** – Synthetic data generator
* **Debug Client** – WebSocket consumer for testing

**Option 2: Manual**

```bash
# Terminal 1: Start listener
python -m listener.main

# Terminal 2: Start mock data source
python -m mock.mock_les02

# Terminal 3: Start debug WebSocket client
python listener/debug_ws_client.py

# Terminal 4: Start Web UI (optional)
cd web-ui
bun install  # First time only
bun run dev
```

**Option 3: Using Nix aliases**

```bash
nix develop  # Enters dev shell

# In separate terminals:
leslisten   # Start listener
lesmock     # Start mock
lesdebug    # Start debug client
```

### Accessing the Web UI

**Development:**

```bash
cd web-ui
bun install      # First time only
bun run dev      # Starts Next.js dev server on http://localhost:3000
```

**Production build:**

```bash
cd web-ui
bun run build    # Create optimized build
bun run start    # Run production server
```

## System Architecture

```
[LES02 Sensor] → [CAN Bus] → [Python Listener] → [WebSocket] → [Web UI]
```

* **Python Listener:** Reads CAN frames, parses position data, broadcasts events via WebSocket
* **Web UI:** Next.js application that visualizes live ride curves

## Hardware Setup (Production)

### Physical CAN Interface

```bash
# Activate CAN interface (e.g., can0)
sudo ip link set can0 type can bitrate 250000
sudo ip link set up can0

# Verify
ip link show can0
candump can0
```

### Expected CAN Messages

* **CAN IDs:** `0x80` (Master), `0x81` (Slave)
* **Baudrate:** 250 kbit/s
* **Frame rate:** 500 Hz (one frame every 2 ms)
* **Payload:** 4 bytes (24-bit position MSB first)

## Documentation

* **[project-overview.md](project-overview.md)** – High-level project documentation for stakeholders
* **[listener/listener.design.md](listener/listener.design.md)** – Python listener technical design
* **[web-ui/webui-design-doc.md](web-ui/webui-design-doc.md)** – Web UI technical design
* **[websocket-protokoll.md](websocket-protokoll.md)** – WebSocket event protocol specification
* **[dataframe-auslesen.md](dataframe-auslesen.md)** – CAN frame structure and LES02 protocol

## Project Status

**Current Phase:** Prototype (Phase 1)

**Completed:**

* ✅ CAN frame parsing
* ✅ WebSocket event streaming
* ✅ Mock data source
* ✅ Development environment (Nix Flakes)

**In Progress:**

* 🔄 Web UI live chart visualization
* 🔄 Integration testing

**Planned (Phase 2):**

* ⏳ SQLite persistence
* ⏳ Historical ride browser
* ⏳ Reference curve overlay
* ⏳ Export functionality

## Technology Stack

* **Backend:** Python 3.13, python-can, websockets, asyncio
* **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
* **Build:** Bun (JavaScript runtime)
* **Dev Environment:** Nix Flakes

## Troubleshooting

### CAN interface not found

```bash
# Check available interfaces
ip link show

# For development, use virtual CAN:
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

### WebSocket connection refused

Ensure the Python listener is running:

```bash
python -m listener.main
# Should output: "WebSocket server started on ws://localhost:8765"
```

### Web UI shows "Disconnected"

1. Check listener is running
2. Verify WebSocket URL in browser console
3. Check firewall settings

### No CAN frames received

```bash
# Test with candump
candump vcan0  # or can0

# If empty, start mock in another terminal
python -m mock.mock_les02
```

## Non-Nix Systems

If you don't have Nix installed, you can manually install dependencies:

**Python:**

```bash
pip install python-can websockets numpy matplotlib pandas
```

**Node.js / Bun:**

Install Bun from https://bun.sh or use npm/yarn:

```bash
cd web-ui
npm install
npm run dev
```

**CAN utilities:**

```bash
# Debian/Ubuntu
sudo apt install can-utils

# Arch Linux
sudo pacman -S can-utils
```

## License

[Your license here]

## Contact

[Your contact information here]
