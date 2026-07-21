import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Sans test.globals, l'auto-cleanup de Testing Library ne s'exécute pas.
afterEach(cleanup)

// Absents de jsdom, requis par TimelineTab (auto-scroll) et useInstallPrompt.
Element.prototype.scrollIntoView = () => {}

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia
