import type { PageServerLoad } from './$types';
import { PRIVATE_ADMIN_EMAIL } from '$env/static/private';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();

	return {
		isAdmin: user?.email === PRIVATE_ADMIN_EMAIL,
		userId: user?.id ?? null
	};
};
