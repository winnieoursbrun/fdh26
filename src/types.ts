export type Day = 'ven' | 'sam' | 'dim'

export type Category =
  | 'concert'
  | 'bal'
  | 'spectacle'
  | 'conference'
  | 'atelier'
  | 'imaginarium'
  | 'balade'
  | 'radio'
  | 'famille'

export type VenueGroup = 'programmation' | 'accueil' | 'bienetre' | 'vente'

export interface FestEvent {
  id: string
  title: string
  artist: string | null
  day: Day
  start: string
  end: string | null
  venue: string
  category: Category
  subtype: string | null
  description: string | null
  recommendations?: string[] | null
  speakers?: string[] | null
}

export interface Venue {
  num: number
  name: string
  group: VenueGroup
}

export interface FaqItem {
  id: string
  category: string
  question: string
  answer: string
}

export interface PackingItem {
  id: string
  category: string
  label: string
  hint: string | null
}

export interface LineupArtist {
  id: string
  name: string
  wave: number | null
  genre: string | null
}

export interface NewsItem {
  id: string
  date: string
  title: string
  summary: string
}
