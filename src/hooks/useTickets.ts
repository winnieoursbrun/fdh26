import { useCallback, useState } from 'react'
import jsQR from 'jsqr'

const STORAGE_KEY = 'pdj26-tickets'
const MAX_DECODE_DIMENSION = 1600

export interface Ticket {
  id: string
  label: string
  value: string
}

function load(): Ticket[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Ticket[]
  } catch {
    return []
  }
}

function save(tickets: Ticket[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('lecture impossible'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image invalide'))
    img.src = src
  })
}

// On ne garde jamais la photo : seul le contenu texte du QR code est décodé
// puis stocké, le billet importé (nom, mentions légales...) est jeté après lecture.
export async function decodeQrFromFile(file: File): Promise<string> {
  const dataUrl = await readAsDataURL(file)
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_DECODE_DIMENSION / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('canvas indisponible')
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height)
  if (!result) {
    throw new Error('QR code introuvable dans cette photo')
  }
  return result.data
}

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>(load)

  const add = useCallback((label: string, value: string) => {
    setTickets((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), label, value }]
      save(next)
      return next
    })
  }, [])

  const rename = useCallback((id: string, label: string) => {
    setTickets((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, label } : t))
      save(next)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setTickets((prev) => {
      const next = prev.filter((t) => t.id !== id)
      save(next)
      return next
    })
  }, [])

  return { tickets, add, rename, remove }
}
