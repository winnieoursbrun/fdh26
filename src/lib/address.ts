export const ADDRESS = '290 Route des Diligences, 50800 Champrepus'

// Safari iOS n'a pas de sélecteur d'appli pour geo: — Apple Plans y est la seule
// option qui fonctionne. Partout ailleurs, geo: laisse le téléphone proposer
// son propre choix (Android affiche un sélecteur d'apps installées).
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
export const MAPS_HREF = IS_IOS
  ? `https://maps.apple.com/?q=${encodeURIComponent(ADDRESS)}`
  : `geo:0,0?q=${encodeURIComponent(ADDRESS)}`
