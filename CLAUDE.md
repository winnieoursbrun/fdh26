# PDJ26 — Programme des Pluies de Juillet

PWA mobile-only (React + Vite + TS) du programme du festival Les Pluies de Juillet 2026 (17–19 juillet, Champrepus). Déployée sur GitHub Pages : https://winnieoursbrun.github.io/pdj/

## Commandes

```bash
npm run dev        # dev server
npm run build      # tsc -b && vite build (+ génération SW/manifest via vite-plugin-pwa)
npm run preview    # sert dist/ en local
npm run lint       # oxlint
npm test           # vitest run (jsdom) — npx vitest run src/lib/schedule.test.ts pour un seul fichier
```

Déploiement : push sur `main` → workflow `.github/workflows/deploy.yml` → GitHub Pages (build type "workflow"). Le `base: '/pdj/'` dans `vite.config.ts` doit correspondre au nom du repo. Le build CI passe `SENTRY_AUTH_TOKEN` en secret pour uploader les source maps (`sentryVitePlugin` dans `vite.config.ts`, no-op si le token est absent, ex. en local).

## Architecture

- `src/App.tsx` — shell : header (+ bouton installation PWA), 4 onglets, tab bar fixe en bas
- `src/tabs/` — `MapTab` (plan zoomable via react-zoom-pan-pinch + légende), `ProgramTab` (filtres jour/catégorie), `TimelineTab` (favoris chronologiques), `FaqTab` (infos pratiques + FAQ appli, accordéons par catégorie)
- `src/hooks/useFavorites.ts` — favoris = `Set<string>` d'ids, persisté en localStorage (`pdj26-favorites`)
- Groupes de copains (timeline partagée sans backend, spec : `docs/superpowers/specs/2026-07-08-group-timeline-design.md`) : `src/lib/group.ts` (code de groupe `MOT-NN`, dérivation PBKDF2→AES-GCM + tag, chiffrement), `src/lib/nostr.ts` (4 relais Nostr publics, événements remplaçables NIP-78 kind 30078), `src/hooks/useGroup.ts` (état par membre publié chiffré `{name, favorites, updatedAt, at?}`, fusion par union → `friendsByEvent: Map<eventId, {name, here}[]>`, cache localStorage `pdj26-group*`, identité stable par appareil `pdj26-group-sk`), `src/components/GroupPanel.tsx` (créer/rejoindre, QR via `uqr`, lien `#join=CODE` lu dans `App.tsx`). Dans `TimelineTab`, un bouton « Voir les favoris de mes amis » (actif par défaut) fusionne les événements favoris des amis dans la timeline avec leurs pastilles de pseudo. Présence « j'y suis » : en groupe, un bouton (`PresenceButton` dans `src/components/GroupBadges.tsx`) sur les événements en cours (`isEventOngoing` de `schedule.ts`, horloge `src/hooks/useNow.ts`) publie `at` (un seul événement à la fois, persisté `pdj26-group-at`, fenêtre de 15 min avant le début à 15 min après la fin) ; la pastille d'un ami présent (`friend-chip-here`) passe en jaune avec un pin et en tête de liste. Les relais ne voient jamais le code ni les données en clair.
- `src/hooks/useInstallPrompt.ts` — capte `beforeinstallprompt` ; sur iOS affiche un guide manuel
- Rappels de notification (spec : `docs/superpowers/specs/2026-07-08-event-reminders-design.md`) : `eventStartDate()` dans `src/lib/schedule.ts` calcule la date calendaire réelle 2026 d'un événement (même règle de bascule après minuit que `timeMinutes()`) ; `src/hooks/useReminders.ts` programme des `setTimeout` locaux (pas de push serveur, PWA 100 % statique) 15 min avant chaque favori, avec rattrapage au retour au premier plan (`visibilitychange`) et dédoublonnage via `pdj26-reminders-notified` ; état `ReminderStatus` (`unsupported`/`default`/`denied`/`enabled`/`disabled`) piloté par `pdj26-reminders-enabled` ; `src/components/ReminderBanner.tsx` (bannière d'incitation dans `TimelineTab`, une seule fois, `pdj26-reminders-prompted`) et `src/components/ReminderToggle.tsx` (interrupteur dans la section "L'application" de `FaqTab`).
- Mes billets (import local du billet festival) : `src/hooks/useTickets.ts` décode le QR code d'une photo importée via `jsqr` (canvas + `getImageData`, redimensionné à 1600px max) puis ne stocke que la valeur texte décodée sous un libellé libre (`{id, label, value}[]`, localStorage `pdj26-tickets`) — la photo elle-même n'est jamais conservée. Plusieurs billets peuvent être importés (festival, camping...). `src/components/TicketsCard.tsx` (dans `MapTab`, sous la carte du site) gère l'import, le renommage/suppression (via `prompt`/`confirm`) et l'affichage plein écran d'un QR régénéré proprement via `uqr` (déjà utilisé par `GroupPanel`).
- `src/lib/schedule.ts` — constantes jours/catégories, tri chronologique
- `src/lib/sentry.ts` — `initSentry()` (tracing + session replay + logs), appelé depuis `main.tsx` ; `useReminders` envoie aussi des compteurs `Sentry.metrics.count('reminders.*')`. Comptage des utilisateurs : `getDeviceId()` génère un UUID anonyme stable par appareil (localStorage `pdj26-device-id`, aucune donnée personnelle), attaché via `Sentry.setUser({id})` — les utilisateurs uniques se lisent dans Sentry (sessions/release health, ou `count_unique(user)` dans Explore) ; chaque lancement émet aussi `Sentry.metrics.count('app.open')` avec l'attribut `display_mode` (`standalone` = PWA installée vs `browser`)
- `src/index.css` — tout le style, CSS vanilla avec design tokens
- `docs/superpowers/{specs,plans}/` — docs de conception (contexte, architecture, cas limites, plan de tests) écrites avant les features non triviales ; à consulter avant de retoucher les groupes de copains ou les rappels, et à imiter pour toute nouvelle feature de cette taille

