import can
import time
from typing import Iterator

from .frames import (
    CANFrame,
    Channel,
    MessageType,
    determine_channel,
    determine_message_type,
)


class CANBusReader:
    """
    Reads CAN messages from a SocketCAN interface and converts them to CANFrame objects.
    
    Provides a blocking iterator interface for reading CAN bus messages.
    Each message is parsed and wrapped in a high-level CANFrame object with
    timestamp, channel, message type, and data.
    
    Attributes:
        _bus: CAN bus interface instance
    """

    def __init__(self, channel: str):
        """
        Initialize the CAN bus reader.
        
        Args:
            channel: CAN interface name (e.g., "vcan0", "can0")
        """
        self._bus = can.interface.Bus(
            channel=channel,
            interface="socketcan"
        )

    def frames(self) -> Iterator[CANFrame]:
        """
        Generator that yields parsed CANFrame objects.
        
        Continuously reads messages from the CAN bus and yields them as
        CANFrame objects. Blocks until a message is available.
        
        Yields:
            CANFrame: Parsed CAN frame with timestamp and metadata
            
        Note:
            This is a blocking generator. Use it in a separate thread
            when running in an async context.
        """
        for msg in self._bus:
            timestamp = time.time()
            channel = determine_channel(msg.arbitration_id)
            message_type = determine_message_type(msg.arbitration_id)

            yield CANFrame(
                timestamp=timestamp,
                can_id=msg.arbitration_id,
                channel=channel,
                message_type=message_type,
                dlc=msg.dlc,
                data=bytes(msg.data),
            )
