import { test, expect } from '@playwright/test';

// Read-only flows: these only load public pages, so they are safe to run
// against any environment, including a production-connected preview.

test('home page shows the hero and primary navigation', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your band.');
	await expect(page.getByRole('link', { name: 'Artists' }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Community' }).first()).toBeVisible();
});

test('artists page loads its list', async ({ page }) => {
	await page.goto('/artists');
	await expect(page.getByRole('heading', { name: 'Artists', level: 1 })).toBeVisible();
	await expect(page.getByPlaceholder('Search by location…')).toBeVisible();
});

test('community page loads the feed header', async ({ page }) => {
	await page.goto('/community');
	await expect(page.getByRole('heading', { name: 'Community', level: 1 })).toBeVisible();
});

test('sign-in page shows the email and password form', async ({ page }) => {
	await page.goto('/signin');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await expect(page.locator('input[type=email]')).toBeVisible();
	await expect(page.locator('input[type=password]')).toBeVisible();
});