## Données (source : PDF officiel du programme)

Sources conservées dans `sources/` : `programme.pdf` (PDF officiel 24 pages, téléchargé depuis https://cdn.prod.website-files.com/632afd0e6e467cd2f4ef953f/6a354222a5d8c3d33248c54e_PDJ26%20-%20PROGRAMME.pdf), `programme.txt` (texte extrait par pdftotext — attention : les grilles horaires samedi/dimanche, pages 6–7, sont en paysage et leur texte est brouillé, croiser avec le rendu visuel du PDF), `palette.md` (analyse de l'identité visuelle du programme papier, base des design tokens de `index.css`).

- `src/data/events.json` — 66 événements. Schéma : `{id, title, artist, day: "ven"|"sam"|"dim", start: "HH:MM", end, venue, category, subtype, description, recommendations?, speakers?}`. 9 catégories : concert, bal, spectacle, conference, atelier, imaginarium, balade, radio, famille. `recommendations` (concerts, "tu aimeras si tu aimes") et `speakers` (bios des intervenant·es de conférence) sont optionnels et déjà extraits du PDF pour tous les événements concernés — pas besoin de les régénérer sauf V2 du programme.
- Adresse du site codée en dur dans `MapTab.tsx` (`290 Route des Diligences, 50800 Champrepus`, source p.24 du PDF) avec un lien Google Maps universel (`maps.google.com/...?query=`) — fonctionne sur iOS et Android sans imposer une appli de plans particulière.
- `src/data/venues.json` — les 23 points du plan (`{num, name, group}`), groupes : programmation, accueil, bienetre, vente.
- `public/map.png` — page 3 du PDF rendue en PNG 200 dpi (`pdftoppm`).
- `src/data/faq.json` — infos pratiques du festival en FAQ : `{id, category, question, answer}[]`, extraites des pages 21 (accessibilité/Lieu Sûr), 22 (Transhumance à vélo) et 24 (tarifs, horaires, paiement, camping) du PDF. La section "L'application" (offline, installation, favoris) est codée en dur dans `FaqTab.tsx`, pas dans ce fichier — elle ne dépend pas du PDF.

Règle de tri importante : les horaires < 05:00 sont la fin de nuit du jour de grille (ex. le set de 00h40 appartient au vendredi) — voir `timeMinutes()` dans `schedule.ts`.

Particularités des données : les « Animations surprises » du samedi soir n'ont pas d'horaires publiés ; les stands du village sont classés en catégorie `atelier` (subtype « stands du village »).

Si le festival publie une V2 du PDF : re-parser le PDF (idéalement via subagent), régénérer `events.json`/`venues.json` en respectant le schéma ci-dessus, ré-extraire la carte si elle change (`pdftoppm -png -f 3 -l 3 -r 200`), push.

## Design

Identité reprise du programme papier : écru `#f2ede2`, rose `#f49bc1`, jaune `#ffd02e`, contours noirs 2px, ombres « sticker » décalées (`--sticker`). Display : Bricolage Grotesque (auto-hébergée via @fontsource, requis pour l'offline). Dark mode via `prefers-color-scheme`. Élément signature : le bouton favori est un parapluie qui s'ouvre — ne pas le remplacer par une étoile.

L'app doit rester 100 % offline une fois installée : tout asset ajouté doit être précaché (vérifier les `globPatterns` du workbox dans `vite.config.ts`).
