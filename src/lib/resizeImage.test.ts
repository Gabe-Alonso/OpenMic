import { describe, it, expect } from 'vitest';
import { resizeImage } from './resizeImage';

describe('resizeImage', () => {
	it('returns SVG files unchanged (vector, resizing is meaningless)', async () => {
		const file = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' });
		expect(await resizeImage(file)).toBe(file);
	});

	it('returns GIF files unchanged (avoids flattening animation to one frame)', async () => {
		const file = new File(['gif-bytes'], 'anim.gif', { type: 'image/gif' });
		expect(await resizeImage(file)).toBe(file);
	});

	it('returns non-image files unchanged', async () => {
		const file = new File(['pdf-bytes'], 'doc.pdf', { type: 'application/pdf' });
		expect(await resizeImage(file)).toBe(file);
	});
});
