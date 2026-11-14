// Runs before Angular: keep startup failures visible even if bootstrap cannot finish.
export function startupStatus() {
  const timer = setTimeout(() => {
    const detail = document.getElementById('startup-detail');
    if (detail)
      detail.textContent =
        'Startup is taking longer than expected. Check that all three application servers are running, then reload.';
  }, 10_000);

  return {
    complete: () => clearTimeout(timer),
    fail: (error: unknown) => {
      clearTimeout(timer);
      console.error('Federation startup failed', error);
      const root = document.querySelector('app-root');
      if (!root) return;
      const panel = document.createElement('main');
      panel.className = 'startup-panel';
      panel.setAttribute('role', 'alert');
      const heading = document.createElement('h1');
      heading.textContent = 'PulseOps could not start';
      const detail = document.createElement('p');
      detail.textContent =
        'Check the application servers and reload. Error details are available in the browser console.';
      const retry = document.createElement('button');
      retry.className = 'primary';
      retry.textContent = 'Reload and retry';
      retry.addEventListener('click', () => window.location.reload());
      panel.append(heading, detail, retry);
      root.replaceChildren(panel);
    },
  };
}
