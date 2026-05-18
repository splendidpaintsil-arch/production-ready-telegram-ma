export function safeErr(err) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || String(err);
}

function cleanMeta(meta = {}) {
  const out = {};
  for (const [key, value] of Object.entries(meta || {})) {
    if (/token|secret|key|authorization/i.test(key)) {
      out[key] = Boolean(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export const log = {
  info(message, meta = {}) {
    console.log(JSON.stringify({ level: "info", message, ...cleanMeta(meta) }));
  },
  warn(message, meta = {}) {
    console.warn(JSON.stringify({ level: "warn", message, ...cleanMeta(meta) }));
  },
  error(message, meta = {}) {
    console.error(JSON.stringify({ level: "error", message, ...cleanMeta(meta) }));
  },
};
