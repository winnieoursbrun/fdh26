# Rappels de notification pour la timeline

Date : 2026-07-08

## Contexte et objectif

L'utilisateur veut être prévenu avant le début des événements qu'il a ajoutés à sa timeline (favoris). PDJ est une PWA 100 % statique et offline (GitHub Pages, aucun backend, `vite-plugin-pwa` en mode `generateSW`). Cette contrainte écarte d'office les vraies notifications push (qui nécessitent un serveur déclenchant l'envoi) : la solution retenue est un rappel **local**, programmé côté client, sans infrastructure serveur.

## Limites assumées

- Les rappels ne survivent pas à une fermeture complète et prolongée de l'app (le navigateur/l'OS tue les timers JS). Ils fonctionnent tant que l'app reste ouverte ou récemment mise en arrière-plan.
- Sur iOS, l'API de notification n'est utilisable que si la PWA est installée sur l'écran d'accueil (iOS 16.4+) ; en navigation Safari classique elle est indisponible.
- Le délai de rappel est fixe : 15 minutes avant le début de l'événement (pas de réglage configurable dans cette version).

## Architecture

### `eventStartDate(e)` — `src/lib/schedule.ts`

Nouvelle fonction qui calcule la vraie date/heure calendaire 2026 d'un événement, à partir de :
- `DAYS` (déjà présent) pour mapper `day` → date du mois (17/18/19 juillet) ;
- la règle déjà en place dans `timeMinutes()` : une heure de début `< 05:00` appartient à la nuit du jour de grille précédent, donc `+1` jour calendaire réel.

Retourne un objet `Date` utilisable pour calculer un délai `setTimeout` précis.

### `useReminders(favoriteEvents)` — nouveau hook `src/hooks/useReminders.ts`

Combine réglage et programmation des rappels.

État persisté en `localStorage` :
- `pdj26-reminders-enabled` (bool) — rappels activés par l'utilisateur.
- `pdj26-reminders-prompted` (bool) — la bannière d'incitation a déjà été vue (acceptée, refusée ou fermée).
- `pdj26-reminders-notified` (tableau d'ids) — événements déjà notifiés, pour éviter les doublons lors des reprogrammations.

API exposée :
```ts
{
  status: 'unsupported' | 'default' | 'denied' | 'enabled' | 'disabled',
  enable: () => void,   // demande la permission navigateur si besoin, puis active
  disable: () => void,
}
```

Chaque activation réussie (permission déjà accordée ou tout juste obtenue, y compris à chaque réactivation après un `disable()`) déclenche une notification de confirmation immédiate (« Rappels activés ») pour donner un retour visible à l'utilisateur·ice.

- `unsupported` : `Notification` absent de l'environnement (ex. Safari iOS hors installation).
- `default` : permission navigateur pas encore demandée.
- `denied` : permission refusée par le navigateur/l'utilisateur.
- `enabled` / `disabled` : permission accordée, rappels actifs ou mis en pause par l'utilisateur.

Comportement de programmation, actif uniquement quand `status === 'enabled'` :
- Un `useEffect` dépendant de la liste des favoris (re)programme tous les timers à chaque changement.
- Pour chaque événement favori dont `notifyAt = eventStartDate(e) - 15min` est dans le futur : `setTimeout` jusqu'à `notifyAt`, qui déclenche `new Notification(titre, { body: "<heure> · <lieu>" })`. Un clic sur la notification fait `window.focus()`.
- Rattrapage : si `notifyAt <= now < eventStartDate(e)` (l'app était fermée/en arrière-plan pendant la fenêtre de rappel), la notification part immédiatement à la reprogrammation, à condition que l'id ne soit pas déjà dans `pdj26-reminders-notified`.
- Si `now >= eventStartDate(e)` (événement déjà commencé), aucun rappel n'est programmé ni affiché.
- Un événement notifié voit son id ajouté à `pdj26-reminders-notified` pour ne jamais redéclencher.
- Un écouteur `visibilitychange` relance la reprogrammation quand l'onglet redevient visible, pour couvrir le rattrapage et compenser le throttling des timers en arrière-plan sur mobile.
- Au démontage / à chaque reprogrammation, tous les timers précédemment posés sont annulés (`clearTimeout`) avant d'en reposer de nouveaux, pour éviter les doublons.

### `ReminderBanner` — nouveau composant `src/components/ReminderBanner.tsx`

- Affiché en haut de `TimelineTab` quand `favorites.size === 1` (premier favori ajouté) et `status` du hook est `default` (jamais proposé, permission pas encore demandée) et `pdj26-reminders-prompted` est faux.
- Contenu : court texte incitatif + bouton "Activer les rappels" (appelle `enable()`) + croix de fermeture.
- Dans les deux cas (activation ou fermeture), `pdj26-reminders-prompted` passe à `true` et la bannière ne réapparaît plus.

### Toggle dans `FaqTab`

Dans la section codée en dur "L'application" (déjà existante, à côté des infos offline/installation) :
- Un interrupteur lié à `status`/`enable()`/`disable()` de `useReminders`.
- Si `status === 'denied'` : interrupteur désactivé + texte expliquant qu'il faut réautoriser les notifications depuis les réglages du navigateur/téléphone.
- Si `status === 'unsupported'` : interrupteur désactivé + texte invitant à installer l'app sur l'écran d'accueil (renvoie implicitement à la logique déjà expliquée par `useInstallPrompt`/le guide iOS existant).

### Câblage dans `App.tsx`

- `App.tsx` instancie `useReminders(mesFavoris)` une fois (comme il le fait déjà pour `useFavorites`), en dérivant la liste des `FestEvent` favoris à partir de `favorites` (même logique de filtre que dans `TimelineTab`).
- Le résultat du hook (`status`, `enable`, `disable`) est passé en props à `TimelineTab` (pour la bannière) et à `FaqTab` (pour le toggle).

## Gestion des erreurs / cas limites

- `Notification` non supporté → `status: 'unsupported'`, aucune tentative d'appel à l'API, bannière jamais affichée.
- Permission refusée par le navigateur → `status: 'denied'`, pas de nouvelle tentative automatique de `requestPermission()` (ça ne redéclenche pas de popup de toute façon dans la plupart des navigateurs) ; le toggle FAQ explique la marche à suivre.
- Favori retiré de la timeline avant son rappel → le prochain passage du `useEffect` de programmation (déclenché par le changement de `favoriteEvents`) annule et ne reprogramme pas de timer pour cet id.
- Festival sur plusieurs jours avec horaires après minuit → couvert par `eventStartDate()` qui applique la même règle de bascule que `timeMinutes()`.

## Tests

- Test unitaire de `eventStartDate()` : cas horaire normal (ex. 21:00 samedi) et cas après-minuit (ex. 00:40 → nuit de vendredi à samedi, donc date du 18 juillet).
- Test du hook `useReminders` (avec `Notification` et timers mockés) : programmation correcte des délais, rattrapage quand `notifyAt` est déjà passé, pas de doublon via `pdj26-reminders-notified`, annulation des timers quand un favori est retiré.
- Vérification manuelle en navigateur (permission, réception de la notification, clic → focus) — pas automatisable simplement en CI.
