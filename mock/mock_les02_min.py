import can
import time
import itertools

bus = can.interface.Bus(channel='vcan0', interface='socketcan')

MASTER_ID = 0x80
SLAVE_ID = 0x81

position = 0

# Generator for alternating IDs
id_cycle = itertools.cycle([MASTER_ID, SLAVE_ID])

print("Mocking LES02 on vcan0...")

while True:
    # Alternate master and slave
    can_id = next(id_cycle)

    position = (position + 1) & 0xFFFFFF
    
    # MSB first 1-3
    b1 = (position >> 16) & 0xFF
    b2 = (position >> 8) & 0xFF
    b3 = position & 0xFF

    # Create message
    data=[b1, b2, b3, 0x00]

    msg = can.Message(
        arbitration_id=can_id,
        data=data,
        is_extended_id=False)

    bus.send(msg)

    # Should be 2ms, 4ms alternating per channel
    time.sleep(0.002)