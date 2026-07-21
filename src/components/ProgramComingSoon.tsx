import type { LineupArtist, NewsItem } from '../types'
import lineupData from '../data/lineup.json'
import newsData from '../data/news.json'

const lineup = lineupData as LineupArtist[]
const news = newsData as NewsItem[]

const WAVE_LABEL: Record<string, string> = {
  '1': '1ʳᵉ vague',
  '2': '2ᵉ vague',
  '3': '3ᵉ vague',
  autres: 'Autres artistes annoncés',
}

function groupByWave(artists: LineupArtist[]) {
  const groups = new Map<string, LineupArtist[]>()
  for (const artist of artists) {
    const key = artist.wave ? String(artist.wave) : 'autres'
    groups.set(key, [...(groups.get(key) ?? []), artist])
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === 'autres') return 1
    if (b === 'autres') return -1
    return Number(a) - Number(b)
  })
}

export function ProgramComingSoon() {
  const waves = groupByWave(lineup)

  return (
    <section aria-label="Programme">
      <div className="program-notice">
        <p>
          La grille horaire complète n'est pas encore publiée par l'organisation.
          En attendant, voici les artistes déjà annoncés et les dernières
          actualités du festival.
        </p>
      </div>

      <h2 className="prep-heading">Line-up annoncé</h2>
      <div className="legend">
        {waves.map(([wave, artists], i) => (
          <details key={wave} className="legend-group lineup-group" open={i === 0}>
            <summary>{WAVE_LABEL[wave] ?? wave}</summary>
            <ul className="lineup-list">
              {artists.map((artist) => (
                <li key={artist.id} className="lineup-chip">
                  {artist.name}
                  {artist.genre && <span className="lineup-genre">{artist.genre}</span>}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <h2 className="prep-heading">Actualités</h2>
      <div className="card-list">
        {news.map((item) => (
          <article key={item.id} className="card news-card">
            <span className="pill pill-time">{item.date}</span>
            <h3 className="card-title">{item.title}</h3>
            <p className="card-desc">{item.summary}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
