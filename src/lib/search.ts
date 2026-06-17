/**
 * Sanitizes free-text search input for use inside a PostgREST `.or()` filter
 * string, where commas separate conditions and `%`/`_` are ILIKE wildcards.
 * Stripping rather than escaping keeps this simple and safe for our use case
 * (short search boxes, not user-authored patterns).
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,%_]/g, " ").trim();
}
