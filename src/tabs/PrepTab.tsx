import { AddressCard } from '../components/AddressCard'
import { Countdown } from '../components/Countdown'
import { FaqQuestion } from '../components/FaqQuestion'
import { usePackingList } from '../hooks/usePackingList'
import { FESTIVAL_START } from '../lib/schedule'
import type { FaqItem, PackingItem } from '../types'
import faqData from '../data/faq.json'
import packingData from '../data/packing.json'

const faq = faqData as FaqItem[]
const packing = packingData as PackingItem[]

const ACCESS_CATEGORY = 'Accès & transport'
const accessFaq = faq.filter((item) => item.category === ACCESS_CATEGORY)
const PACKING_CATEGORIES = [...new Set(packing.map((item) => item.category))]

export function PrepTab() {
  const { checked, toggle } = usePackingList()

  return (
    <section aria-label="Préparer le festival">
      <Countdown target={FESTIVAL_START} />

      <h2 className="prep-heading">Comment venir</h2>
      <AddressCard />
      <div className="legend">
        <details className="legend-group faq-group" open>
          <summary>{ACCESS_CATEGORY}</summary>
          <div className="faq-list">
            {accessFaq.map((item) => (
              <FaqQuestion key={item.id} item={item} />
            ))}
          </div>
        </details>
      </div>

      <h2 className="prep-heading">Ta liste pour la valise</h2>
      <div className="legend">
        {PACKING_CATEGORIES.map((category, i) => {
          const items = packing.filter((item) => item.category === category)
          const checkedCount = items.filter((item) => checked.has(item.id)).length
          const groupKey = items[0].id.split('-')[0]

          return (
            <details
              key={category}
              className={`legend-group packing-group packing-${groupKey}`}
              open={i === 0}
            >
              <summary>
                {category}
                <span className="packing-count">
                  {checkedCount}/{items.length}
                </span>
              </summary>
              <div className="packing-list">
                {items.map((item) => {
                  const isChecked = checked.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="packing-item"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => toggle(item.id)}
                    >
                      <span
                        className={`packing-checkbox${isChecked ? ' is-checked' : ''}`}
                        aria-hidden="true"
                      />
                      <span className="packing-item-text">
                        <span className={isChecked ? 'is-done' : undefined}>{item.label}</span>
                        {item.hint && <span className="packing-hint">{item.hint}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
