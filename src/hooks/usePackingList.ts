import { useCallback, useState } from 'react'

const STORAGE_KEY = 'fdh26-packing'

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function usePackingList() {
  const [checked, setChecked] = useState<Set<string>>(load)

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  return { checked, toggle }
}
