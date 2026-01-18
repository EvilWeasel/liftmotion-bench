import asyncio
import json
from typing import Set

import websockets
from websockets.server import WebSocketServerProtocol

from .events import EventEnvelope


class WebSocketEventServer:
    """
    WebSocket server that broadcasts events to all connected clients.
    
    The server runs permanently and maintains persistent connections with clients.
    Events are broadcast to all connected clients concurrently.
    
    Attributes:
        _host: Server hostname or IP address
        _port: Server port number
        _clients: Set of connected WebSocket client connections
        _lock: Async lock for thread-safe access to client set
    """

    def __init__(self, host: str = "localhost", port: int = 8765):
        """
        Initialize the WebSocket event server.
        
        Args:
            host: Hostname or IP address to bind to (default: "localhost")
            port: Port number to listen on (default: 8765)
        """
        self._host = host
        self._port = port
        self._clients: Set[WebSocketServerProtocol] = set()
        self._lock: asyncio.Lock = None

    async def _handler(self, websocket: WebSocketServerProtocol):
        """
        Handle a new WebSocket client connection.
        
        Adds the client to the connection set and keeps the connection alive
        until it is closed. Removes the client from the set when disconnected.
        
        Args:
            websocket: The WebSocket connection protocol instance
        """
        if self._lock is None:
            self._lock = asyncio.Lock()
        async with self._lock:
            self._clients.add(websocket)
            client_count = len(self._clients)
        print(f"Client connected. Total clients: {client_count}")
        
        try:
            async for message in websocket:
                pass
        except websockets.exceptions.ConnectionClosed as e:
            print(f"Connection closed: code={e.code}, reason={e.reason}")
        except Exception as e:
            print(f"Error in WebSocket handler: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
        finally:
            async with self._lock:
                self._clients.discard(websocket)
                client_count = len(self._clients)
            print(f"Client disconnected. Total clients: {client_count}")

    async def broadcast(self, event: EventEnvelope):
        """
        Broadcast an event to all connected clients.
        
        Serializes the event to JSON and sends it to all active connections
        concurrently. Automatically removes clients that fail to receive the message.
        
        Args:
            event: The EventEnvelope to broadcast
        """
        if self._lock is None:
            self._lock = asyncio.Lock()
        async with self._lock:
            clients_snapshot = list(self._clients)
        
        if not clients_snapshot:
            return
        
        message = json.dumps(event.to_dict())
        active_clients = [client for client in clients_snapshot]
        
        if not active_clients:
            print("No active clients to broadcast to")
            return
        
        async def send_to_client(client):
            try:
                await client.send(message)
                return True
            except websockets.exceptions.ConnectionClosed:
                async with self._lock:
                    self._clients.discard(client)
                return False
            except Exception as e:
                print(f"Error sending to client: {e}")
                async with self._lock:
                    self._clients.discard(client)
                return False
        
        await asyncio.gather(
            *(send_to_client(client) for client in active_clients),
            return_exceptions=True
        )

    async def start(self):
        """
        Start the WebSocket server and keep it running indefinitely.
        
        Binds to the configured host and port, then waits for client connections.
        The server runs until the process is terminated.
        """
        if self._lock is None:
            self._lock = asyncio.Lock()
        
        print(f"Starting WebSocket server on {self._host}:{self._port}...")

        async with websockets.serve(
            self._handler,
            self._host,
            self._port,
        ):
            print(f"WebSocket server started on ws://{self._host}:{self._port}")
            print("Server is running and waiting for clients...")

            await asyncio.Future()
