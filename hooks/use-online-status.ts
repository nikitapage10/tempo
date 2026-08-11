"use client";

import * as React from "react";

/** Live network status via the standard browser events — works the same inside the Electron renderer. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  React.useEffect(() => {
    function goOnline() {
      setOnline(true);
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
