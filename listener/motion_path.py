# motion_path.py

from typing import List, Tuple, Optional
from dataclasses import dataclass
from scipy.signal import savgol_filter
import numpy as np


@dataclass
class MotionSample:
    timestamp: float
    position_mm: float
    velocity_mm_s: float
    acceleration_mm_s2: float


def smooth_motion(
    samples: List[Tuple[float, float]],
    window_size: int = 5,
    poly_order: int = 2
) -> Optional[MotionSample]:
    """
    Smooth position samples with Savitzky-Golay and compute velocity/acceleration.

    Args:
        samples: List of (timestamp, position_mm)
        window_size: number of points used for smoothing (must be odd)
        poly_order: polynomial order for Savitzky-Golay filter

    Returns:
        MotionSample centered in the window or None if not enough points
    """

    if len(samples) < window_size or window_size % 2 == 0:
        return None

    times = np.array([t for t, _ in samples])
    positions = np.array([p for _, p in samples])

    # --- Sampling interval check ---
    dts = np.diff(times)
    if np.any(dts <= 0):
        return None
    dt_m = float(np.mean(dts))

    # --- Savitzky-Golay filter ---
    # position: smoothed
    p_smooth = savgol_filter(
        positions,
        window_length=window_size,
        polyorder=poly_order,
        deriv=0,
        mode="interp"
    )

    # velocity: 1st derivative
    # scipy SG deriv liefert d(p)/dx, wir müssen durch dt skalieren
    v_smooth = savgol_filter(
        positions,
        window_length=window_size,
        polyorder=poly_order,
        deriv=1,
        delta=dt_m,
        mode="interp"
    )

    # acceleration: 2nd derivative
    a_smooth = savgol_filter(
        positions,
        window_length=window_size,
        polyorder=poly_order,
        deriv=2,
        delta=dt_m,
        mode="interp"
    )

    # --- Take center of the window ---
    half = window_size // 2

    return MotionSample(
        timestamp=times[half],
        position_mm=float(p_smooth[half]),
        velocity_mm_s=float(v_smooth[half]),
        acceleration_mm_s2=float(a_smooth[half])
    )
