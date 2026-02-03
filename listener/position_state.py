# listener/position_state.py

from collections import deque
from dataclasses import dataclass
from typing import Deque, Optional, Tuple
import numpy as np

from listener.motion_path import MotionSample, smooth_motion
from .frames import Channel


class PositionState:
    """
    Authoritative position state derived from raw LES02 position frames.
    Reconstructs smooth motion (position, velocity, acceleration)
    from high-frequency raw position samples.
    """

    def __init__(self, publish_interval_ms: int = 20, max_samples: int = 50, window_size: int = 5) -> None:
        self.publish_interval = publish_interval_ms / 1000.0
        self._window_size = window_size

        self._last_master: int = 0
        self._last_slave: int = 0

        self._last_emit_ts: float = 0.0

        # Store last ~100 ms of samples (4ms -> ~25 samples)
        # To be save in case of frequency-shift: 50 samples in queue
        self._samples: Deque[Tuple[float, float]] = deque(maxlen=max_samples)

    def update(self, *, channel: Channel, position_raw: int, timestamp: float) -> None:
        """
        Update internal state with a new raw position sample.
        """
        match channel:
            case Channel.MASTER:
                self._last_master = position_raw
            case Channel.SLAVE:
                self._last_slave = position_raw
            case _:
                return

        # Nur speichern, wenn Master plausibel ist
        if self._is_plausible():
            self._samples.append((timestamp, float(self._last_master)))

    def _is_plausible(self) -> bool:
        """
        Minimal plausibility check.
        """
        return self._last_master is not None

    def _should_emit(self, now: float) -> bool:
        """
        Check whether a new position state should be emitted.
        """
        return (now - self._last_emit_ts) >= self.publish_interval

    def emit(self, now: float) -> Optional[MotionSample]:
        """
        Return the current authoritative MotionSample if emission is allowed.
        """
        if not self._should_emit(now):
            return None

        # Minimum number of samples for Savitzky-Golay
        if len(self._samples) < self._window_size:
            return None

        sample_list = list(self._samples)[-self._window_size:]

        # Glätte und berechne velocity/acceleration
        motion_sample = smooth_motion(sample_list, window_size=5, poly_order=2)
        if motion_sample is None:
            return None

        self._last_emit_ts = now
        return motion_sample
