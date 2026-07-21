# Groupes d'amis — timeline partagée sans backend

Date : 2026-07-08

## Contexte et objectif

Partager sa timeline de favoris avec un groupe de copains : voir qui va à quoi en overlay sur le programme, et retrouver dans sa propre timeline les événements que ses amis ont mis en favori. PDJ est une PWA 100 % statique (GitHub Pages, aucun backend) : la synchro passe par des **relais Nostr publics** utilisés comme boîte aux lettres chiffrée (NIP-78, *Arbitrary custom app data*).

Itération V1 → V1.1 : la première version incluait un marquage « on y va ensemble » par événement (bouton + compteur). Retiré : l'utilisateur préférait retrouver directement dans « Ma timeline » les événements favoris de ses amis (avec un bouton pour les masquer/afficher), plutôt qu'un marquage séparé — les pastilles de pseudos suffisent à voir qui y va.

Itération V1.2 — présence « j'y suis » (2026-07-18) : pendant le festival, un membre peut signaler au groupe qu'il est **sur l'événement en cours** (un seul à la fois). Un bouton « J'y suis » apparaît sur les événements en cours (Programme et Ma timeline) quand on est en groupe ; la pastille de l'ami présent change d'aspect (jaune, ombre sticker, pin 📍, listée en premier) pour dire où il est. Retour terrain : fenêtre élargie de **15 min avant le début à 15 min après la fin** (on est souvent déjà installé devant la scène, ou encore sur place à la sortie) ; au-delà, la présence expire d'elle-même, côté émetteur comme côté lecteurs.

Alternatives écartées :
- **P2P WebRTC (Trystero, y-webrtc)** : exige deux téléphones en ligne simultanément, app au premier plan (iOS coupe WebRTC en arrière-plan) — rendez-vous improbables avec le réseau intermittent du festival.
- **Service hébergé gratuit (Firebase…)** : backend déguisé, quotas, clés API dans le client.

Le relais donne du **store-and-forward** : un téléphone seul en ligne quelques secondes dépose son état et ramasse celui des autres. L'état de tous est ensuite en cache local chez tous → l'overlay marche offline.

## Limites assumées

- Dépendance à la bonne volonté de relais publics bénévoles → 4 relais en parallèle, un seul suffit.
- Code de groupe court (`MOT-NN`, ~2 M de combinaisons) devinable par force brute → acceptable : payloads chiffrés, enjeu = favoris de festival.
- Pas de gestion de membres (kick/admin) en V1 ; quitter le groupe publie un tombstone best-effort (voir plus bas) mais ne peut pas forcer les autres à le recevoir hors-ligne.
- Un seul groupe à la fois en V1.

## Modèle de données

- **Identité** : paire de clés Nostr générée localement (`generateSecretKey`), jamais montrée à l'utilisateur. Pseudo choisi à la création/jonction.
- **Code de groupe** : `MOT-NN` (wordlist française ~200 mots + 2 chiffres), ex. `AVERSE-42`. Dérivations WebCrypto :
  - clé AES-GCM 256 = PBKDF2(code, salt `"pdj26-group-v1"`, 100 000 itérations, SHA-256) ;
  - tag de filtrage = hex(SHA-256(code + `"pdj26-tag-v1"`)).slice(0, 32). Les relais ne voient ni le code ni les données en clair.
