/** URL parsing enforces origin equality and the backend's exact /api segment boundary. */
export function isConfiguredApiUrl(url: string, apiUrl: string, baseUrl: string): boolean {
  try {
    const configured = new URL(apiUrl, baseUrl);
    const requested = new URL(url, baseUrl);
    return configured.pathname.replace(/\/$/, '') === '/api'
      && ['https:', 'http:'].includes(configured.protocol)
      && requested.origin === configured.origin
      && !requested.username && !requested.password
      && (requested.pathname === '/api' || requested.pathname.startsWith('/api/'));
  } catch {
    return false;
  }
}
