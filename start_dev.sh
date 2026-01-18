#!/usr/bin/env bash

# Start LES02 development environment
# Opens 3 separate terminal windows for listener, mock, and debug client

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect terminal
if command -v kitty &> /dev/null; then
    TERMINAL="kitty"
elif command -v gnome-terminal &> /dev/null; then
    TERMINAL="gnome-terminal"
elif command -v xterm &> /dev/null; then
    TERMINAL="xterm"
else
    echo "Error: No supported terminal found (kitty, gnome-terminal, or xterm)"
    exit 1
fi

# Function to start a program in a new terminal window
start_in_terminal() {
    local title=$1
    local command=$2

    case $TERMINAL in
        kitty)
            kitty --title "$title" bash -c "cd '$SCRIPT_DIR' && $command; echo; echo 'Press Enter to close this window...'; read" &
            ;;
        gnome-terminal)
            gnome-terminal -- bash -c "cd '$SCRIPT_DIR' && $command; echo; echo 'Press Enter to close this window...'; read" &
            ;;
        xterm)
            xterm -T "$title" -e "bash -c 'cd \"$SCRIPT_DIR\" && $command; echo; echo \"Press Enter to close this window...\"; read'" &
            ;;
    esac
}

echo "🚀 Starting LES02 development environment..."
echo "Opening 3 terminal windows..."
echo ""

# Start listener
echo "  📡 Starting listener..."
start_in_terminal "LES02 Listener" "python -m listener.main"

# Small delay to ensure windows open in order
sleep 0.3

# Start mock
echo "  🎭 Starting mock..."
start_in_terminal "LES02 Mock" "python -m mock.mock_les02_realistic"

# Small delay
sleep 0.3

# Start debug client
echo "  🐛 Starting debug client..."
start_in_terminal "LES02 Debug Client" "python listener/debug_ws_client.py"

sleep 0.3

echo ""
echo "✅ All windows opened!"
echo ""
echo "To stop all processes:"
echo "  - Close the terminal windows, or"
echo "  - Press Ctrl+C in each window"

