export type Day = 'ven' | 'sam' | 'dim'

// The official programme publishes the category of every event; these eight
// keys map one-to-one onto the "programmes" of the festival's own schedule.
export type Category =
  | 'concert'
  | 'spectacle'
  | 'debat'
  | 'conference'
  | 'cinema'
  | 'evenement'
  | 'exposition'
  | 'atelier'

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
  // Illustration published alongside the event, precached under /events/.
  image?: string | null
  // Photo credit the festival attaches to the illustration, when there is one.
  copyright?: string | null
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
