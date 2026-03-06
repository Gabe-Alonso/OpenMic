import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (user) throw redirect(303, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirm-password') as string;

		if (!name || !email || !password) {
			return fail(400, { error: 'All fields are required.', email, name });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match.', email, name });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.', email, name });
		}

		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { full_name: name } }
		});

		if (error) {
			return fail(400, { error: error.message, email, name });
		}

		return { success: true };
	}
};
