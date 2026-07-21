import type { FaqItem } from '../types'
import type { ReminderStatus } from '../hooks/useReminders'
import { FaqQuestion } from '../components/FaqQuestion'
import { ReminderToggle } from '../components/ReminderToggle'
import faqData from '../data/faq.json'

const faq = faqData as FaqItem[]

const APP_FAQ: FaqItem[] = [
  {
    id: 'app-hors-ligne',
    question: "L'appli fonctionne-t-elle sans connexion ?",
    category: "L'application",
    answer:
      "Oui. Une fois que tu as ouvert l'appli au moins une fois, la carte, le programme et cette FAQ restent disponibles hors-ligne — pratique si le réseau sature sur le site.",
  },
  {
    id: 'app-installation',
    question: "Comment installer l'appli sur mon téléphone ?",
    category: "L'application",
    answer:
      "Un bouton « Installer » apparaît en haut de l'écran quand c'est possible. Sur iPhone, utilise le bouton Partager de Safari puis « Sur l'écran d'accueil ».",
  },
  {
    id: 'app-favoris',
    question: 'Mes favoris sont-ils sauvegardés ?',
    category: "L'application",
    answer:
      "Oui, ils restent enregistrés sur ton téléphone tant que tu ne les retires pas ou que tu ne vides pas les données du navigateur. Aucun compte n'est nécessaire.",
  },
  {
    id: 'app-mise-a-jour',
    question: 'Le programme peut-il encore changer ?',
    category: "L'application",
    answer:
      'En cas de changement de dernière minute, consulte fete.humanite.fr pour les infos les plus à jour.',
  },
]

const ALL_ITEMS = [...faq, ...APP_FAQ]
const CATEGORIES = [...new Set(ALL_ITEMS.map((item) => item.category))]

interface FaqTabProps {
  reminderStatus: ReminderStatus
  onEnableReminders: () => void
  onDisableReminders: () => void
}

export function FaqTab({ reminderStatus, onEnableReminders, onDisableReminders }: FaqTabProps) {
  return (
    <section aria-label="FAQ et infos pratiques">
      <div className="legend">
        {CATEGORIES.map((category, i) => (
          <details key={category} className="legend-group faq-group" open={i === 0}>
            <summary>{category}</summary>
            <div className="faq-list">
              {ALL_ITEMS.filter((item) => item.category === category).map((item) => (
                <FaqQuestion key={item.id} item={item} />
              ))}
            </div>
            {category === "L'application" && (
              <ReminderToggle
                status={reminderStatus}
                enable={onEnableReminders}
                disable={onDisableReminders}
              />
            )}
          </details>
        ))}
      </div>
    </section>
  )
}
