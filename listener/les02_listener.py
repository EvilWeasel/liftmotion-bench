import can
import time

bus = can.interface.Bus(channel="vcan0", interface="socketcan")

print("LES02 listener started")

for msg in bus:
    timestamp = time.time()

    can_id = msg.arbitration_id
    dlc = msg.dlc
    data = msg.data

    # Kanal bestimmen
    channel = "MASTER" if can_id % 2 == 0 else "SLAVE"

    # Nachrichtentyp bestimmen
    base_id = can_id & 0xFE  # LSB maskieren

    if base_id == 0x80 and dlc == 4:
        # Positionsdaten
        position = (data[0] << 16) | (data[1] << 8) | data[2]

        print(
            f"[{timestamp:.6f}] "
            f"{channel} "
            f"POS={position}"
        )

    else:
        # Alles andere erstmal roh loggen
        print(
            f"[{timestamp:.6f}] "
            f"{channel} "
            f"ID=0x{can_id:02X} "
            f"DLC={dlc} "
            f"DATA={data.hex()}"
        )
