import { useState, useEffect } from "react";
import { getMsUntilNextUtcMidnight, formatTwoDigits } from "../utils/gameHelpers";

export default function useTimers(serverOffsetMs) {
  const [resetTimer, setResetTimer] = useState("--:--:--");

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

  return { resetTimer };
}
