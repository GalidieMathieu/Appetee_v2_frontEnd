import { isConfiguredApiUrl } from './api-url';

describe('configured API URL boundary', () => {
  const base = 'https://app.appetee.test/profile';

  it('supports same-origin relative API configuration without trusting other origins', () => {
    expect(isConfiguredApiUrl('/api/recipes', '/api/', base)).toBe(true);
    expect(isConfiguredApiUrl('https://app.appetee.test/api', '/api', base)).toBe(true);
    expect(isConfiguredApiUrl('https://evil.test/api/recipes', '/api', base)).toBe(false);
    expect(isConfiguredApiUrl('/api-other', '/api', base)).toBe(false);
  });

  it('fails closed on invalid or non-/api configuration', () => {
    expect(isConfiguredApiUrl('https://api.test/api', 'https://api.test/other', base)).toBe(false);
    expect(isConfiguredApiUrl('https://api.test/api', 'https://[invalid', base)).toBe(false);
    expect(isConfiguredApiUrl('https://[invalid', '/api', base)).toBe(false);
  });
});
