import { useState, useEffect } from "react";
import { getMsUntilNextUtcMidnight, formatTwoDigits, formatDurationWithDays } from "../utils/gameHelpers";

export default function useTimers(serverOffsetMs, nextWeekResetAtMs) {
  const [resetTimer, setResetTimer] = useState("--:--:--");
  const [weekResetTimer, setWeekResetTimer] = useState("--:--:--");

  useEffect(() => {
    const tick = () => {
      const syncedNowMs = Date.now() + serverOffsetMs;
      const msLeft = getMsUntilNextUtcMidnight(syncedNowMs);
      const totalSecs = Math.floor(msLeft / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      setResetTimer(`${formatTwoDigits(hrs)}:${formatTwoDigits(mins)}:${formatTwoDigits(secs)}`);
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [serverOffsetMs]);

  useEffect(() => {
    const tick = () => {
      if (!Number.isFinite(nextWeekResetAtMs)) {
        setWeekResetTimer("--:--:--");
        return;
      }
      const syncedNowMs = Date.now() + serverOffsetMs;
      const msLeft = Math.max(0, nextWeekResetAtMs - syncedNowMs);
      setWeekResetTimer(formatDurationWithDays(msLeft));
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [nextWeekResetAtMs, serverOffsetMs]);

  return { resetTimer, weekResetTimer };
}
