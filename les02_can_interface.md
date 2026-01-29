## 1. Interface Specification

* **Protocol:** CAN 2.0A (Standard 11-bit Identifier).
* **Baud Rate:** Typically 250k or 500k (Check your specific hardware settings).
* **Channel Architecture:** Two independent channels transmit data to ensure SIL3 safety compliance.
* **Master Channel:** Uses **Even** IDs (e.g., 0x80).
* **Slave Channel:** Uses **Odd** IDs (e.g., 0x81).



### Interleaved Timing

The bus does not wait for a request; it is a cyclic "push" system.

* **Per Channel:** Each channel sends a position every **4 ms**.
* **Combined Bus:** The Slave offsets its transmission by 2 ms relative to the Master.
* **Result:** You will see a message on the bus exactly every **2 ms**.

---

## 2. Message Catalog (Abstract Model)

| Message Type | Master ID | Slave ID | DLC | Frequency | Description |
| --- | --- | --- | --- | --- | --- |
| **System** | `0x10` | `0x11` | 8 | Event/Startup | Used for Locking and Unlocking the sensor. |
| **Error** | `0x20` | `0x21` | 8 | On Error | Transmits hardware/software fault codes. |
| **Status** | `0x30` | `0x31` | 8 | Startup | Indicates if the channel is ready or starting up. |
| **Position** | `0x80` | `0x81` | 4 | 4 ms (each) | The actual 24-bit position value. |

---

## 3. Frame Byte-Level Mapping

*Note: In Python-CAN, `msg.data[0]` corresponds to Byte 1 of the manual.*

### 3.1 Position Message (`0x80` / `0x81`)

These frames are shorter than the others to reduce bus load.

| Byte | Field | Description |
| --- | --- | --- |
| **1** | Position (MSB) | High byte of the 24-bit position value. |
| **2** | Position (Mid) | Middle byte of the position. |
| **3** | Position (LSB) | Low byte of the position. |
| **4** | Reserved | Internal use (ignore for your chart). |

### 3.2 System Message (`0x10` / `0x11`)

The most critical frame for state management.

| Byte | Field | Value/Description |
| --- | --- | --- |
| **1-2** | Unlock Key | A 16-bit dynamic key sent by the sensor when locked. |
| **3-7** | Reserved | Usually `0x00`. |
| **8** | State/Command | `0xF0` = Sensor is **Locked** (Sent by LES02).<br>

<br>`0xFF` = Sensor is **Unlocked** (Sent by evaluation unit). |

---

## 4. Communication Logic Flow

### Normal Operation (The Mock Loop)

1. Wait 2ms.
2. **Master (`0x80`):** Send Position Frame.
3. Wait 2ms.
4. **Slave (`0x81`):** Send Position Frame.
5. Repeat.

### Error Handling & Unlocking

If a fault occurs (or on initial boot if configured):

1. **Sensor:** Stops position frames.
2. **Sensor:** Sends `0x10` with Byte 8 = `0xF0` and a dynamic key in Bytes 1-2.
3. **Your Software:** Must read the key and send back `0x10` with Byte 8 = `0xFF` and that same key in Bytes 1-2.
4. **Window:** This must happen within **30 ms**, or the sensor ignores the command.

