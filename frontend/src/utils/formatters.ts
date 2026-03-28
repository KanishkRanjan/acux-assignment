import { logger } from "./logger";

export const getScoreInfo = (ctr: number) => {
  if (typeof ctr !== 'number' || isNaN(ctr)) {
    logger.warn("formatters/getScoreInfo", "SYS_RENDER", "Invoked with an invalid CTR format. Falling back to neutral.", { paramReceived: ctr });
    return { dotClass: "neutral", textClass: "neutral", label: "(Unknown)" };
  }

  if (ctr > 0.7)
    return { dotClass: "green", textClass: "green", label: "(High Value)" };
  if (ctr < 0.3)
    return { dotClass: "red", textClass: "red", label: "(Low Value)" };
  return { dotClass: "neutral", textClass: "neutral", label: "(Average)" };
};

export const formatId = (id?: string | null) => {
  if (!id) {
    logger.warn("formatters/formatId", "SYS_RENDER", "Function invoked with unpopulated or null ID attribute. Defaulting to #NA.");
    return "#NA";
  }
  return `#${id.substring(0, 4).toUpperCase()}`;
};

export const formatTime = (ts?: string | null) => {
  if (!ts) {
    logger.warn("formatters/formatTime", "SYS_RENDER", "Function invoked with empty timestamp segment.");
    return "--:--:--";
  }

  const d = new Date(ts);
  if (isNaN(d.getTime())) {
    logger.warn("formatters/formatTime", "SYS_RENDER", "Failed to deserialize timestamp into JS Date object. Falling back.", { rawReceivedString: ts });
    return "--:--:--";
  }

  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
};
