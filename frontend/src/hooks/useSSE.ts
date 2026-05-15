import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function useSSE() {
  const { addAlert, setWorkflows } = useStore()
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`${API_BASE}/api/stream`)
      esRef.current = es

      es.onmessage = (e) => {
        if (e.data === '[DONE]') return
        try {
          const event = JSON.parse(e.data)

          if (event.type === 'notification') {
            const n = event.data
            addAlert({
              id: n.id,
              message: `${n.emoji} ${n.title}: ${n.body}`,
              type: n.priority === 'high' ? (n.category === 'profit' ? 'success' : n.category === 'loss' ? 'danger' : 'warning') : 'info',
              timestamp: Date.now(),
              read: false,
            })
          }
        } catch {
          // Ignore parse errors (keepalive pings etc.)
        }
      }

      es.onerror = () => {
        es.close()
        // Reconnect after 5s
        setTimeout(connect, 5000)
      }
    }

    connect()
    return () => { esRef.current?.close() }
  }, [])
}
