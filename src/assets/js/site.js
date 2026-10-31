// Cello site behavior: mobile nav, open-now status, menu search and section tracking.
// Everything here is progressive: the pages read fine with JavaScript off.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Mobile navigation
  const header = $('.site-header');
  const toggle = $('.nav-toggle');
  if (header && toggle) {
    const setOpen = (open) => {
      header.toggleAttribute('data-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!header.hasAttribute('data-open')));
    $$('.site-nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // Open-now status, computed in Roanoke time no matter where the visitor is
  const hoursTable = $('[data-hours]');
  if (hoursTable) {
    let hours = null;
    try { hours = JSON.parse(hoursTable.dataset.hours); } catch (err) { hours = null; }
    if (hours) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      const part = (type) => (parts.find((p) => p.type === type) || {}).value;
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
      const now = Number(part('hour')) * 60 + Number(part('minute'));
      const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const label = (t) => {
        let [h, m] = t.split(':').map(Number);
        const ap = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return m ? `${h}:${String(m).padStart(2, '0')} ${ap}` : `${h} ${ap}`;
      };
      const row = hoursTable.querySelector(`tr[data-day="${day}"]`);
      if (row) row.setAttribute('data-today', '');
      const pill = $('[data-open-status]');
      const text = pill && pill.querySelector('[data-status-text]');
      if (pill && text) {
        const today = hours[day];
        if (today && now >= toMin(today[0]) && now < toMin(today[1])) {
          pill.dataset.state = 'open';
          text.textContent = `Open now until ${label(today[1])}`;
        } else if (today && now < toMin(today[0])) {
          pill.dataset.state = 'closed';
          text.textContent = `Opens today at ${label(today[0])}`;
        } else {
          const next = hours[(day + 1) % 7];
          pill.dataset.state = 'closed';
          text.textContent = next ? `Closed now. Opens tomorrow at ${label(next[0])}` : 'Closed now';
        }
      }
    }
  }

  // Menu page: search, vegetarian filter memory, active section chip
  const sections = $$('.menu-section');
  if (!sections.length) return;
  const search = $('#menu-search');
  const veg = $('#veg-only');
  const chips = $$('.chips a');
  const chipList = $('.chips');
  const empty = $('[data-empty]');
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  try { if (veg && localStorage.getItem('cello-veg') === '1') veg.checked = true; } catch (err) { /* storage unavailable */ }

  const update = () => {
    const q = norm(search ? search.value.trim() : '');
    const vegOnly = Boolean(veg && veg.checked);
    let anyVisible = false;
    sections.forEach((section) => {
      let visible = 0;
      $$('.menu-item', section).forEach((item) => {
        const matchesSearch = !q || norm(item.dataset.search || '').includes(q);
        const v = item.dataset.veg;
        item.toggleAttribute('data-hidden', !matchesSearch);
        if (matchesSearch && (!vegOnly || v === 'yes' || v === 'option')) visible += 1;
      });
      section.toggleAttribute('data-hidden', visible === 0);
      const chip = chips.find((c) => c.getAttribute('href') === `#${section.id}`);
      if (chip) chip.toggleAttribute('data-hidden', visible === 0);
      if (visible) anyVisible = true;
    });
    if (empty) empty.hidden = anyVisible;
  };

  if (search) search.addEventListener('input', update);
  if (veg) {
    veg.addEventListener('change', () => {
      try { localStorage.setItem('cello-veg', veg.checked ? '1' : '0'); } catch (err) { /* storage unavailable */ }
      update();
    });
  }
  const clear = $('[data-clear]');
  if (clear) {
    clear.addEventListener('click', () => {
      if (search) search.value = '';
      if (veg) veg.checked = false;
      try { localStorage.setItem('cello-veg', '0'); } catch (err) { /* storage unavailable */ }
      update();
      if (search) search.focus();
    });
  }
  update();

  if ('IntersectionObserver' in window && chipList) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        chips.forEach((c) => c.setAttribute('aria-current', String(c.getAttribute('href') === `#${entry.target.id}`)));
        const active = chips.find((c) => c.getAttribute('aria-current') === 'true');
        if (active) {
          const left = active.offsetLeft - chipList.clientWidth / 2 + active.clientWidth / 2;
          chipList.scrollTo({ left, behavior: 'smooth' });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach((s) => observer.observe(s));
  }
})();
