import { USER_AGENT } from "./constants";

const DOWNLOAD_TOTAL_MS = 1_200_000;
const DOWNLOAD_IDLE_MS = 120_000;

function wrapStreamWithIdleTimeout(
  body: ReadableStream<Uint8Array>,
  onTimeout: () => void,
  onComplete: () => void
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(onTimeout, DOWNLOAD_IDLE_MS);
  };

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const finish = () => {
    clearIdle();
    onComplete();
  };

  resetIdle();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          controller.close();
          return;
        }
        resetIdle();
        controller.enqueue(value);
      } catch (error) {
        finish();
        controller.error(error);
      }
    },
    cancel(reason) {
      finish();
      return reader.cancel(reason);
    },
  });
}

export function getDownloadStream(url: string): Promise<Response> {
  const controller = new AbortController();
  let totalTimer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => controller.abort(),
    DOWNLOAD_TOTAL_MS
  );

  const clearTotalTimer = () => {
    if (totalTimer) {
      clearTimeout(totalTimer);
      totalTimer = null;
    }
  };

  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok || !response.body) {
        clearTotalTimer();
        return response;
      }

      const timedBody = wrapStreamWithIdleTimeout(
        response.body,
        () => controller.abort(),
        clearTotalTimer
      );

      return new Response(timedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    })
    .catch((error) => {
      clearTotalTimer();
      throw error;
    });
}
