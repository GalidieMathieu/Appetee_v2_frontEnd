import { expect, test } from '@playwright/test';

test('requests and confirms a password reset without disclosing account existence', async ({ page }) => {
  const recoveryRequests: unknown[] = [];
  const resetRequests: unknown[] = [];

  await page.route('https://localhost:5001/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/auth/session' && request.method() === 'GET') {
      await route.fulfill({ status: 401, contentType: 'application/problem+json', body: '{}' });
      return;
    }

    if (path === '/api/auth/password-recovery/request' && request.method() === 'POST') {
      recoveryRequests.push(request.postDataJSON());
      await route.fulfill({ status: 204 });
      return;
    }

    if (path === '/api/auth/password-recovery/confirm' && request.method() === 'POST') {
      resetRequests.push(request.postDataJSON());
      await route.fulfill({ status: 204 });
      return;
    }

    await route.abort('failed');
  });

  await page.goto('/auth/login');
  await page.getByRole('link', { name: 'Forgot Password?' }).click();
  await expect(page).toHaveURL(/\/auth\/forgot-password$/);

  await page.getByLabel('Email').fill('unknown@appetee.dev');
  await page.getByLabel('Email').press('Enter');

  await expect(page.getByRole('status')).toContainText(
    'If an account exists for that email, we sent password reset instructions.'
  );
  await expect(page.getByText('unknown@appetee.dev')).toHaveCount(0);
  expect(recoveryRequests).toEqual([{ email: 'unknown@appetee.dev' }]);

  await page.goto('/auth/reset-password?token=single-use-token');
  await page.getByLabel('New password', { exact: true }).fill('new-password');
  await page.getByLabel('Confirm new password', { exact: true }).fill('new-password');
  await page.getByRole('button', { name: 'Reset password' }).click();

  await expect(page.getByRole('status')).toContainText('Your password has been reset');
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
  expect(resetRequests).toEqual([{
    token: 'single-use-token',
    newPassword: 'new-password',
  }]);

  await page.getByRole('link', { name: 'Continue to Log In' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('an expired Appetee cookie does not discard a password reset link', async ({ page }) => {
  await page.route('https://localhost:5001/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/auth/session' && request.method() === 'GET') {
      await route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({ code: 'session_expired' }),
      });
      return;
    }

    await route.abort('failed');
  });

  await page.goto('/auth/reset-password?token=still-valid-recovery-token');

  await expect(page).toHaveURL(/\/auth\/reset-password\?token=still-valid-recovery-token$/);
  await expect(page.getByRole('heading', { name: 'Create a new password' })).toBeVisible();
});
