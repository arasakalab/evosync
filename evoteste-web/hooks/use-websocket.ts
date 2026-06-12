"use client";

import { useEffect, useRef, useState } from "react";
import type { WsEvent, WsClientEvent } from "@/lib/types";

export function useWebSocket(onEvent?: (e: WsEvent) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      try {
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          try {
            ws.send(
              JSON.stringify({ type: "subscribe" } satisfies WsClientEvent)
            );
          } catch {
            /* noop */
          }
        };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data) as WsEvent;
            handlerRef.current?.(data);
          } catch {
            /* noop */
          }
        };
        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (!stopped) retry = setTimeout(connect, 1500);
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch {
            /* noop */
          }
        };
      } catch {
        retry = setTimeout(connect, 2000);
      }
    };

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
    };
  }, []);

  return { connected };
}
