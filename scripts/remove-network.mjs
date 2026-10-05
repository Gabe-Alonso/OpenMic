// Removes the dummy network (musicians + venues) created by
// scripts/seed-network.mjs.
// Usage: node --env-file=.env scripts/remove-network.mjs
//
// Reads scripts/.seed-manifest.json for the list of created auth user ids and
// deletes each one via the admin API. Deleting the auth user cascades to
// profiles/posts/comments/likes if the DB has ON DELETE CASCADE foreign keys
// (standard for a Supabase profiles table keyed off auth.users). If it
// doesn't, this also explicitly deletes those rows first as a fallback.

import { createClient } from '@supabase/supabase-js';
import { readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '.seed-manifest.json');

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
	console.error('Missing PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
	console.error('Run with: node --env-file=.env scripts/remove-network.mjs');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

function chunk(arr, size) {
	const out = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

async function main() {
	let manifest;
	try {
		manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'));
	} catch {
		console.error(`No manifest found at ${MANIFEST_PATH} — nothing to remove.`);
		process.exit(1);
	}

	const ids = manifest.users.map((u) => u.id);
	const musicianCount = manifest.users.filter((u) => u.kind === 'musician').length;
	const venueCount = manifest.users.filter((u) => u.kind === 'venue').length;
	console.log(`Found ${ids.length} dummy accounts in manifest (${musicianCount} musicians, ${venueCount} venues, created ${manifest.createdAt}).`);

	// Best-effort explicit cleanup in case FKs aren't set to cascade.
	for (const batch of chunk(ids, 100)) {
		await supabase.from('post_likes').delete().in('user_id', batch);
		await supabase.from('comment_likes').delete().in('user_id', batch);
		await supabase.from('post_comments').delete().in('author_id', batch);
	}
	const { data: posts } = await supabase.from('posts').select('id').in('author_id', ids);
	const postIds = (posts ?? []).map((p) => p.id);
	for (const batch of chunk(postIds, 100)) {
		await supabase.from('post_media').delete().in('post_id', batch);
		await supabase.from('post_likes').delete().in('post_id', batch);
		await supabase.from('post_comments').delete().in('post_id', batch);
	}
	for (const batch of chunk(postIds, 100)) {
		await supabase.from('posts').delete().in('id', batch);
	}
	for (const batch of chunk(ids, 100)) {
		await supabase.from('profiles').delete().in('id', batch);
	}

	console.log('Deleting auth users...');
	let removed = 0;
	for (const id of ids) {
		const { error } = await supabase.auth.admin.deleteUser(id);
		if (error) console.error(`  ✗ ${id}: ${error.message}`);
		else removed++;
	}

	console.log(`Removed ${removed}/${ids.length} dummy accounts.`);
	await unlink(MANIFEST_PATH);
	console.log('Manifest deleted.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
