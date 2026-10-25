// Keep the shared APTM dashboard behavior while routing admin incidents to
// the admin overview page without changing the APTM workspace itself.
document.querySelectorAll('.incident-row').forEach((row) => {
  const openAdminOverview = (event) => {
    event.stopImmediatePropagation();
    event.preventDefault();
    const title = row.querySelector('.incident-info strong').textContent;
    const meta = row.querySelector('.incident-info span').textContent;
    const status = row.querySelector('.status-pill')?.textContent || 'Open';
    const params = new URLSearchParams({ title, meta, status });
    window.location.href = `adminIncidentOverview.html?${params}`;
  };

  row.addEventListener('click', openAdminOverview, true);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') openAdminOverview(event);
  }, true);
});

const dashboardScript = document.createElement('script');
dashboardScript.src = '../aptm/aptmDashboard.js';
document.body.appendChild(dashboardScript);
