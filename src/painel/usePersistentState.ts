import { useEffect, useState } from 'react'

/** Estado sincronizado com localStorage (US-13 CA-03/CA-04). */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* armazenamento indisponível — ignora */
    }
  }, [key, value])

  return [value, setValue]
}
