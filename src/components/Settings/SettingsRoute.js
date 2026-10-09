import React, { useCallback, useState } from "react";
import SettingsPage from "./SettingsPage";

const readTimeFormat = () =>
  localStorage.getItem("timeFormat")
  || localStorage.getItem("cached_time_format")?.replace(/^"|"$/g, "")
  || "24h";

const SettingsRoute = () => {
  const [timeFormat, setTimeFormatState] = useState(readTimeFormat);
  const [reverseSort, setReverseSort] = useState(false);

  const setTimeFormat = useCallback((value) => {
    setTimeFormatState(value);
    localStorage.setItem("timeFormat", value);
  }, []);

  return (
    <SettingsPage
      timeFormat={timeFormat}
      setTimeFormat={setTimeFormat}
      reverseSort={reverseSort}
      setReverseSort={setReverseSort}
    />
  );
};

export default SettingsRoute;
