import { useCallback, useEffect, useRef, useState } from "react";
import {
  startQuestTimer,
  pauseQuestTimer,
  resumeQuestTimer,
  stopQuestTimer
} from "../api";

// Per-quest server-authoritative timer state. Client polls a 1s tick to
// keep elapsed ms fresh for rendering; all lifecycle transitions are
// validated on the server.
export default function useQuestTimers({ username, initialSessions = [], serverOffsetMs = 0 }) {
  const [sessionsByQuestId, setSessionsByQuestId] = useState(() => indexByQuestId(initialSessions));
  const [nowTick, setNowTick] = useState(() => Date.now());
  const pendingRef = useRef(new Set());

  useEffect(() => {
    setSessionsByQuestId(indexByQuestId(initialSessions));
  }, [initialSessions]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const setOne = useCallback((questId, session) => {
    setSessionsByQuestId((prev) => {
      const next = { ...prev };
      if (session) {
        next[questId] = session;
      } else {
        delete next[questId];
      }
      return next;
    });
  }, []);

  const withLock = async (questId, fn) => {
    if (pendingRef.current.has(questId)) return null;
    pendingRef.current.add(questId);
    try {
      return await fn();
    } finally {
      pendingRef.current.delete(questId);
    }
  };

  const start = useCallback(async (questId) => {
    if (!username) return null;
    return withLock(questId, async () => {
      const resp = await startQuestTimer(username, questId);
      if (resp?.session) setOne(questId, resp.session);
      return resp;
    });
  }, [username, setOne]);

  const pause = useCallback(async (questId) => {
    if (!username) return null;
    return withLock(questId, async () => {
      const resp = await pauseQuestTimer(username, questId);
      if (resp?.session) setOne(questId, resp.session);
      return resp;
    });
  }, [username, setOne]);

  const resume = useCallback(async (questId) => {
    if (!username) return null;
    return withLock(questId, async () => {
      const resp = await resumeQuestTimer(username, questId);
      if (resp?.session) setOne(questId, resp.session);
      return resp;
    });
  }, [username, setOne]);

  const stop = useCallback(async (questId) => {
    if (!username) return null;
    return withLock(questId, async () => {
      const resp = await stopQuestTimer(username, questId);
      setOne(questId, null);
      return resp;
    });
  }, [username, setOne]);

  function getElapsedMs(questId) {
    const session = sessionsByQuestId[questId];
    if (!session) return 0;
    if (session.status === "paused") {
      return Number(session.elapsedMs) || 0;
    }
    const started = session.startedAt ? new Date(session.startedAt).getTime() : 0;
    if (!started) return 0;
    const syncedNow = nowTick + (serverOffsetMs || 0);
    const totalPaused = Number(session.totalPausedMs) || 0;
    return Math.max(0, syncedNow - started - totalPaused);
  }

  return {
    sessionsByQuestId,
    getElapsedMs,
    start,
    pause,
    resume,
    stop
  };
}

function indexByQuestId(list) {
  if (!Array.isArray(list)) return {};
  const out = {};
  for (const session of list) {
    if (session && Number.isInteger(Number(session.questId))) {
      out[Number(session.questId)] = session;
    }
  }
  return out;
}
