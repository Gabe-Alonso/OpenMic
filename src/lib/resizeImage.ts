// Client-side resize/re-encode before upload — runs in the browser via
// Canvas, so no image-processing dependency or server-side pipeline is
// needed. Supabase Storage already serves everything through its CDN;
// this is the other half of "image upload with resizing and a CDN" —
// shrinking what gets uploaded in the first place.

const MAX_DIMENSION = 1600;
const SKIP_IF_UNDER_BYTES = 400 * 1024; // not worth re-encoding an already-small image
const JPEG_QUALITY = 0.82;

export async function resizeImage(
	file: File,
	maxDimension = MAX_DIMENSION,
	quality = JPEG_QUALITY
): Promise<File> {
	// Vector (resizing is meaningless) and animated formats (redrawing to a
	// canvas flattens them to one frame) are left untouched.
	if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
		return file;
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		// Decoding failed (unsupported format, corrupt file) — fall back to the
		// original rather than blocking the upload entirely.
		return file;
	}

	try {
		const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
		if (scale === 1 && file.size <= SKIP_IF_UNDER_BYTES) return file;

		const width = Math.round(bitmap.width * scale);
		const height = Math.round(bitmap.height * scale);
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return file;
		ctx.drawImage(bitmap, 0, 0, width, height);

		// PNG is kept as PNG in case it relies on transparency; everything else
		// is re-encoded as JPEG, which is dramatically smaller for photos.
		const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality));
		if (!blob) return file;

		const newName = file.name.replace(/\.[^.]+$/, '') + (outputType === 'image/png' ? '.png' : '.jpg');
		return new File([blob], newName, { type: outputType });
	} finally {
		bitmap.close();
	}
}
