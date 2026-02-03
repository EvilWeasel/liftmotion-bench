import can
import time
import itertools
from enum import Enum, auto

# =========================
# CAN setup
# =========================
bus = can.interface.Bus(channel="vcan0", interface="socketcan")

MASTER_ID = 0x80
SLAVE_ID = 0x81
id_cycle = itertools.cycle([MASTER_ID, SLAVE_ID])

# =========================
# Simulation parameters
# =========================
DISTANCE_M = 10.0
MAX_V = 1.5
ACC = 0.4

SEND_FREQUENCY_HZ = 10
DT = 1.0 / SEND_FREQUENCY_HZ

PAUSE_TIME = 5.0

UNITS_PER_METER = 1000  # 1 unit = 1 mm

# =========================
# Derived values
# =========================
T_ACC = MAX_V / ACC
D_ACC = 0.5 * ACC * T_ACC ** 2

if 2 * D_ACC > DISTANCE_M:
    raise ValueError("Distance too short for given acceleration")

D_CONST = DISTANCE_M - 2 * D_ACC
T_CONST = D_CONST / MAX_V

# =========================
# CAN helper
# =========================


def send_position(position_m: float):
    position_units = int(position_m * UNITS_PER_METER) & 0xFFFFFF
    can_id = next(id_cycle)

    msg = can.Message(
        arbitration_id=can_id,
        data=[
            (position_units >> 16) & 0xFF,
            (position_units >> 8) & 0xFF,
            position_units & 0xFF,
            0x00
        ],
        is_extended_id=False
    )

    bus.send(msg)

# =========================
# Motion generators
# =========================


def accel_phase(direction: int):
    t = 0.0
    while t < T_ACC:
        yield ACC * t * direction
        t += DT


def constant_phase(direction: int):
    t = 0.0
    while t < T_CONST:
        yield MAX_V * direction
        t += DT


def decel_phase(direction: int):
    t = 0.0
    while t < T_ACC:
        yield (MAX_V - ACC * t) * direction
        t += DT


def pause_phase():
    t = 0.0
    while t < PAUSE_TIME:
        yield 0.0
        t += DT

# =========================
# Motion state machine
# =========================


class Phase(Enum):
    UP = auto()
    PAUSE_TOP = auto()
    DOWN = auto()
    PAUSE_BOTTOM = auto()


def motion_sequence():
    while True:
        yield from accel_phase(+1)
        yield from constant_phase(+1)
        yield from decel_phase(+1)
        yield from pause_phase()

        yield from accel_phase(-1)
        yield from constant_phase(-1)
        yield from decel_phase(-1)
        yield from pause_phase()


# =========================
# Main loop
# =========================
print("🚦 LES02 elevator motion mock started")

position = 0.0
velocity = 0.0

sequence = motion_sequence()
next_tick = time.monotonic()

while True:
    velocity = next(sequence)
    position += velocity * DT

    # Clamp to shaft limits
    position = max(0.0, min(DISTANCE_M, position))

    print(f"Sending position: {position:.3f} m")
    send_position(position)

    # Fixed-rate timing
    next_tick += DT
    sleep_time = next_tick - time.monotonic()
    if sleep_time > 0:
        time.sleep(sleep_time)
