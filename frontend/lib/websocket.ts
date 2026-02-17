// frontend/lib/websocket.ts

type Listener = (msg: string) => void;

let socket: WebSocket | null = null;
let listeners: Listener[] = [];

export function connect() {
  if (socket) return; // ✅ prevent multiple connections

  socket = new WebSocket("ws://127.0.0.1:8000/ws");

  socket.onmessage = (event) => {
    listeners.forEach((l) => l(event.data));
  };

  socket.onopen = () => {
    console.log("✅ WebSocket connected");
  };
}

export function subscribe(fn: Listener) {
  listeners.push(fn);
}

export function ask(question: string) {
  socket?.send(question);
}
