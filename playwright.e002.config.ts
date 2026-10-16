import { defineConfig, devices } from '@playwright/test';
/** Match the running backend's existing HTTPS localhost CORS allowlist. */
export default defineConfig({
    testDir: './e2e',
    testMatch: 'e002-administrative-permissions.spec.ts',
    workers: 1,
    retries: 0,
    outputDir: 'test-results/e002',
    reporter: 'list',
    use: { baseURL: 'https://localhost:4200', ignoreHTTPSErrors: true, trace: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run ng -- serve --host localhost --port 4200 --ssl',
        url: 'https://localhost:4200',
        ignoreHTTPSErrors: true,
        reuseExistingServer: true,
        timeout: 120000,
    },
});
