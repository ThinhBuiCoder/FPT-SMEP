import { io } from 'socket.io-client';

const removeApiSuffix = (url = '') => url.replace(/\/api\/?$/, '');

export const SOCKET_URL = removeApiSuffix(
  import.meta.env.VITE_SOCKET_URL
  || import.meta.env.VITE_API_URL
  || window.location.origin,
);

/**
 * Create a disconnected socket so listeners are registered before connecting.
 * Socket.io's default polling-first transport can then upgrade to WebSocket
 * without forcing a noisy WebSocket handshake while the backend is starting.
 */
export const createSocket = (options = {}) => io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  ...options,
});

