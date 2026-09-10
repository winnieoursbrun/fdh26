// Event illustrations come from the official feed, which names them
// `<id>.jpg`; `docs/tools/fetch_event_images.py` re-encodes them as square
// WebP thumbnails under public/events/ so the app stays offline-capable.
export function eventImageUrl(image: string | null | undefined): string | null {
  if (!image) {
    return null
  }
  const stem = image.replace(/\.[a-z0-9]+$/i, '')
  return `${import.meta.env.BASE_URL}events/${stem}.webp`
}
