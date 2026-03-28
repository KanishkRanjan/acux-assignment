export const getScoreInfo = (ctr: number) => {
  if (ctr > 0.7)
    return { dotClass: "green", textClass: "green", label: "(High Value)" };
  if (ctr < 0.3)
    return { dotClass: "red", textClass: "red", label: "(Low Value)" };
  return { dotClass: "neutral", textClass: "neutral", label: "(Average)" };
};

export const formatId = (id?: string | null) => {
  if (!id) return "#NA";
  return `#${id.substring(0, 4).toUpperCase()}`;
};

export const formatTime = (ts?: string | null) => {
  if (!ts) return "--:--:--";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "--:--:--";
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
};
