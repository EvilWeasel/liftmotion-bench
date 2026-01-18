import asyncio
import sys
import websockets
from threading import Thread


class WebSocketClient:
    """
    WebSocket client for debugging and testing the LES02 event server.
    
    Connects to the WebSocket server and receives all broadcasted events,
    printing them to the console. Supports manual reconnection via Enter key.
    
    Attributes:
        uri: WebSocket server URI
        ws: Current WebSocket connection (None if not connected)
        reconnect_event: Async event to trigger reconnection
        running: Flag to control the main loop
        loop: Reference to the asyncio event loop
    """

    def __init__(self, uri: str):
        """
        Initialize the WebSocket client.
        
        Args:
            uri: WebSocket server URI (e.g., "ws://localhost:8765")
        """
        self.uri = uri
        self.ws = None
        self.reconnect_event = asyncio.Event()
        self.running = True
        self.loop = None

    def set_loop(self, loop):
        """
        Set the asyncio event loop for thread-safe event signaling.
        
        Args:
            loop: The asyncio event loop instance
        """
        self.loop = loop

    async def connect_and_listen(self):
        """
        Connect to the WebSocket server and listen for messages.
        
        Establishes a connection and receives messages until the connection
        is closed or a reconnect is triggered. Handles connection errors
        gracefully.
        """
        try:
            async with websockets.connect(self.uri) as ws:
                self.ws = ws
                print("Connected to WebSocket server")
                print("Waiting for messages... (Press Enter to reconnect)")
                
                async def receive_messages():
                    try:
                        async for message in ws:
                            print(f"Received: {message}")
                    except websockets.exceptions.ConnectionClosed:
                        pass
                    except Exception as e:
                        print(f"Error receiving messages: {e}")
                
                receive_task = asyncio.create_task(receive_messages())
                reconnect_task = asyncio.create_task(self.reconnect_event.wait())
                
                done, pending = await asyncio.wait(
                    [receive_task, reconnect_task],
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                
                if self.reconnect_event.is_set():
                    self.reconnect_event.clear()
                    receive_task.cancel()
                    try:
                        await receive_task
                    except asyncio.CancelledError:
                        pass
                    await ws.close()
                    print("Disconnected (reconnect requested)")
        except Exception as e:
            print(f"Error connecting: {e}")

    def trigger_reconnect(self):
        """
        Trigger a reconnection by setting the reconnect event.
        
        Thread-safe method that can be called from any thread to request
        a reconnection of the WebSocket client.
        """
        if self.loop and not self.reconnect_event.is_set():
            self.loop.call_soon_threadsafe(self.reconnect_event.set)

    async def run(self):
        """
        Main client loop: connect, listen, and reconnect as needed.
        
        Continuously connects to the server and listens for messages.
        Automatically reconnects on connection loss or when manually triggered.
        """
        self.set_loop(asyncio.get_event_loop())
        while self.running:
            await self.connect_and_listen()
            if self.reconnect_event.is_set():
                await asyncio.sleep(0.3)
            else:
                if self.running:
                    print("Connection lost. Waiting 2 seconds before reconnecting...")
                    await asyncio.sleep(2)


def stdin_listener(client: WebSocketClient):
    """
    Listen for Enter key presses in a separate thread.
    
    Monitors stdin for Enter key presses and triggers reconnection when
    detected. Runs in a daemon thread to avoid blocking the main event loop.
    
    Args:
        client: WebSocketClient instance to trigger reconnection on
    """
    try:
        while client.running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                if line.strip() == "":
                    print("\n[Reconnect requested]")
                    client.trigger_reconnect()
            except (EOFError, KeyboardInterrupt):
                break
    except Exception:
        pass
    finally:
        client.running = False
        client.trigger_reconnect()


async def main():
    """
    Main entry point for the debug WebSocket client.
    
    Creates a WebSocket client, starts the stdin listener thread, and
    runs the client loop until interrupted.
    """
    uri = "ws://localhost:8765"
    client = WebSocketClient(uri)
    
    stdin_thread = Thread(target=stdin_listener, args=(client,), daemon=True)
    stdin_thread.start()
    
    try:
        await client.run()
    except KeyboardInterrupt:
        print("\nClient stopped by user")
        client.running = False


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nClient stopped")
