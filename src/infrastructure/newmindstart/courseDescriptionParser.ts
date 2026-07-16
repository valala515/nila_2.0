// Parses NMS's course detail `description` field — a JSON-encoded array of
// CMS content blocks — into the fields the recommendation engine actually
// uses. Ported from ai_agent_chat's fetchCourseBody (scripts/syncCourses.js).
// Pure text transform, no I/O — colocated with the infra adapter because the
// block shape is New Mind Start's own CMS format, not a domain concept.
interface DescriptionListItem {
  readonly icon?: string;
  readonly text?: string;
}

interface DescriptionBlock {
  readonly type?: string;
  readonly text?: string;
  readonly subtitle?: string;
  readonly list?: ReadonlyArray<string | DescriptionListItem>;
}

export interface ParsedCourseDescription {
  readonly body: string | null;
  readonly lessonsCount: number | null;
  readonly courseFocus: string | null;
}

const MAX_BODY_LENGTH = 2000;
const MAX_FOCUS_LENGTH = 100;
const EMPTY: ParsedCourseDescription = { body: null, lessonsCount: null, courseFocus: null };

// Bounded quantifier (vs. unbounded [^>]+) so the pattern can't be flagged as
// super-linear — CMS-authored fields are short, well under this cap.
function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]{0,500}>/g, ' ');
}

export function parseCourseDescription(rawDescription: unknown): ParsedCourseDescription {
  const blocks = parseBlocks(rawDescription);
  if (!blocks) return EMPTY;
  return {
    lessonsCount: extractLessonsCount(blocks),
    courseFocus: extractCourseFocus(blocks),
    body: extractBody(blocks),
  };
}

function parseBlocks(raw: unknown): DescriptionBlock[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? (parsed as DescriptionBlock[]) : null;
  } catch {
    return null;
  }
}

function extractLessonsCount(blocks: DescriptionBlock[]): number | null {
  const includeBlock = blocks.find((block) => block.type === 'include');
  // CMS-authored field — not always an array (some courses omit `list`
  // entirely or leave it malformed) — fall back rather than crash the sync.
  const list = Array.isArray(includeBlock?.list) ? includeBlock.list : [];
  const videoItem = list.find(
    (item): item is DescriptionListItem => typeof item === 'object' && item !== null && (item as DescriptionListItem).icon === 'video',
  );
  if (!videoItem?.text) return null;
  const match = videoItem.text.match(/(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function extractCourseFocus(blocks: DescriptionBlock[]): string | null {
  const forBlock = blocks.find((block) => block.type === 'for');
  if (!forBlock?.subtitle) return null;
  const cleaned = stripHtmlTags(forBlock.subtitle).trim().slice(0, MAX_FOCUS_LENGTH);
  return cleaned || null;
}

function extractBody(blocks: DescriptionBlock[]): string | null {
  const parts: string[] = [];
  for (const block of blocks) {
    collectBlockText(block, parts);
    collectListText(block.list, parts);
  }
  const joined = parts.join(' ').slice(0, MAX_BODY_LENGTH);
  return joined || null;
}

function collectBlockText(block: DescriptionBlock, parts: string[]): void {
  const text = block.text ?? block.subtitle;
  if (typeof text !== 'string') return;
  const cleaned = cleanText(text);
  if (cleaned.length > 20) parts.push(cleaned);
}

function collectListText(list: DescriptionBlock['list'], parts: string[]): void {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    const raw = typeof item === 'string' ? item : (item.text ?? '');
    const cleaned = cleanText(raw);
    if (cleaned.length > 10) parts.push(cleaned);
  }
}

function cleanText(text: string): string {
  return stripHtmlTags(text)
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
