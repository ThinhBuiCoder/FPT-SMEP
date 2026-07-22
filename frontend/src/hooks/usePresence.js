// Backward-compatible alias for components that used the old presence hook.
// The connection itself is now owned by RealtimeProvider so the application
// uses one socket for presence, chat and reconnect handling.
export { useRealtime as usePresence } from '../context/RealtimeContext';
