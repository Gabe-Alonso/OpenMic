// Keyset ("cursor") pagination for any table with a created_at/id pair that's
// unique together. Avoids OFFSET, which gets slower as the offset grows and
// gives duplicate/missing rows when new posts are inserted between page
// fetches — keyset pagination doesn't have either problem: each page asks for
// "rows strictly after the last one I saw," not "the Nth page."

export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
	return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
		if (typeof parsed?.createdAt === 'string' && typeof parsed?.id === 'string') return parsed;
	} catch {
		// malformed/tampered cursor — treat as "no cursor" rather than erroring
	}
	return null;
}

// Apply a keyset filter to a Supabase query builder for a table ordered by
// `created_at desc, id desc`. `(created_at, id) < (cursor.createdAt, cursor.id)`,
// expressed the way PostgREST's `.or()` wants it.
export function applyCursor<T>(query: T, cursor: Cursor | null): T {
	if (!cursor) return query;
	return (query as any).or(
		`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
	);
}

// Fetch `limit + 1` rows, then slice: if the extra row came back, there's a
// next page, and its cursor is the last row actually returned.
export function paginateRows<T extends { created_at: string; id: string }>(
	rows: T[],
	limit: number
): { page: T[]; nextCursor: string | null } {
	if (rows.length > limit) {
		const page = rows.slice(0, limit);
		const last = page[page.length - 1];
		return { page, nextCursor: encodeCursor({ createdAt: last.created_at, id: last.id }) };
	}
	return { page: rows, nextCursor: null };
}
