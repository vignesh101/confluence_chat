import { useRef, useCallback, useEffect } from 'react';
import { WebSocketMessage } from '../types';

interface UseWebSocketOptions {
  onMessage: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (isConnectingRef.current || (wsRef.current?.readyState === WebSocket.OPEN)) {
      return;
    }

    isConnectingRef.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isConnectingRef.current = false;
      options.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        options.onMessage(message);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      isConnectingRef.current = false;
      options.onError?.(error);
    };

    ws.onclose = () => {
      isConnectingRef.current = false;
      wsRef.current = null;
      options.onClose?.();

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current = ws;
  }, [options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const isConnected = useCallback(() => {
    return wsRef.current?.readyState === WebSocket.OPEN;
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    send,
    isConnected,
  };
}
