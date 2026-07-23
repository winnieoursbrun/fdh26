// Retour haptique léger sur les boutons clés (favori, présence).
//
// Deux mécanismes complémentaires selon la plateforme, appelés tous les deux
// à chaque déclenchement (l'un est no-op là où l'autre marche) :
//   - Vibration API (Android / Chrome…) : `navigator.vibrate()`.
//   - iOS Safari, qui n'expose pas la Vibration API : le hack du `<label>`
//     relié à un `<input type="checkbox" switch>`. Basculer ce switch via un
//     clic programmatique provoque le petit tick haptique système (iOS 17.4+).
//     C'est exactement ce qu'encapsule la lib `use-haptic` ; on le fait ici en
//     vanilla pour rester maîtres du code et 100 % offline (aucune dépendance).

let switchLabel: HTMLLabelElement | null = null

function ensureSwitch(): HTMLLabelElement | null {
  if (typeof document === 'undefined') return null
  if (switchLabel?.isConnected) return switchLabel

  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  // Hors flux et invisible, mais pas `display:none` (le switch doit rester
  // « cliquable » pour que le tick se déclenche).
  Object.assign(label.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>)

  const input = document.createElement('input')
  input.type = 'checkbox'
  // Attribut WebKit qui transforme la case en interrupteur haptique.
  input.setAttribute('switch', '')
  input.tabIndex = -1

  label.appendChild(input)
  document.body.appendChild(label)
  switchLabel = label
  return label
}

/**
 * Déclenche un retour haptique bref. Silencieux et sans effet là où rien n'est
 * supporté (desktop, jsdom…). `pattern` n'est utilisé que par la Vibration API.
 */
export function triggerHaptic(pattern: number | number[] = 10): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      // Certains navigateurs jettent hors d'un geste utilisateur : on ignore.
    }
  }
  // Cliquer le label bascule le switch : chaque clic produit un tick sur iOS.
  ensureSwitch()?.click()
}
