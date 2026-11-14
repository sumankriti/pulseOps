// Conservative allowlist of supported application destinations, not arbitrary URLs.
export function safeReturnUrl(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\s\\]/.test(value)
  )
    return '/orders';
  try {
    const url = new URL(value, 'https://pulseops.invalid');
    if (url.origin !== 'https://pulseops.invalid') return '/orders';
    if (!/^\/(?:orders(?:\/[A-Za-z0-9_-]+)?|inventory)\/?$/.test(url.pathname)) return '/orders';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/orders';
  }
}
