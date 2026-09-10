#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convertit les pages « Programme complet » du site officiel en src/data/events.json.

Usage :
    python3 docs/tools/build_events.py page-ven.html page-sam.html page-dim.html

Enregistrer une page par jour depuis
https://fete.humanite.fr/blog/programme-complet/?date=2026-09-1X
(Ctrl+S, « page complète » ou « HTML seul »), puis passer les fichiers en argument.
Le script est idempotent : les cartes en double (le site en publie parfois) et les
pages d'un même jour fournies deux fois sont dédoublonnées.
"""
import argparse, collections, html, io, json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'src', 'data', 'events.json')

DAY_BY_DATE = {'2026-09-11': 'ven', '2026-09-12': 'sam', '2026-09-13': 'dim'}

# Chaque événement est un <a> vers sa fiche, contenant titre / créneau / lieu.
CARD = re.compile(
    r'<a href="https://fete\.humanite\.fr/blog/programme-complet/\?date=(\d{4}-\d{2}-\d{2})&amp;event=([0-9a-f]+)"'
    r'.*?font-weight: bold; font-size: 1em; margin-bottom: 4px;">(.*?)</div>'
    r'<div style="font-size: 0\.85em;">(.*?)</div>'
    r'<div style="font-size: 0\.85em;">(.*?)</div>',
    re.S)

SLOT = re.compile(
    r'^(?:Vendredi|Samedi|Dimanche)\s+\d{1,2}\s+Septembre\s+(\d{2}:\d{2})(?:\s*>\s*(\d{2}:\d{2}))?\s*$')

# Les lieux de la Fête sont thématiques : la catégorie de l'app s'en déduit.
# (Le programme officiel n'expose pas la catégorie dans la carte d'événement.)
VENUE_CATEGORY = {
    'Scène Angela Davis': 'concert',
    'Scène Joséphine Baker': 'concert',
    'Scène Zebrock - Nina Simone': 'concert',
    'Scène Inter - le 92 accueille le monde': 'concert',
    "Stand de Cœur d'Essonne Agglomération": 'concert',
    'Espace Jack Ralite': 'spectacle',
    'Allées de la Fête': 'spectacle',
    'Village famille': 'famille',
    'Espace Sport': 'atelier',
    'Village du Livre': 'conference',
    'Village du Livre - Studio Livre': 'conference',
    'Agora': 'conference',
    'Forum Social': 'conference',
    'Village des Médias Indépendants': 'conference',
    'Espace Sciences et Numérique': 'conference',
    'Village des Territoires Solidaires': 'conference',
    'Village du Monde': 'conference',
    "Les Ami.e.s de l'Humanité": 'conference',
}

# Quelques cartes sortent du thème de leur lieu (soirée DJ au stand des Ami.es…).
TITLE_OVERRIDES = [
    (re.compile(r'soir[ée]e dj', re.I), 'bal'),
    (re.compile(r'stand-?up', re.I), 'spectacle'),
    (re.compile(r'\bfanfare\b', re.I), 'concert'),
    (re.compile(r'\bconcert\b', re.I), 'concert'),
    (re.compile(r'en musique', re.I), 'concert'),
]

DAY_INDEX = {'ven': 0, 'sam': 1, 'dim': 2}


def clean(fragment):
    return html.unescape(re.sub(r'(?s)<[^>]+>', '', fragment)).replace('\xa0', ' ').strip()


def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    value = re.sub(r'[^a-zA-Z0-9]+', '-', value).strip('-').lower()
    return re.sub(r'-{2,}', '-', value)[:48].strip('-')


def category_for(title, venue):
    if venue not in VENUE_CATEGORY:
        sys.exit(f'Lieu inconnu, catégorie indéterminable : {venue!r}\n'
                 f'Ajoute-le à VENUE_CATEGORY dans {__file__}.')
    for pattern, category in TITLE_OVERRIDES:
        if pattern.search(title):
            return category
    return VENUE_CATEGORY[venue]


def parse(paths):
    seen, rows, skipped = set(), [], 0
    for path in paths:
        page = io.open(path, encoding='utf-8', errors='replace').read()
        for date, _event_id, raw_title, raw_slot, raw_venue in CARD.findall(page):
            title, slot, venue = clean(raw_title), clean(raw_slot), clean(raw_venue)
            match = SLOT.match(slot)
            if not match:
                print(f'créneau non reconnu, carte ignorée : {slot!r}', file=sys.stderr)
                continue
            start, end = match.groups()
            key = (date, start, end, venue, title)
            if key in seen:
                skipped += 1
                continue
            seen.add(key)
            rows.append(dict(date=date, title=title, start=start, end=end, venue=venue))
    return rows, skipped


def sort_key(event):
    hours, minutes = map(int, event['start'].split(':'))
    # Une heure < 05:00 est la fin de nuit du jour de grille : elle se trie après 23:59.
    return (DAY_INDEX[event['day']], (hours + 24 if hours < 5 else hours) * 60 + minutes,
            event['title'])


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('pages', nargs='+', help='pages « Programme complet » enregistrées')
    args = parser.parse_args()

    rows, skipped = parse(args.pages)
    if not rows:
        sys.exit('Aucun événement trouvé : le gabarit du site a-t-il changé ?')

    events, used_ids = [], collections.Counter()
    for row in sorted(rows, key=lambda r: (r['date'], r['start'], r['venue'], r['title'])):
        day = DAY_BY_DATE.get(row['date'])
        if day is None:
            sys.exit(f"Date hors festival : {row['date']}")
        base = f"{slug(row['title'])}-{day}-{row['start'].replace(':', '')}"
        used_ids[base] += 1
        events.append({
            'id': base if used_ids[base] == 1 else f'{base}-{used_ids[base]}',
            'title': row['title'],
            'artist': None,
            'day': day,
            'start': row['start'],
            'end': row['end'],
            'venue': row['venue'],
            'category': category_for(row['title'], row['venue']),
            'subtype': None,
            'description': None,
        })

    events.sort(key=sort_key)
    with io.open(OUT, 'w', encoding='utf-8') as handle:
        handle.write(json.dumps(events, ensure_ascii=False, indent=2) + '\n')

    print(f'{len(events)} événements écrits dans {os.path.relpath(OUT, ROOT)}'
          f' ({skipped} doublon(s) écarté(s))')
    for day in ('ven', 'sam', 'dim'):
        count = sum(1 for e in events if e['day'] == day)
        print(f'  {day} : {count}' + ('  ← aucun événement' if not count else ''))


if __name__ == '__main__':
    main()
