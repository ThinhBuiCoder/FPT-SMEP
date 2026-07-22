/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { createSocket } from '../lib/socketClient';

const RealtimeContext = createContext({
  socket: null,
  isConnected: false,
  connectionError: null,
  onlineUserIds: [],
});

export function RealtimeProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const userId = user?._id || user?.id;
  const socket = useMemo(() => (userId ? createSocket() : null), [userId]);

  useEffect(() => {
    if (!socket || !userId) {
      return undefined;
    }

    let cancelled = false;
    const nextSocket = socket;

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
      nextSocket.emit('user_online', userId);
    };

    const handleDisconnect = (reason) => {
      setIsConnected(false);
      if (reason !== 'io client disconnect') {
        setConnectionError('Mất kết nối realtime. Hệ thống đang tự kết nối lại.');
      }
    };

    const handleConnectError = () => {
      setIsConnected(false);
      setConnectionError('Không thể kết nối tới máy chủ realtime.');
    };

    const handleOnlineUsers = (payload) => {
      setOnlineUserIds(Array.isArray(payload?.userIds) ? payload.userIds.map(String) : []);
    };

    nextSocket.on('connect', handleConnect);
    nextSocket.on('disconnect', handleDisconnect);
    nextSocket.on('connect_error', handleConnectError);
    nextSocket.on('online_users', handleOnlineUsers);

    // Avoid starting a development-only StrictMode handshake that React
    // immediately tears down during its test mount.
    const connectTimer = window.setTimeout(() => {
      if (!cancelled) nextSocket.connect();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(connectTimer);
      nextSocket.off('connect', handleConnect);
      nextSocket.off('disconnect', handleDisconnect);
      nextSocket.off('connect_error', handleConnectError);
      nextSocket.off('online_users', handleOnlineUsers);
      nextSocket.disconnect();
      setIsConnected(false);
      setConnectionError(null);
      setOnlineUserIds([]);
    };
  }, [socket, userId]);

  const value = useMemo(() => ({
    socket,
    isConnected,
    connectionError,
    onlineUserIds,
  }), [socket, isConnected, connectionError, onlineUserIds]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
