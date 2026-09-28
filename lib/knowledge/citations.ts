/** Citation helpers — never invent page numbers. */

export function formatCitation(input: {
  filename: string;
  title?: string;
  page?: number | null;
  section?: string | null;
}): string {
  const name = (input.filename || input.title || 'document').trim();
  if (input.page != null && Number.isFinite(input.page)) {
    return `${name} — page ${input.page}`;
  }
  if (input.section && input.section.trim()) {
    return `${name} — section "${input.section.trim()}"`;
  }
  return name;
}