- **État par membre** (payload chiffré) : `{ name, favorites: string[], updatedAt, at?: string, left?: boolean }`. Chacun ne publie que son propre document → fusion = union, zéro conflit. `at` est l'id de l'événement où le membre se trouve en ce moment (au plus un) ; il n'est pris en compte à la lecture que si l'événement est effectivement en cours (`isEventOngoing` : de 15 min avant le début à 15 min après la fin, durée d'1 h pour les événements sans horaire de fin). `left: true` est un tombstone : publié une seule fois au moment de quitter le groupe, il signale aux autres de purger ce membre au lieu de fusionner son état.
- **Événement Nostr** : kind 30078 (remplaçable paramétré), tags `[["d", groupTag]]`, content = base64(IV ‖ ciphertext). Le relais ne garde que la dernière version par (pubkey, kind, d).

## Architecture

- `src/lib/group.ts` — wordlist, `generateGroupCode()`, `normalizeCode()`, `deriveGroupKeys(code)`, `encryptState()`/`decryptState()`.
- `src/lib/nostr.ts` — `RELAYS` (relay.damus.io, nos.lol, relay.nostr.band, offchain.pub), `publishState()`, `subscribeGroup()` via `SimplePool` (imports modulaires `nostr-tools/pure` + `nostr-tools/pool`).
- `src/hooks/useGroup.ts` — hook central instancié dans `App.tsx` :
  - localStorage : `pdj26-group` `{code, name, sk}` ; `pdj26-group-sk` (identité stable de l'appareil) ; `pdj26-group-members` (cache `{[pubkey]: état}`) ; `pdj26-group-at` (ma présence en cours, purgée au chargement si l'événement est passé) ;
  - API : `{ group, others, create(name), join(code, name), leave(), friendsByEvent, myEventId, checkIn(eventId | null) }` — `friendsByEvent` est une `Map<eventId, {name, here}[]>` construite à partir des favoris **et** de la présence `at` de `others` (un ami présent apparaît sur l'événement même s'il ne l'a pas en favori) ; `checkIn` enregistre au plus un événement à la fois (remplacement) ;
  - publication débouncée (~2 s) à chaque changement de favoris/pseudo/présence, + `online` + `visibilitychange` ; réception → déchiffrement → garde le plus récent (`updatedAt`) → cache ; si l'état reçu porte `left: true`, le pubkey est retiré du cache au lieu d'être fusionné (l'ami disparaît de `others` et ses ids sortent de `friendsByEvent`) ;
  - horloge de présence (tick 60 s tant qu'un groupe existe) : fait expirer les `here` des amis à la fin de leur événement et republie mon état sans `at` quand mon événement se termine ;
  - `leave()` publie d'abord, en best-effort, un dernier état `{ ..., left: true }` sur le groupe qu'on quitte (même dérivation de clés), puis efface l'état local (présence comprise) — les autres membres n'appliquent la purge que si un relais était joignable au moment du départ.
- `src/components/GroupPanel.tsx` — en tête de TimelineTab : créer/rejoindre (pseudo + code), groupe actif (code en gros, QR `uqr`, partage `navigator.share` du lien `…/pdj/#join=CODE`, liste des membres, quitter).
- `src/components/GroupBadges.tsx` — `FriendChips` (pastilles des copains, celles avec `here: true` passent en jaune avec un pin et sont listées en premier) et `PresenceButton` (« J'y suis » / « Tu y es », `aria-pressed`). Partagés entre `EventCard` et `TimelineTab`.
- `src/hooks/useNow.ts` — horloge re-rendue toutes les 60 s ; sert à `ProgramTab`/`TimelineTab` pour savoir quels événements sont en cours (`isEventOngoing` dans `schedule.ts`) et donc où afficher le bouton de présence.
- `EventCard` — props optionnelles `friends` (`{name, here}[]`) et `presence` (`{here, onToggle}`, fournie par `ProgramTab` quand on est en groupe et que l'événement est en cours) ; pastilles et bouton sous le lieu, parapluie intouché.
- `TimelineTab` — bouton « Voir les favoris de mes amis » (switch, actif par défaut, persisté dans `pdj26-show-friends-favorites`) visible dès qu'un groupe existe. Quand actif, la liste affichée fusionne mes favoris et les événements favoris de `others` (union des ids) ; chaque événement montre les pastilles des amis qui l'ont favori. Les événements qui ne sont pas dans mes propres favoris sont visuellement distingués (`.tl-item-friend`, contour en pointillés) et leur parapluie reste cliquable pour se les approprier.
- `App.tsx` — lit `#join=CODE` au chargement → onglet timeline, code prérempli, hash nettoyé.

## Gestion des erreurs / cas limites

- Hors ligne : affichage depuis le cache, aucune erreur bloquante, resync à `online`/`visibilitychange`.
- Payload indéchiffrable ou JSON invalide (autre app sur le même kind, corruption) : événement ignoré silencieusement.
- Événement plus vieux que le cache (`updatedAt`) : ignoré.
- Membre retiré de mes favoris/du groupe : l'union se recalcule à l'affichage, rien à invalider.
- Tombstone (`left: true`) reçu plus vieux que le cache pour ce membre (`updatedAt` inférieur) : ignoré, même règle de fraîcheur que les mises à jour normales.
- Présence périmée (l'ami n'a pas pu republier avant de perdre le réseau) : le champ `at` est simplement ignoré à l'affichage dès que l'événement est fini — pas de « il y est encore » à 4 h du matin. Ma propre présence est aussi purgée localement (au chargement et via le tick) si son événement est passé, et `checkIn` sur un id inconnu ou un événement terminé est annulé immédiatement.
- Départ pendant une coupure réseau : le tombstone échoue silencieusement (comme toute publication hors-ligne) ; les autres membres continuent de voir l'ancien état jusqu'à une resynchro ultérieure de la personne partie — limite assumée, pas de mécanisme de rattrapage en V1.

## Tests

- `group.test.ts` : dérivation déterministe (même code → même tag/clé), normalisation (`averse 42` → `AVERSE-42`), roundtrip chiffrement/déchiffrement, échec propre avec une mauvaise clé.
- `useGroup.test.ts` : merge d'états reçus (pool mockée), rejet des payloads corrompus, `friendsByEvent` correct, exclusion de mon propre pubkey, persistance localStorage, remise à zéro au `leave()`, purge d'un ami dont le tombstone `left: true` arrive (et ses favoris disparaissent de `friendsByEvent`), tombstone plus vieux que le cache ignoré, `leave()` publie bien un état `left: true`.
- Présence : `useGroup.test.ts` (checkIn persiste/remplace/efface, purge d'une présence périmée au chargement et au checkIn, `here: true` sur l'événement en cours d'un ami même hors favoris, présence d'ami ignorée une fois l'événement fini, `leave()` efface la présence), `schedule.test.ts` (`isEventOngoing`, fenêtre 1 h sans fin, bascule après minuit), `TimelineTab.test.tsx`/`ProgramTab.test.tsx`/`EventCard.test.tsx` (bouton « J'y suis »/« Tu y es » seulement en groupe et sur un événement en cours, pastille `friend-chip-here`, ami présent listé en premier).
- Manuel : deux navigateurs, créer/rejoindre, favoris croisés, coupure réseau → overlay depuis le cache, lien `#join`, toggle « favoris de mes amis » qui ajoute/retire les événements suggérés de la timeline, « J'y suis » sur un événement en cours → pastille jaune avec pin chez l'autre membre, remplacée quand on pointe un autre événement.
