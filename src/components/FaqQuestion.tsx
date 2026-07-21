import { useState } from 'react'
import type { FaqItem } from '../types'

export function FaqQuestion({ item }: { item: FaqItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="faq-item">
      <button
        type="button"
        className="faq-question"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {item.question}
        <span className="faq-chevron" aria-hidden="true" />
      </button>
      {expanded && <p className="faq-answer">{item.answer}</p>}
    </div>
  )
}
