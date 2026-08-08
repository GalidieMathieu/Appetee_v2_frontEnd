import { expect, test } from '@playwright/test';

type Profile = {
  username: string;
  imageUrl: string | null;
};

test('login, claim-scoped profile update, logout, and user switching stay isolated', async ({ page }) => {
  let authenticated = false;
  let currentUser: 'first' | 'second' = 'first';
  const profiles: Record<'first' | 'second', Profile> = {
    first: { username: 'first-chef', imageUrl: null },
    second: { username: 'second-chef', imageUrl: 'https://example.com/second.png' },
  };
  const profileUpdateBodies: unknown[] = [];

  await page.route('https://localhost:5001/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/auth/session' && request.method() === 'GET') {
      if (!authenticated) {
        await route.fulfill({ status: 401, contentType: 'application/problem+json', body: '{}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: currentUser === 'first' ? 1 : 2, username: profiles[currentUser].username }),
      });
      return;
    }

    if (path === '/api/auth/login' && request.method() === 'POST') {
      const body = request.postDataJSON() as { email: string };
      currentUser = body.email.startsWith('second') ? 'second' : 'first';
      authenticated = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: currentUser === 'first' ? 1 : 2, username: profiles[currentUser].username }),
      });
      return;
    }

    if (path === '/api/auth/logout' && request.method() === 'POST') {
      authenticated = false;
      await route.fulfill({ status: 204 });
      return;
    }

    if (path === '/api/users/me' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profiles[currentUser]),
      });
      return;
    }

    if (path === '/api/users/me' && request.method() === 'PUT') {
      const body = request.postDataJSON() as Profile;
      profileUpdateBodies.push(body);
      profiles[currentUser] = body;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      return;
    }

    await route.abort('failed');
  });

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('first@appetee.dev');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('.hdr__username')).toHaveText('first-chef');

  await page.getByRole('link', { name: 'Profile' }).first().click();
  await expect(page.getByLabel('Username')).toHaveValue('first-chef');
  await page.getByLabel('Username').fill('updated-first-chef');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toContainText('Your profile has been updated.');
  expect(profileUpdateBodies).toEqual([{ username: 'updated-first-chef', imageUrl: null }]);
  expect(Object.keys(profileUpdateBodies[0] as object)).toEqual(['username', 'imageUrl']);

  await page.getByRole('button', { name: /Logout/ }).first().click();
  await expect(page).toHaveURL(/\/auth\/login$/);

  await page.getByLabel('Email').fill('second@appetee.dev');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.locator('.hdr__username')).toHaveText('second-chef');
  await page.getByRole('link', { name: 'Profile' }).first().click();
  await expect(page.getByLabel('Username')).toHaveValue('second-chef');
  await expect(page.getByText('updated-first-chef')).toHaveCount(0);
});
