#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenerates src/data/events.json and src/data/venues.json from the official data feed.

The official site (fete.humanite.fr) renders its programme with the Chapito
widget, which pulls everything it knows from a single static JSON file:

    https://static.humanite.chapi.to/data.json

That feed is far richer than the HTML pages this script used to scrape: it
publishes the real category of every event (`programId`), the line-up behind
each slot (`musicGroupsIds`), descriptions, genres, illustration ids and GPS
coordinates for every point of interest on the site.

Usage:
    python3 docs/tools/build_events.py                   # download the live feed
    python3 docs/tools/build_events.py --data feed.json  # reuse a local copy
    python3 docs/tools/build_events.py --save feed.json  # keep the downloaded feed

Event ids are slugs of `title-day-hhmm`, so they move when a slot is
rescheduled -- which drops the matching favourites. Keep that in mind before
regenerating.
"""
import argparse
import collections
import html
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EVENTS_OUT = os.path.join(ROOT, 'src', 'data', 'events.json')
VENUES_OUT = os.path.join(ROOT, 'src', 'data', 'venues.json')
IMAGES_OUT = os.path.join(ROOT, 'docs', 'tools', 'event-images.json')
# Les points relevés sur le terrain (un lieu peut en compter plusieurs) : c'est la
# seule source de coordonnées GPS de l'app, le flux n'étant pas joignable hors ligne.
PLACES_OUT = os.path.join(ROOT, 'src', 'data', 'places.json')

FEED_URL = 'https://static.humanite.chapi.to/data.json'

PARIS = ZoneInfo('Europe/Paris')

# 91st edition: Friday 11 to Sunday 13 September 2026.
DAY_BY_DATE = {'2026-09-11': 'ven', '2026-09-12': 'sam', '2026-09-13': 'dim'}
DAY_INDEX = {'ven': 0, 'sam': 1, 'dim': 2}

# The feed publishes the real category as a `programId`, so nothing has to be
# guessed from the venue any more.
CATEGORY_BY_PROGRAM = {
    '62bc77ad0c502213df928376': 'concert',     # Concerts
    '62bc77e00c502213df928378': 'spectacle',   # Spectacles
    '62bc78190c502213df92837a': 'cinema',      # Cinéma
    '62bc783c0c502213df92837c': 'evenement',   # Évènements
    '62bc78610c502213df92837e': 'debat',       # Débats
    '66d9ed7621241f6717d0a094': 'exposition',  # Exposition
    '66e059a812de986918a3e759': 'atelier',     # Ateliers
    '6a8c727ebe286963750370f5': 'conference',  # Conférences et rencontres
}

# `musicGroupsIds` mixes performers and speakers; the guest type tells them apart.
PERFORMER_TYPES = {
    '62b1831f154fd90ece6ef215',  # Artistes
    '62fbb170be2cbe5bdf5f200b',  # Compagnie
    '69fc9d03efe2a66d9bcdcfe5',  # Humoristes
    '66bb1d64460001238bda1dc5',  # Réalisateur·rice.s
    '66c83c9004c2ca2357eeb149',  # Films
}
SPEAKER_TYPES = {
    '62b1831f154fd90ece6ef219',  # Intervenant.e.s
    '64ff3174f39bac3899132b93',  # Auteur.e.s
}

# Genre families that read well as an event subtitle ("Rap", "Débat"...).
SUBTYPE_GENRE_CATEGORIES = {'Genre de musique', 'Discipline'}
# Campaign topics, surfaced as recommendations rather than as a subtitle.
TOPIC_GENRE_CATEGORIES = {'Sujet'}
# Some village stands tag a dozen topics; a card only has room for a few.
MAX_TOPICS = 4
MAX_SUBTYPES = 2

# Venue groups for the map legend. Stages and villages come from `scenes`; the
# rest is matched on the point-of-interest label. Anything unmatched is a place
# on the site rather than a service, so it joins the stages and villages.
VENUE_GROUP_RULES = [
    (re.compile(r'sanitaire|urinoir', re.I), 'bienetre'),
    (re.compile(r"point d'eau", re.I), 'bienetre'),
    (re.compile(r'pr[ée]vention|escale', re.I), 'bienetre'),
    (re.compile(r'secours|infirmerie', re.I), 'accueil'),
    (re.compile(r'point info|objets trouv|enfants trouv|consigne|pmr|psh', re.I), 'accueil'),
    (re.compile(r'entr[ée]e|parking|navette|taxi', re.I), 'accueil'),
    (re.compile(r'boutique', re.I), 'vente'),
]

# The back office spells a few points of interest by hand, so the same place can
# show up twice ("Uninoirs feminin" / "Urinoirs feminins"). Labels are matched
# accent- and case-insensitively; these fold the leftovers together.
POI_LABEL_ALIASES = {
    'uninoirs feminin': 'Urinoirs féminins',
    'village sport': 'Espace Sport',
    'agora de l humanite': 'Agora',
}


def fr(value):
    """The feed stores translatable fields as {fr, en} -- and sometimes as a plain string."""
    if isinstance(value, dict):
        return value.get('fr') or value.get('en') or ''
    return value or ''


def text_of(fragment):
    """Flattens the rich-text HTML the back office produces into plain text."""
    if not fragment:
        return None
    text = re.sub(r'(?is)<(script|style|head)[^>]*>.*?</\1>', '', fragment)
    text = re.sub(r'(?i)<br\s*/?>', '\n', text)
    text = re.sub(r'(?i)</(p|div|li|h[1-6])>', '\n', text)
    text = re.sub(r'(?i)<li[^>]*>', '- ', text)
    text = re.sub(r'(?s)<[^>]+>', '', text)
    text = html.unescape(text).replace('\xa0', ' ')
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in text.split('\n')]
    text = '\n'.join(line for line in lines if line).strip()
    return text or None


def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    value = re.sub(r'[^a-zA-Z0-9]+', '-', value).strip('-').lower()
    return re.sub(r'-{2,}', '-', value)[:48].strip('-')


def local(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).astimezone(PARIS)


def load_feed(args):
    if args.data:
        return json.load(io.open(args.data, encoding='utf-8'))
    request = urllib.request.Request(FEED_URL, headers={'User-Agent': 'fdh26-build-events'})
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = response.read()
    if args.save:
        io.open(args.save, 'wb').write(raw)
    return json.loads(raw)


def grid_day(event):
    """Returns the app day key for an event.

    `day` is the programme day (midnight or 2 AM local, depending on how the
    slot was entered), which is exactly the grid day we want: a 3:40 AM set is
    filed under the evening it belongs to, not under the next morning.
    """
    return DAY_BY_DATE.get(local(event['day']).strftime('%Y-%m-%d'))


def sort_minutes(time):
    hours, minutes = map(int, time.split(':'))
    # A time before 05:00 is the tail end of the grid day's night: it sorts after 23:59.
    return (hours + 24 if hours < 5 else hours) * 60 + minutes


# --- Speaker extraction ---------------------------------------------------
# The feed has no structured guest list for talks: the line-up is written in
# the description. Three shapes cover almost all of them:
#   "Avec Fabien Roussel, secretaire national du PCF et Patrick Martin..."
#   "Nabil Boukili, depute federal ... ; Despina Sinou, maitresse de..."
#   "Animee par Eugenie Barbezat."
# Parsing is deliberately conservative: a missing name is much better than a
# job title or a media outlet displayed as a speaker.

# "Avec" has to open the description or a sentence; a plain lowercase "avec"
# mid-sentence means something else ("avec des classiques et des nouveautes").
SPEAKER_INTRO = re.compile(r'(?:^|(?<=[.!?\n]) )\s*Avec\s+(.+?)(?:[.!\n]|$)', re.S)

# Moderators, wherever they appear.
SPEAKER_HOST = re.compile(
    r'(?:anim[ée]{1,2}e?|mod[ée]r[ée]e?|pr[ée]sent[ée]e?)\s+par\s+(.+?)(?:[.!\n]|$)', re.I)

SPEAKER_SPLIT = re.compile(r',|;| et | & ')
SPEAKER_PREFIX = re.compile(
    r'^(?:anim[ée]{1,2}e?\s+par|mod[ée]r[ée]e?\s+par|en\s+pr[ée]sence\s+de|par|avec)\s+',
    re.I)

# A name is 2 to 4 capitalised words: "Fabien Roussel", "Katia Aruca Chaple",
# "Pierre-Francois Moreau". A single word is too ambiguous (it would catch
# "Blast" or "Politis"), and job titles start lowercase ("astronaute").
NAME = re.compile(
    r"^(?:[A-ZÀ-ÖØ-Þ][\w'’-]*)(?:[ -](?:[a-zà-öø-þ]{1,3} )?[A-ZÀ-ÖØ-Þ][\w'’-]*){1,3}$")

# Job titles, collectives and organisations are not speakers, however
# name-shaped ("Secretaire Generale" shows up in all-caps guest lists).
NOT_A_PERSON = re.compile(
    r'^(?:les?|la|l\'|des?|du|un|une)\s|\b(?:fondation|association|collectif|comit[ée]|'
    r'syndicat|institut|[ée]ditions?|revue|journal|f[ée]d[ée]ration|union|ligue|parti|'
    r'mouvement|r[ée]daction|magazine|maison|centre|agence|compagnie|cie|groupe|'
    r'conf[ée]d[ée]ration|secr[ée]taire|g[ée]n[ée]rale?s?|pr[ée]sidente?s?|directeur|'
    r'directrice|d[ée]put[ée]e?|s[ée]nateur|s[ée]natrice|maire|professeure?|docteure?|'
    r'avocate?|journaliste|sociologue|[ée]crivaine?|[ée]conomiste|historienne?|'
    r'philosophe|chercheure?|chercheuse|syndicaliste|militante?|porte-parole|'
    r'responsable|coordinateur|coordinatrice|membre|autrice|auteure?|r[ée]alisateur|'
    r'r[ée]alisatrice|com[ée]dienne?|conseill[eè]re?|adjointe?|tr[ée]sori[eè]re?|'
    r'ministre|m[ée]dias?|coop|entrepreneurs?|porte\s?parole)\b',
    re.I)

# "Remy Gerbet de Wikimedia" -> the affiliation is not part of the name.
AFFILIATION_TAIL = re.compile(
    r'\s+(?:de|du|des|d\'|chez|pour)\s+\S.*$', re.I)


# Union roles glued to a name in a few listings ("Sophie BINET SG").
ROLE_SUFFIX = re.compile(r'\s+(?:SG|CGT|CFDT|FO|FSU|PCF|LFI|MEDEF)\b.*$')


def clean_name(fragment):
    fragment = SPEAKER_PREFIX.sub('', fragment.strip()).strip(' \'"“”«»:-')
    fragment = ROLE_SUFFIX.sub('', fragment).strip()
    if not fragment:
        return None
    # Drop a trailing affiliation only if a full name remains in front of it.
    trimmed = AFFILIATION_TAIL.sub('', fragment)
    if NAME.match(trimmed) and len(trimmed.split()) >= 2:
        fragment = trimmed
    if not NAME.match(fragment) or NOT_A_PERSON.search(fragment):
        return None
    return fragment


def names_in(sentence):
    # Affiliations in brackets are not part of the name.
    sentence = re.sub(r'\([^)]*\)?', ' ', sentence)
    return [name for name in (clean_name(f) for f in SPEAKER_SPLIT.split(sentence)) if name]


# Categories whose description announces a guest list. Anywhere else the
# description is prose, and parsing it yields sentences ("Originaires de
# Belfast", "Admire de Cavanna") rather than speakers.
SPEAKER_CATEGORIES = {'debat', 'conference'}


def speakers_from(description, category):
    """Names announced in the description, in order, deduplicated."""
    if not description or category not in SPEAKER_CATEGORIES:
        return []
    names = []
    for sentence in SPEAKER_INTRO.findall(description):
        names.extend(names_in(sentence))
    for sentence in SPEAKER_HOST.findall(description):
        names.extend(names_in(sentence))
    # A line that *opens* on a name is a guest list, not prose.
    for line in description.split('\n'):
        first = SPEAKER_SPLIT.split(line, 1)[0]
        if clean_name(first):
            names.extend(names_in(line))
    return list(dict.fromkeys(names))


def build_events(feed):
    scenes = {s['_id']: fr(s['name']) for s in feed['scenes']}
    groups = {g['_id']: g for g in feed['groups']}
    genres = {g['_id']: g for g in feed['genres']}

    events, ids, skipped = [], collections.Counter(), collections.Counter()
    for raw in feed['events']:
        day = grid_day(raw)
        if not day:
            skipped['hors dates du festival'] += 1
            continue
        category = CATEGORY_BY_PROGRAM.get(raw.get('programId'))
        if not category:
            sys.exit(f"Programme inconnu, catégorie indéterminable : {raw.get('programId')!r}\n"
                     f'Ajoute-le à CATEGORY_BY_PROGRAM dans {__file__}.')

        title = fr(raw['title']).strip()
        start = local(raw['showStartDate'])
        end = None
        if raw.get('showEndDate') and not raw.get('hideEndDate'):
            end = local(raw['showEndDate']).strftime('%H:%M')

        performers, speakers = [], []
        for group_id in raw.get('musicGroupsIds', []):
            group = groups.get(group_id)
            if not group:
                continue
            name = fr(group['name']).strip()
            if not name or name == title:
                continue
            if group.get('typeId') in PERFORMER_TYPES:
                performers.append(name)
            elif group.get('typeId') in SPEAKER_TYPES:
                speakers.append(name)

        # Genres hang off the event, but talks and stands tag their topics on
        # the group instead; take both so debates get their subject matter.
        genre_ids = list(raw.get('genres', []))
        for group_id in raw.get('musicGroupsIds', []):
            genre_ids.extend(groups.get(group_id, {}).get('genres', []))

        subtypes, topics = [], []
        for genre_id in dict.fromkeys(genre_ids):
            genre = genres.get(genre_id)
            if not genre:
                continue
            family = genre.get('category', {})
            family = family.get('name') if isinstance(family, dict) else None
            name = fr(genre['name']).strip()
            if family in SUBTYPE_GENRE_CATEGORIES:
                subtypes.append(name)
            elif family in TOPIC_GENRE_CATEGORIES:
                topics.append(name)

        description = text_of(fr(raw.get('description')))
        if not description:
            # Stands and villages describe themselves once, on the group.
            for group_id in raw.get('musicGroupsIds', []):
                group = groups.get(group_id)
                if group:
                    description = text_of(fr(group.get('description')))
                    if description:
                        break

        event_id = f'{slug(title)}-{day}-{start.strftime("%H%M")}'
        ids[event_id] += 1
        if ids[event_id] > 1:
            # Two slots share a title, a day and a start time (the same show on
            # two stages): keep them apart so favourites stay unambiguous.
            event_id = f'{event_id}-{ids[event_id]}'

        events.append({
            'id': event_id,
            'title': title,
            'artist': ', '.join(dict.fromkeys(performers)) or None,
            'day': day,
            'start': start.strftime('%H:%M'),
            'end': end,
            'venue': scenes.get(raw.get('sceneId')) or "Fête de l'Humanité",
            'category': category,
            'subtype': ', '.join(list(dict.fromkeys(subtypes))[:MAX_SUBTYPES]) or None,
            'description': description,
            'recommendations': list(dict.fromkeys(topics))[:MAX_TOPICS] or None,
            # The feed only tags speakers on stands, never on the talks
            # themselves, so fall back to parsing the description.
            'speakers': (list(dict.fromkeys(speakers))
                         or speakers_from(description, category)) or None,
            'image': raw.get('image') or None,
            'copyright': raw.get('copyright') or None,
        })

    events.sort(key=lambda e: (DAY_INDEX[e['day']], sort_minutes(e['start']), e['title']))
    return events, skipped


def venue_group(label, is_scene):
    if is_scene:
        return 'programmation'
    for pattern, group in VENUE_GROUP_RULES:
        if pattern.search(label):
            return group
    return 'programmation'


def fold(label):
    """Accent- and case-insensitive key, used to spot two spellings of one place."""
    plain = unicodedata.normalize('NFKD', label).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', ' ', plain.lower()).strip()


def build_venues(feed, events):
    """Turns the geolocated points of interest into the map legend.

    Identical labels (six sets of toilets, seven water points...) share a
    single legend entry -- and therefore a single number, repeated on the map.
    """
    scenes = {s['_id']: s for s in feed['scenes']}
    programmed = {e['venue'] for e in events}
    # An event card's venue has to be findable in the legend, so the name the
    # programme uses always wins over the one hand-typed on the map point.
    by_scene_name = {fold(fr(s['name'])): fr(s['name']).strip() for s in feed['scenes']}
    scene_weight = {fold(fr(s['name'])): s.get('weight', 0) for s in feed['scenes']}

    entries, coords = {}, collections.defaultdict(list)
    for poi in feed['poiList']:
        scene = scenes.get(poi.get('entityId')) if poi.get('entityType') == 'SCENE' else None
        name = fr(scene['name']).strip() if scene else fr(poi['label']).strip()
        if not name:
            continue
        name = POI_LABEL_ALIASES.get(fold(name), name)
        # Points of interest label stages loosely ("Espace sport" for the
        # programme's "Espace Sport"): fold them back onto the stage.
        name = by_scene_name.get(fold(name), name)
        key = fold(name)
        entries.setdefault(key, {
            'name': name,
            'group': venue_group(name, key in by_scene_name),
            'weight': scene_weight.get(key, 0),
        })
        coords[key].append((float(poi['coords']['lat']), float(poi['coords']['lng'])))

    # Stages with a programme but no point on the map still belong in the legend.
    for scene in sorted(feed['scenes'], key=lambda s: -s.get('weight', 0)):
        name = fr(scene['name']).strip()
        if name in programmed and fold(name) not in entries:
            entries[fold(name)] = {'name': name, 'group': 'programmation',
                                   'weight': scene.get('weight', 0)}

    order = {'programmation': 0, 'accueil': 1, 'bienetre': 2, 'vente': 3}
    ranked = sorted(entries.values(), key=lambda v: (order[v['group']], -v['weight'], v['name']))

    venues, placements = [], []
    for num, entry in enumerate(ranked, start=1):
        venues.append({'num': num, 'name': entry['name'], 'group': entry['group']})
        for lat, lng in coords[fold(entry['name'])]:
            placements.append({'num': num, 'name': entry['name'], 'group': entry['group'],
                               'lat': lat, 'lng': lng})
    return venues, placements


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--data', help='local copy of the feed instead of downloading it')
    parser.add_argument('--save', help='write the downloaded feed to this path')
    args = parser.parse_args()

    feed = load_feed(args)
    events, skipped = build_events(feed)
    venues, placements = build_venues(feed, events)

    io.open(EVENTS_OUT, 'w', encoding='utf-8').write(
        json.dumps(events, ensure_ascii=False, indent=2) + '\n')
    io.open(VENUES_OUT, 'w', encoding='utf-8').write(
        json.dumps(venues, ensure_ascii=False, indent=2) + '\n')
    io.open(IMAGES_OUT, 'w', encoding='utf-8').write(json.dumps(
        sorted({e['image'] for e in events if e['image']}), ensure_ascii=False, indent=2) + '\n')
    io.open(PLACES_OUT, 'w', encoding='utf-8').write(
        json.dumps(placements, ensure_ascii=False, indent=2) + '\n')

    per_day = collections.Counter(e['day'] for e in events)
    per_category = collections.Counter(e['category'] for e in events)
    print(f'{len(events)} événements -> {os.path.relpath(EVENTS_OUT, ROOT)}')
    print('  par jour     : ' + ', '.join(f'{d}={per_day[d]}' for d in DAY_INDEX))
    print('  par catégorie: ' + ', '.join(f'{c}={n}' for c, n in per_category.most_common()))
    print(f'{len(venues)} lieux ({len(placements)} points relevés) -> '
          f'{os.path.relpath(VENUES_OUT, ROOT)} + {os.path.relpath(PLACES_OUT, ROOT)}')
    for reason, count in skipped.items():
        print(f'  ignorés ({reason}) : {count}', file=sys.stderr)


if __name__ == '__main__':
    main()
