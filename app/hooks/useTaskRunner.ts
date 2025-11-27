import { read } from "fs";
import { useState, useRef, useCallback } from "react";


export type TaskState = 'idle' | 'running' | 'open' | 'closed';

export type ChatCallback = (
  data: string | null,
  status: TaskState | null,
  error: Error | null
) => void;

export type CancelChat = { cancel: () => void };


export function handleChatRequest(
  question: String,
  callback: ChatCallback
): CancelChat | null {
  if (!question.trim()) return null;

  const controller = new AbortController();
  const { signal } = controller;

  fetch("http://localhost:8000/api/v1/llm-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // 检查 Content-Type 是否为 event-stream (可选，但推荐)
      if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        throw new Error(`Unexpected Content-Type: ${response.headers.get('content-type')}`);
      }

      callback(null, 'open', null);

      if (!response.body) {
        throw new Error(`Empty response from server.`);
      }

      handleStreamBody(response.body, callback, signal);
    })
    .catch(error => {
      console.log(error);
      callback(null, 'closed', error);
    });

  return {
    cancel: () => controller.abort()
  };
}


async function handleStreamBody(
  stream: ReadableStream<Uint8Array>,
  callback: ChatCallback,
  abortSignal: AbortSignal
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder();

  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || abortSignal.aborted) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      events.forEach(e => {
        const lines = e.trim().split('\n');
        let data = null;

        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            data = line.slice(6);
            if ('[DONE]' === data.trim()) {
              callback(data, 'closed', null);
              return;
            } else {
              data = decodeURIComponent(data);
              callback(data, 'running', null);
            }
          }
        })
      });
    }
  }
  catch (e) {
    if (!abortSignal.aborted) {
      console.error("Error reading stream:", e);
      callback(null, 'closed', e as Error);
    }
  } finally {
    reader.releaseLock();
    callback(null, 'closed', null);
  }
}
