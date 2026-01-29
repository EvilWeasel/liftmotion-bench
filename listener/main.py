from typing import Any


import asyncio
from concurrent.futures import ThreadPoolExecutor
from queue import Queue as ThreadQueue, Empty

from listener import position_state
from listener.can_reader import CANBusReader
from listener.frames import CANFrame, MessageType
from listener.events import EventEnvelope
from listener.websocket_server import WebSocketEventServer
from listener.position_state import PositionState


async def run_can_loop(reader: CANBusReader, ws_server: WebSocketEventServer):
    """
    Process CAN bus frames and broadcast position events via WebSocket.

    Runs the blocking CAN reader in a separate thread to avoid blocking the
    async event loop. Uses a thread-safe queue to pass frames from the
    blocking thread to the async event loop for processing.

    Args:
        reader: CANBusReader instance for reading CAN frames
        ws_server: WebSocketEventServer instance for broadcasting events
    """
    position_state = PositionState(publish_interval_ms=20)
    frame_queue = ThreadQueue[CANFrame | None]()
    executor = ThreadPoolExecutor(max_workers=1)

    def read_can_frames_blocking():
        """
        Blocking function that reads CAN frames and enqueues them.

        Runs in a separate thread and continuously reads frames from the
        CAN bus, putting them into the queue for async processing.
        """
        try:
            for frame in reader.frames():
                frame_queue.put(frame)
        except Exception as e:
            print(f"Error reading CAN frames: {e}")
            frame_queue.put(None)

    executor.submit(read_can_frames_blocking)

    while True:
        try:
            frame = frame_queue.get_nowait()
        except Empty:
            await asyncio.sleep(0.001)
            continue

        if frame is None:
            break

        if frame.message_type is MessageType.POSITION and frame.dlc == 4:
            position_raw = int.from_bytes(frame.data[:3], byteorder="big")
            now = frame.timestamp

            position_state.update(
                channel=frame.channel,
                position_raw=position_raw,
                timestamp=now
            )

            emitted = position_state.emit(now)

            if emitted is None:
                continue

            event = EventEnvelope(
                proto=1,
                type="motion_sample",
                ts=emitted.timestamp,
                source="les02",
                payload=emitted.__dict__,
            )
            try:
                await ws_server.broadcast(event)
            except Exception as e:
                print(f"Error broadcasting event: {e}")
                import traceback
                traceback.print_exc()


async def main():
    """
    Main entry point for the LES02 listener application.

    Initializes the CAN bus reader and WebSocket server, then runs both
    concurrently. The application runs until interrupted.
    """
    reader = CANBusReader(channel="vcan0")
    ws_server = WebSocketEventServer()

    print("Starting WebSocket server...")
    ws_task = asyncio.create_task(ws_server.start())

    await asyncio.sleep(0)

    print("LES02 listener started")

    can_task = asyncio.create_task(run_can_loop(reader, ws_server))

    await asyncio.gather(ws_task, can_task)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nListener stopped by user (Ctrl+C)")
