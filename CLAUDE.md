# FDH26 — Fête de l'Humanité (non officiel)

PWA mobile-only (React + Vite + TS), fork de l'app PDJ26 (Les Pluies de Juillet) adapté en **application non officielle de fan** pour la Fête de l'Humanité 2026 (91ᵉ édition, 11–13 septembre 2026, Base aérienne 217, Le Plessis-Pâté). Reprend les mêmes features que PDJ26 : plan du site, programme, timeline de favoris avec groupes de copains, rappels de notification, mes billets, FAQ.

⚠️ **Ni développée ni approuvée par l'organisation de la Fête de l'Humanité** — le nom du festival est repris tel quel mais ce n'est pas un produit officiel ; un rappel explicite est affiché dans la FAQ de l'app (« Cette application est-elle officielle ? »), à ne pas retirer. Le site officiel `fete.humanite.fr` n'a par ailleurs pas pu être consulté directement à la création de ce fork (proxy réseau qui bloquait le domaine) : les infos pratiques, le line-up et les actualités viennent d'articles de presse (JDS, Tsugi, MyFestival...) et peuvent être incomplètes, approximatives ou datées — à recouper avec le site officiel avant toute mise à jour. Le plan du site (`public/map.svg`) est un **schéma original indicatif**, pas une reproduction du plan officiel (qu'on n'a pas).

## Commandes

```bash
npm run dev        # dev server
npm run build      # tsc -b && vite build (+ génération SW/manifest via vite-plugin-pwa)
npm run preview    # sert dist/ en local
npm run lint       # oxlint
npm test           # vitest run (jsdom) — npx vitest run src/lib/schedule.test.ts pour un seul fichier
```

Déploiement : ce fork vit sur une branche du repo `winnieoursbrun/pdj` (pas un repo séparé) ; le workflow `.github/workflows/deploy.yml` ne se déclenche que sur push vers `main`, donc rien ne se déploie automatiquement depuis cette branche. Pour une vraie mise en ligne indépendante, il faudrait un repo (ou au moins un site GitHub Pages) dédié, avec son propre `base` dans `vite.config.ts`. Le build passe `SENTRY_AUTH_TOKEN` en secret pour uploader les source maps (`sentryVitePlugin` dans `vite.config.ts`, projet `fdh-react` — **à créer côté Sentry** avant tout déploiement réel, sans quoi l'upload échoue silencieusement ; no-op si le token est absent, ex. en local).

## Architecture

- `src/App.tsx` — shell : header (+ bouton installation PWA), 5 onglets (Carte, Programme, Ma timeline, Prépa, FAQ), tab bar fixe en bas
- `src/tabs/` — `MapTab` (plan zoomable via react-zoom-pan-pinch + légende), `ProgramTab` (grille jour/catégorie si `events.json` est rempli, sinon bascule sur `ProgramComingSoon` — line-up annoncé + actus), `TimelineTab` (favoris chronologiques), `PrepTab` (compte à rebours, accès, checklist), `FaqTab` (infos pratiques + FAQ appli, accordéons par catégorie)
- `src/hooks/useFavorites.ts` — favoris = `Set<string>` d'ids, persisté en localStorage (`fdh26-favorites`)
- Groupes de copains (timeline partagée sans backend, spec héritée de PDJ26 : `docs/superpowers/specs/2026-07-08-group-timeline-design.md`) : `src/lib/group.ts` (code de groupe `MOT-NN`, dérivation PBKDF2→AES-GCM + tag, chiffrement), `src/lib/nostr.ts` (4 relais Nostr publics, événements remplaçables NIP-78 kind 30078), `src/hooks/useGroup.ts` (état par membre publié chiffré `{name, favorites, updatedAt, at?}`, fusion par union → `friendsByEvent: Map<eventId, {name, here}[]>`, cache localStorage `fdh26-group*`, identité stable par appareil `fdh26-group-sk`), `src/components/GroupPanel.tsx` (créer/rejoindre, QR via `uqr`, lien `#join=CODE` lu dans `App.tsx`). Dans `TimelineTab`, un bouton « Voir les favoris de mes amis » (actif par défaut) fusionne les événements favoris des amis dans la timeline avec leurs pastilles de pseudo. Présence « j'y suis » : en groupe, un bouton (`PresenceButton` dans `src/components/GroupBadges.tsx`) sur les événements en cours (`isEventOngoing` de `schedule.ts`, horloge `src/hooks/useNow.ts`) publie `at` (un seul événement à la fois, persisté `fdh26-group-at`, fenêtre de 15 min avant le début à 15 min après la fin) ; la pastille d'un ami présent (`friend-chip-here`) passe en jaune avec un pin et en tête de liste. Les relais ne voient jamais le code ni les données en clair.
- `src/hooks/useInstallPrompt.ts` — capte `beforeinstallprompt` ; sur iOS affiche un guide manuel
- Rappels de notification : `eventStartDate()` dans `src/lib/schedule.ts` calcule la date calendaire réelle 2026 d'un événement (même règle de bascule après minuit que `timeMinutes()`) ; `src/hooks/useReminders.ts` programme des `setTimeout` locaux (pas de push serveur, PWA 100 % statique) 15 min avant chaque favori, avec rattrapage au retour au premier plan (`visibilitychange`) et dédoublonnage via `fdh26-reminders-notified` ; état `ReminderStatus` (`unsupported`/`default`/`denied`/`enabled`/`disabled`) piloté par `fdh26-reminders-enabled` ; `src/components/ReminderBanner.tsx` (bannière d'incitation dans `TimelineTab`, une seule fois, `fdh26-reminders-prompted`) et `src/components/ReminderToggle.tsx` (interrupteur dans la section "L'application" de `FaqTab`).
- Mes billets (import local du billet festival) : `src/hooks/useTickets.ts` décode le QR code d'une photo importée via `jsqr` (canvas + `getImageData`, redimensionné à 1600px max) puis ne stocke que la valeur texte décodée sous un libellé libre (`{id, label, value}[]`, localStorage `fdh26-tickets`) — la photo elle-même n'est jamais conservée. `src/components/TicketsCard.tsx` (dans `MapTab`, sous la carte du site) gère l'import, le renommage/suppression et l'affichage plein écran d'un QR régénéré via `uqr`.
- `src/lib/schedule.ts` — constantes jours/catégories (vendredi 11, samedi 12, dimanche 13 septembre 2026), tri chronologique
- `src/lib/sentry.ts` — `initSentry()` (tracing + session replay + logs), appelé depuis `main.tsx`. Comptage des utilisateurs : `getDeviceId()` génère un UUID anonyme stable par appareil (localStorage `fdh26-device-id`), attaché via `Sentry.setUser({id})`.
- `src/index.css` — tout le style, CSS vanilla avec design tokens
- `docs/superpowers/{specs,plans}/` — docs de conception héritées de PDJ26 (contexte, architecture, cas limites, plan de tests) ; à consulter avant de retoucher les groupes de copains ou les rappels

