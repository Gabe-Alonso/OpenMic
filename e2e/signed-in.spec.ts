import { test, expect } from '@playwright/test';

// Needs a dedicated test account. Set E2E_USER_EMAIL and E2E_USER_PASSWORD
// (in CI, these come from repository secrets). The flow is skipped without them.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('signed-in user', () => {
	test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

	test('can sign in and open their profile settings', async ({ page }) => {
		await page.goto('/signin');
		await page.locator('input[type=email]').fill(email!);
		await page.locator('input[type=password]').fill(password!);
		await page.getByRole('button', { name: /sign in/i }).click();

		await expect(page).not.toHaveURL(/\/signin/);

		await page.goto('/profile');
		await expect(page.getByRole('heading', { name: 'Your Profile' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
	});
});
