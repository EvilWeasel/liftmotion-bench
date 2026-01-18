from dataclasses import dataclass, asdict
from typing import Any, Dict


@dataclass(frozen=True)
class EventEnvelope:
    """
    Event envelope for WebSocket message protocol.
    
    Wraps event data with metadata including protocol version, event type,
    timestamp, and source identifier. Used for all events sent over WebSocket.
    
    Attributes:
        proto: Protocol version number
        type: Event type identifier (e.g., "position_sample")
        ts: Unix timestamp in seconds (float)
        source: Source identifier (e.g., "les02")
        payload: Event-specific data dictionary
    """
    proto: int
    type: str
    ts: float
    source: str
    payload: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the event envelope to a dictionary.
        
        Returns:
            Dictionary representation suitable for JSON serialization
        """
        return asdict(self)
