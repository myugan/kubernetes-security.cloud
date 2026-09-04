import type { CollectionEntry } from 'astro:content';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termPattern(title: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(title)}\\b`, 'i');
}

/** Topics that mention a glossary term in title, description, or (for longer terms) body. */
export function topicsForGlossaryTerm(
  term: CollectionEntry<'glossary'>,
  topics: CollectionEntry<'topics'>[]
): CollectionEntry<'topics'>[] {
  const pattern = termPattern(term.data.title);
  const short = term.data.title.trim().length <= 4;
  return topics.filter((topic) => {
    if (pattern.test(topic.data.title) || pattern.test(topic.data.description)) return true;
    if (short) return false;
    return pattern.test(topic.body);
  });
}

/** Glossary terms referenced by a topic. Short titles only match title/description. */
export function glossaryTermsForTopic(
  topic: CollectionEntry<'topics'>,
  terms: CollectionEntry<'glossary'>[]
): CollectionEntry<'glossary'>[] {
  const titleDesc = `${topic.data.title}\n${topic.data.description}`;
  const body = topic.body;
  return terms
    .filter((term) => {
      const pattern = termPattern(term.data.title);
      if (pattern.test(titleDesc)) return true;
      if (term.data.title.trim().length <= 4) return false;
      return pattern.test(body);
    })
    .sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export function relatedTopics(
  topic: CollectionEntry<'topics'>,
  topics: CollectionEntry<'topics'>[],
  limit = 4
): CollectionEntry<'topics'>[] {
  const mitre = new Set(topic.data.mitreTechniques ?? []);
  const phase = topic.data.phase ?? topic.data.offensiveType;
  const scored = topics
    .filter((other) => other.slug !== topic.slug)
    .map((other) => {
      let score = 0;
      const otherMitre = other.data.mitreTechniques ?? [];
      if (mitre.size > 0) {
        score += otherMitre.filter((id) => mitre.has(id)).length * 3;
      }
      const otherPhase = other.data.phase ?? other.data.offensiveType;
      if (phase && otherPhase === phase) score += 2;
      if (topic.data.category !== other.data.category) score += 1;
      return { other, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.other.data.title.localeCompare(b.other.data.title));

  return scored.slice(0, limit).map((row) => row.other);
}
