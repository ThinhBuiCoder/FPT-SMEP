import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL
  || import.meta.env.VITE_API_URL
  || window.location.origin).replace(/\/api\/?$/, '');

/**
 * Subscribe to lightweight Weekly Task invalidation events. Task data is
 * always reloaded through the authenticated REST API by the caller.
 */
export function useWeeklyTaskRealtime({
  teamId,
  classId,
  courseCode,
  weekNumber,
  enabled = true,
  onChange,
}) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const scope = {
      teamId: teamId || undefined,
      classId: classId || undefined,
      courseCode: courseCode || undefined,
    };
    const hasScope = Boolean(scope.teamId || scope.classId || scope.courseCode);
    if (!enabled || !hasScope) return undefined;

    let cancelled = false;
    let hasJoinedBefore = false;
    let refreshTimer = null;
    const socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    const scheduleRefresh = (event) => {
      if (
        event?.action !== 'reconnected'
        && weekNumber
        && Number(event?.weekNumber) !== Number(weekNumber)
      ) return;

      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        onChangeRef.current?.(event);
      }, 50);
    };

    const joinScopes = () => socket.emit('join_weekly_tasks', scope, (result) => {
      if (!result?.ok) return;
      if (hasJoinedBefore) scheduleRefresh({ action: 'reconnected' });
      hasJoinedBefore = true;
    });

    const handleTaskChange = (event) => scheduleRefresh(event);

    socket.on('connect', joinScopes);
    socket.on('weekly_task_changed', handleTaskChange);

    const connectTimer = window.setTimeout(() => {
      if (!cancelled) socket.connect();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(connectTimer);
      window.clearTimeout(refreshTimer);
      if (socket.connected) socket.emit('leave_weekly_tasks', scope);
      socket.off('connect', joinScopes);
      socket.off('weekly_task_changed', handleTaskChange);
      socket.disconnect();
    };
  }, [teamId, classId, courseCode, weekNumber, enabled]);
}
