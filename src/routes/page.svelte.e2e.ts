import { expect, test } from '@playwright/test';

test('shows the signed-out queue app', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Your media queue' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'More sign-in options' })).toBeVisible();

	await page.getByRole('button', { name: 'More sign-in options' }).click();

	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
	await expect(page.locator('form').getByRole('button', { name: 'Sign in' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Send magic link instead' })).toBeVisible();
});
