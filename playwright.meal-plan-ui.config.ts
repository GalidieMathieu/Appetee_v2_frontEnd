import { defineConfig, devices } from '@playwright/test';

// Test-only synthetic responses: no live account, backend or persistence changes.
export default defineConfig({
  testDir: './e2e', testMatch: ['meal-plan-ui.spec.ts', 'meal-plan-planner.spec.ts', 'meal-plan-nutrition-plans.spec.ts', 'meal-plan-concurrency.spec.ts', 'meal-plan-accessibility.spec.ts', 'meal-plan-reference.spec.ts'], workers: 1, retries: 0,
  outputDir: 'test-results/meal-plan-ui', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4300', trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run ng -- serve --host 127.0.0.1 --port 4300',
    url: 'http://127.0.0.1:4300', reuseExistingServer: false, timeout: 120000,
  },
});
