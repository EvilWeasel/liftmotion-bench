import can
import time
import itertools
import math

# =========================
# CAN setup
# =========================
bus = can.interface.Bus(channel="vcan0", interface="socketcan")

MASTER_ID = 0x80
SLAVE_ID  = 0x81
id_cycle = itertools.cycle([MASTER_ID, SLAVE_ID])

# =========================
# Simulation parameters
# =========================
DISTANCE_M = 10.0          # meters
MAX_V = 1.5               # m/s (increased for more visible difference)
ACC = 0.4                 # m/s² (reduced for slower, more visible acceleration)
SEND_FREQUENCY_HZ = 10   # Hz (messages per second)
DT = 1.0 / SEND_FREQUENCY_HZ  # Time step in seconds
PAUSE_TIME = 5.0          # seconds

# LES02 uses absolute position (we choose 1 unit = 1 mm)
UNITS_PER_METER = 1000

# =========================
# Derived values
# =========================
t_acc = MAX_V / ACC
d_acc = 0.5 * ACC * t_acc ** 2

if 2 * d_acc > DISTANCE_M:
    raise ValueError("Distance too short for given acceleration")

d_const = DISTANCE_M - 2 * d_acc
t_const = d_const / MAX_V

# =========================
# Helper functions
# =========================
def send_position(position_units):
    can_id = next(id_cycle)

    pos = int(position_units) & 0xFFFFFF

    data = [
        (pos >> 16) & 0xFF,
        (pos >> 8) & 0xFF,
        pos & 0xFF,
        0x00
    ]

    msg = can.Message(
        arbitration_id=can_id,
        data=data,
        is_extended_id=False
    )

    bus.send(msg)

# =========================
# Motion profile
# =========================
def run_trip(direction=1):
    # Start position: 0m when going up, DISTANCE_M when going down
    position = DISTANCE_M if direction < 0 else 0.0
    velocity = 0.0
    traveled = 0.0

    # Acceleration phase
    t = 0.0
    while t < t_acc:
        velocity = ACC * t
        position += velocity * DT * direction
        traveled += abs(velocity * DT)
        
        # Clamp position to valid range [0, DISTANCE_M]
        position = max(0.0, min(DISTANCE_M, position))

        send_position(position * UNITS_PER_METER)
        time.sleep(DT)
        t += DT

    # Constant speed
    t = 0.0
    while t < t_const:
        velocity = MAX_V
        position += velocity * DT * direction
        traveled += abs(velocity * DT)
        
        # Clamp position to valid range [0, DISTANCE_M]
        position = max(0.0, min(DISTANCE_M, position))

        send_position(position * UNITS_PER_METER)
        time.sleep(DT)
        t += DT

    # Deceleration
    t = 0.0
    while t < t_acc:
        velocity = MAX_V - ACC * t
        position += velocity * DT * direction
        traveled += abs(velocity * DT)
        
        # Clamp position to valid range [0, DISTANCE_M]
        position = max(0.0, min(DISTANCE_M, position))

        send_position(position * UNITS_PER_METER)
        time.sleep(DT)
        t += DT
    
    # Ensure final position is exactly at target (0 or DISTANCE_M)
    final_position = DISTANCE_M if direction > 0 else 0.0
    send_position(final_position * UNITS_PER_METER)

# =========================
# Main loop
# =========================
print("🚦 LES02 elevator motion mock started")

direction = 1

print(f"Running first trip in 5 seconds...")
time.sleep(5)
while True:
    print(f"Running trip")
    run_trip(direction=direction)
    print(f"Reached end position, pausing for {PAUSE_TIME} seconds...")
    time.sleep(PAUSE_TIME)
    direction *= -1
