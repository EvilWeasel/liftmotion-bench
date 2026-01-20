# listener/position_state.py

import time
from typing import Optional

from .frames import Channel


class PositionState:
    """
    Authoritative position state derived from raw LES02 position frames.

    - Consumes raw master/slave position samples
    - Performs minimal plausibility checking
    - Emits position updates at a fixed interval
    """

    def __init__(self, publish_interval_ms: int = 20):
        self.publish_interval = publish_interval_ms / 1000.0

        self._last_master: Optional[int] = None
        self._last_slave: Optional[int] = None

        self._last_emit_ts: float = 0.0

    def update(self, *, channel: Channel, position_raw: int) -> None:
        """
        Update internal state with a new raw position sample.
        """
        if channel is Channel.MASTER:
            self._last_master = position_raw
        elif channel is Channel.SLAVE:
            self._last_slave = position_raw

    def _is_plausible(self) -> bool:
        """
        Minimal plausibility check.

        For now:
        - require at least a master value
        - ignore slave entirely
        """
        return self._last_master is not None

    def should_emit(self, now: float) -> bool:
        """
        Check whether a new position state should be emitted.
        """
        return (now - self._last_emit_ts) >= self.publish_interval

    def emit(self, now: float) -> Optional[int]:
        """
        Return the current authoritative position if emission is allowed.
        """
        if not self.should_emit(now):
            return None

        if not self._is_plausible():
            return None

        self._last_emit_ts = now
        return self._last_master
