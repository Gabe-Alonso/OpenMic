// Extracts a bare, lowercased hostname from a URL or email address for
// comparison — "https://www.TheVenue.com/book" and "jane@thevenue.com"
// both reduce to "thevenue.com". Returns null for anything that doesn't
// look like it has a usable domain at all.
function extractDomain(value: string): string | null {
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return null;

	const atIndex = trimmed.indexOf('@');
	if (atIndex !== -1) {
		const domain = trimmed.slice(atIndex + 1);
		return domain || null;
	}

	try {
		const withProtocol = /^[a-z]+:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
		const host = new URL(withProtocol).hostname;
		return host.replace(/^www\./, '') || null;
	} catch {
		return null;
	}
}

// True if the claimant's account email domain matches the venue's listed
// website domain — the "instant approval" fast path real platforms use
// (Google Business Profile does essentially this via Search Console
// domain verification). Everything else falls back to manual review.
export function domainsMatch(claimantEmail: string, venueWebsite: string | null): boolean {
	if (!venueWebsite) return false;
	const emailDomain = extractDomain(claimantEmail);
	const siteDomain = extractDomain(venueWebsite);
	return !!emailDomain && !!siteDomain && emailDomain === siteDomain;
}
