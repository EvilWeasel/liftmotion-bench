from dataclasses import dataclass
from enum import Enum


class Channel(Enum):
    """
    CAN channel identifier for LES02 system.
    
    The LES02 system uses two channels: MASTER and SLAVE.
    The channel is determined by the least significant bit of the CAN ID.
    """
    MASTER = "master"
    SLAVE = "slave"


class MessageType(Enum):
    """
    CAN message type identifiers for LES02 protocol.
    
    Each message type corresponds to a base CAN ID with the LSB masked out.
    """
    SYSTEM = 0x10
    ERROR = 0x20
    STATUS = 0x30
    POSITION = 0x80
    UNKNOWN = 0x00


@dataclass(frozen=True)
class CANFrame:
    """
    High-level representation of a parsed LES02 CAN frame.
    
    Contains all relevant information extracted from a raw CAN message,
    including timestamp, parsed channel and message type, and raw data.
    
    Attributes:
        timestamp: Unix timestamp when the frame was received
        can_id: Raw CAN arbitration ID
        channel: Parsed channel (MASTER or SLAVE)
        message_type: Parsed message type
        dlc: Data length code (number of data bytes)
        data: Raw message data bytes
    """
    timestamp: float
    can_id: int
    channel: Channel
    message_type: MessageType
    dlc: int
    data: bytes


@dataclass(frozen=True)
class PositionSample:
    """
    Parsed position sample extracted from a CAN frame.
    
    Represents a position measurement from the LES02 system.
    Position values are in raw units (typically millimeters).
    
    Attributes:
        timestamp: Unix timestamp when the position was measured
        channel: Channel that provided the measurement
        position_raw: Raw position value in units
    """
    timestamp: float
    channel: Channel
    position_raw: int


def determine_channel(can_id: int) -> Channel:
    """
    Determine the channel from a CAN ID.
    
    The channel is determined by the least significant bit:
    - Even CAN ID (LSB = 0) -> MASTER
    - Odd CAN ID (LSB = 1) -> SLAVE
    
    Args:
        can_id: CAN arbitration ID
        
    Returns:
        Channel enum value (MASTER or SLAVE)
    """
    return Channel.MASTER if can_id % 2 == 0 else Channel.SLAVE


def determine_message_type(can_id: int) -> MessageType:
    """
    Determine the message type from a CAN ID.
    
    Masks out the least significant bit and matches against known
    message type base IDs.
    
    Args:
        can_id: CAN arbitration ID
        
    Returns:
        MessageType enum value, or UNKNOWN if no match found
    """
    base_id = can_id & 0xFE
    for msg_type in MessageType:
        if msg_type.value == base_id:
            return msg_type
    return MessageType.UNKNOWN


def parse_position(data: bytes) -> int:
    """
    Parse a 24-bit position value from CAN frame data.
    
    The position is encoded as big-endian in the first 3 bytes:
    - Byte 0: Most significant byte (bits 23-16)
    - Byte 1: Middle byte (bits 15-8)
    - Byte 2: Least significant byte (bits 7-0)
    
    Args:
        data: CAN frame data bytes (must have at least 3 bytes)
        
    Returns:
        24-bit position value as integer
        
    Raises:
        ValueError: If data has fewer than 3 bytes
    """
    if len(data) < 3:
        raise ValueError("Position frame requires at least 3 bytes")
    return (data[0] << 16) | (data[1] << 8) | data[2]
