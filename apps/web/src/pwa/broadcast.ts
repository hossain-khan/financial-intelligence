import type { BroadcastPort, PwaBroadcastMessage } from "./lifecycle";

const CHANNEL_NAME = "financial-intelligence-pwa";

/**
 * BroadcastChannel-backed cross-tab coordination. Falls back to a no-op port when the API is
 * unavailable (older Safari), so single-tab behavior is unaffected and multi-tab coordination simply
 * degrades to each tab deciding independently.
 */
export function createBroadcastPort(): BroadcastPort {
  if (typeof BroadcastChannel === "undefined") {
    return { post: () => undefined, subscribe: () => () => undefined };
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    post: (message) => channel.postMessage(message),
    subscribe: (listener) => {
      const handler = (event: MessageEvent<unknown>) => {
        const message = parseMessage(event.data);
        if (message !== undefined) listener(message);
      };
      channel.addEventListener("message", handler);
      return () => channel.removeEventListener("message", handler);
    },
  };
}

function parseMessage(data: unknown): PwaBroadcastMessage | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.buildId !== "string") return undefined;
  if (record.type === "reload-required" || record.type === "update-available") {
    return { type: record.type, buildId: record.buildId };
  }
  return undefined;
}
