import { useRef } from 'react'

const TAP_WINDOW_MS = 2000

export function useSecretTap(onUnlock: () => void, requiredTaps = 5) {
  const countRef = useRef(0)
  const lastTapRef = useRef(0)

  return function handleTap() {
    const now = Date.now()
    if (now - lastTapRef.current > TAP_WINDOW_MS) {
      countRef.current = 0
    }
    lastTapRef.current = now
    countRef.current += 1

    if (countRef.current >= requiredTaps) {
      countRef.current = 0
      onUnlock()
    }
  }
}
