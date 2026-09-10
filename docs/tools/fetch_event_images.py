#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Downloads the event illustrations listed by build_events.py into public/events/.

The official feed serves illustrations from the festival's own CDN:

    https://static.humanite.chapi.to/images/<id>.jpg          # original
    https://static.humanite.chapi.to/images/<id>_square.jpg   # square crop

The app has to work fully offline once installed, so the images are precached
rather than hotlinked -- which means they have to stay small. Each one is
downscaled to a square WebP thumbnail (see THUMB_PX / QUALITY); the originals
weigh ~100 kB apiece, the thumbnails roughly a tenth of that.

Usage:
    python3 docs/tools/fetch_event_images.py            # only what is missing
    python3 docs/tools/fetch_event_images.py --force    # re-encode everything
    python3 docs/tools/fetch_event_images.py --prune    # drop orphaned files

Requires `cwebp` (brew install webp).
"""
import argparse
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MANIFEST = os.path.join(ROOT, 'docs', 'tools', 'event-images.json')
OUT_DIR = os.path.join(ROOT, 'public', 'events')

CDN = 'https://static.humanite.chapi.to/images/'

# Card thumbnails are shown at ~72 CSS px and detail headers at ~380 px; 320 px
# covers both on a 2x screen without blowing up the precache budget.
THUMB_PX = 320
QUALITY = 72


def source_urls(image_id):
    """Prefers the square crop the site itself uses for cards, falls back to the original."""
    stem, extension = os.path.splitext(image_id)
    return [f'{CDN}{stem}_square{extension}', f'{CDN}{image_id}']


def download(image_id):
    last_error = None
    for url in source_urls(image_id):
        request = urllib.request.Request(url, headers={'User-Agent': 'fdh26-fetch-images'})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                if not response.headers.get('Content-Type', '').startswith('image/'):
                    last_error = f'{url} -> {response.headers.get("Content-Type")}'
                    continue
                return response.read()
        except urllib.error.URLError as error:
            last_error = f'{url} -> {error}'
    raise RuntimeError(last_error or f'no source for {image_id}')


def encode(raw, destination):
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as handle:
        handle.write(raw)
        source = handle.name
    try:
        subprocess.run(
            ['cwebp', '-quiet', '-q', str(QUALITY), '-resize', str(THUMB_PX), '0',
             source, '-o', destination],
            check=True)
    finally:
        os.unlink(source)


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--force', action='store_true',
                        help='re-download and re-encode everything')
    parser.add_argument('--prune', action='store_true',
                        help='delete files no longer referenced by the manifest')
    args = parser.parse_args()

    if not shutil.which('cwebp'):
        sys.exit('cwebp introuvable : brew install webp')
    if not os.path.exists(MANIFEST):
        sys.exit(f"{os.path.relpath(MANIFEST, ROOT)} absent : lance build_events.py d'abord.")

    wanted = json.load(io.open(MANIFEST, encoding='utf-8'))
    os.makedirs(OUT_DIR, exist_ok=True)

    expected = set()
    fetched, kept, failed = 0, 0, []
    for image_id in wanted:
        name = os.path.splitext(image_id)[0] + '.webp'
        expected.add(name)
        destination = os.path.join(OUT_DIR, name)
        if os.path.exists(destination) and not args.force:
            kept += 1
            continue
        try:
            encode(download(image_id), destination)
            fetched += 1
        except (RuntimeError, subprocess.CalledProcessError) as error:
            failed.append(f'{image_id}: {error}')

    orphans = sorted(set(os.listdir(OUT_DIR)) - expected)
    if args.prune:
        for name in orphans:
            os.unlink(os.path.join(OUT_DIR, name))

    present = os.listdir(OUT_DIR)
    total = sum(os.path.getsize(os.path.join(OUT_DIR, name)) for name in present)
    print(f'{fetched} téléchargées, {kept} déjà présentes, {len(failed)} en échec')
    print(f'{len(present)} fichiers dans public/events/ ({total / 1_048_576:.1f} Mo)')
    if orphans:
        action = 'supprimés' if args.prune else 'orphelins (relance avec --prune)'
        print(f'{len(orphans)} {action}')
    for message in failed:
        print(f'  échec {message}', file=sys.stderr)
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