## Données

- `src/data/events.json` — **vide (`[]`)** : la grille horaire détaillée n'est pas publiée par l'organisation au moment de ce fork. Dès qu'un programme officiel sort, le remplir avec le même schéma que PDJ26 (`{id, title, artist, day: "ven"|"sam"|"dim", start, end, venue, category, subtype, description, recommendations?, speakers?}`) — `ProgramTab` bascule automatiquement de `ProgramComingSoon` (line-up + actus) vers la grille dès que ce tableau n'est plus vide.
- `src/data/lineup.json` — artistes déjà annoncés en presse (`{id, name, wave: 1|2|3|null, genre}`), affichés groupés par vague dans `ProgramComingSoon`.
- `src/data/news.json` — fil d'actualités (`{id, date, title, summary}`), affiché sous le line-up.
- `src/data/venues.json` — 14 zones du plan schématique (`{num, name, group}`), groupes : programmation, accueil, bienetre, vente. Correspondent aux points numérotés de `public/map.svg`.
- `public/map.svg` — schéma **original et indicatif** (généré, pas une reproduction du plan officiel), avec un bandeau explicite « en attente du plan officiel ». À remplacer dès que le festival publie son vrai plan (regénérer/adapter `venues.json` en conséquence).
- `src/data/faq.json` — infos pratiques reconstituées depuis la presse (dates/lieu, accès, tarifs, camping, programmation) ; la catégorie `Accès & transport` est lue explicitement par `PrepTab.tsx`, ne pas la renommer.
- Adresse codée en dur dans `src/lib/address.ts` (`Base aérienne 217, 91220 Le Plessis-Pâté`) avec lien Maps universel.

Règle de tri importante : les horaires < 05:00 sont la fin de nuit du jour de grille (ex. un set à 00h40 appartient au vendredi) — voir `timeMinutes()` dans `schedule.ts`.

## Design

Identité inspirée de l'imagerie du Front populaire / Fête de l'Humanité : écru `#f2ede2`, rouge `#c8202f`, jaune `#ffd02e`, contours noirs 2px, ombres « sticker » décalées (`--sticker`). Display : Bricolage Grotesque (auto-hébergée via @fontsource, requis pour l'offline). Dark mode via `prefers-color-scheme`. Élément signature : le bouton favori est un **poing levé** qui se lève (`src/components/FistButton.tsx`, classes `.fist-btn`/`.is-raised`) — clin d'œil au geste de solidarité du festival ; ne pas le remplacer par une étoile ou reprendre le parapluie de PDJ26.

L'app doit rester 100 % offline une fois installée : tout asset ajouté doit être précaché (vérifier les `globPatterns` du workbox dans `vite.config.ts`).

## Tests

Les tests qui portaient sur les vrais événements de PDJ26 (`ProgramTab.test.tsx`, `TimelineTab.test.tsx`, `useGroup.test.ts`, `useFavorites.test.ts` pour le test de métrique) mockent désormais `../data/events.json` avec une petite fixture locale (`ouverture-ven-1700`, `massilia-ven-2135`, `nocturne-ven-0040`, `village-sam-1000`...) puisque le vrai fichier est vide. `ProgramComingSoon.test.tsx` couvre l'état "programme pas encore publié" sur les vraies données (line-up/actus).
