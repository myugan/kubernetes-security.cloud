import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '../config/site';

function ymdInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** YAML `createdAt: 2026-09-05` is stored as midnight UTC. Treat that as a calendar day, not an instant. */
function ymdFromCreatedAt(createdAt: Date): string {
  const year = createdAt.getUTCFullYear();
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(createdAt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Scheduled publishing is evaluated at build time.
 * A topic with `createdAt` after today in `site.publishTimeZone` is omitted.
 * Topics with no `createdAt` are treated as already published.
 */
export function isTopicPublished(createdAt: Date | undefined, now = new Date()): boolean {
  if (!createdAt) return true;
  return ymdFromCreatedAt(createdAt) <= ymdInTimeZone(now, site.publishTimeZone);
}

export async function getPublishedTopics(): Promise<CollectionEntry<'topics'>[]> {
  return getCollection('topics', ({ data }) => isTopicPublished(data.createdAt));
}
