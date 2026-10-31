// Builds the site from the menu spreadsheets.
//
//   node scripts/build.mjs            -> dist/ (deploy this folder)
//   node scripts/build.mjs --preview  -> dist-preview/ (for the claude.ai artifact preview)
//
// data/menu-items.csv, data/categories.csv and data/modifiers.csv are the source of truth.
// Edit them in Excel or Google Sheets (save as CSV), run the build, and the menu page,
// the homepage favorites and dist/data/menu.json all update together.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = process.argv.includes('--preview');
const OUT = join(ROOT, PREVIEW ? 'dist-preview' : 'dist');

// ---------- CSV ----------
function parseCSV(text, file) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''));
  return body.map((r, n) => {
    if (r.length !== header.length) {
      throw new Error(`${file} line ${n + 2}: expected ${header.length} columns, found ${r.length}`);
    }
    return Object.fromEntries(header.map((h, k) => [h.trim(), r[k].trim()]));
  });
}
const readCSV = (name) => parseCSV(readFileSync(join(ROOT, 'data', name), 'utf8'), name);

const categories = readCSV('categories.csv').sort((a, b) => Number(a.sort) - Number(b.sort));
const items = readCSV('menu-items.csv');
const modifierRows = readCSV('modifiers.csv');

// ---------- validation ----------
const problems = [];
const catIds = new Set(categories.map((c) => c.id));
const seen = new Set();
for (const it of items) {
  if (seen.has(it.id)) problems.push(`duplicate item id "${it.id}"`);
  seen.add(it.id);
  if (!catIds.has(it.category)) problems.push(`${it.id}: unknown category "${it.category}"`);
  if (it.price && Number.isNaN(Number(it.price))) problems.push(`${it.id}: price "${it.price}" is not a number`);
  if (!['', 'yes', 'option', 'no'].includes(it.vegetarian)) problems.push(`${it.id}: vegetarian must be yes, option, no or blank`);
  if (!['active', 'draft', 'hidden'].includes(it.status)) problems.push(`${it.id}: status must be active, draft or hidden`);
}
for (const m of modifierRows) {
  for (const target of m.applies_to.split(/\s+/)) {
    const ok = target.startsWith('category:') ? catIds.has(target.slice(9)) : seen.has(target);
    if (!ok) problems.push(`modifier ${m.group_id}: applies_to "${target}" matches nothing`);
  }
}
if (problems.length) {
  console.error(`Menu data has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => { const v = Number(n); return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`; };
const joinOr = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`);
const leaf = '<svg aria-hidden="true"><use href="#i-leaf"/></svg>';
const arrow = '<svg width="18" height="18" aria-hidden="true"><use href="#i-arrow"/></svg>';

// modifier groups
const groups = new Map();
for (const m of modifierRows) {
  if (!groups.has(m.group_id)) {
    groups.set(m.group_id, {
      id: m.group_id, name: m.group_name, applies_to: m.applies_to.split(/\s+/),
      required: m.required === 'yes', min: Number(m.min), max: Number(m.max), options: []
    });
  }
  groups.get(m.group_id).options.push({ id: m.option_id, name: m.option_name, price_delta: Number(m.price_delta || 0), sort: Number(m.sort || 0) });
}
for (const g of groups.values()) g.options.sort((a, b) => a.sort - b.sort);

// Category-wide groups and groups shared by 3+ items are explained in the section intro,
// so only item-specific choices are printed under an item.
const itemGroups = (item) => [...groups.values()].filter((g) => g.applies_to.includes(item.id) && g.applies_to.length <= 2);

function optionLine(item, g) {
  const deltas = [...new Set(g.options.map((o) => o.price_delta))];
  const names = g.options.map((o) => esc(o.name));
  if (deltas.length === 1) {
    const extra = deltas[0] > 0 ? ` +${money(deltas[0])}` : '';
    return `<b>${esc(g.name)}${extra}:</b> ${joinOr(names)}`;
  }
  const byPrice = new Map();
  for (const o of g.options) {
    const p = Number(item.price || 0) + o.price_delta;
    if (!byPrice.has(p)) byPrice.set(p, []);
    byPrice.get(p).push(esc(o.name));
  }
  const parts = [...byPrice.entries()].sort((a, b) => a[0] - b[0]).map(([p, n]) => `${joinOr(n)} ${money(p)}`);
  return `<b>${esc(g.name)}:</b> ${parts.join(' · ')}`;
}

const priceHTML = (it) => {
  if (it.price_label && it.price) return `<span class="price">${esc(it.price_label)}</span>`;
  if (it.price) return `<span class="price">${money(it.price)}</span>`;
  if (it.price_label) return `<span class="price muted">${esc(it.price_label)}</span>`;
  return '';
};
const vegTag = (it) => (it.vegetarian === 'yes'
  ? `<span class="veg">${leaf}Vegetarian</span>`
  : it.vegetarian === 'option' ? `<span class="veg">${leaf}Vegetarian option</span>` : '');

const live = items.filter((it) => it.status === 'active');
const byCategory = categories.map((c) => ({
  ...c,
  items: live.filter((it) => it.category === c.id).sort((a, b) => Number(a.sort) - Number(b.sort))
})).filter((c) => c.items.length);

// ---------- menu page ----------
function itemHTML(it, cat) {
  const options = itemGroups(it).map((g) => optionLine(it, g));
  const meta = [vegTag(it), it.portion ? `<span class="portion">${esc(it.portion)}</span>` : ''].filter(Boolean);
  const search = [it.name, it.description, cat.name, ...itemGroups(it).flatMap((g) => g.options.map((o) => o.name))].join(' ').toLowerCase();
  return `<li class="menu-item" id="item-${esc(it.id)}" data-veg="${esc(it.vegetarian || 'unmarked')}" data-search="${esc(search)}">
  ${it.photo ? `<img class="mi-photo" src="assets/menu/${esc(it.photo)}" alt="${esc(it.name)}" width="800" height="500" loading="lazy">` : ''}
  <div class="mi-head"><h3>${esc(it.name)}</h3><span class="mi-leader" aria-hidden="true"></span>${priceHTML(it)}</div>
  ${meta.length ? `<p class="mi-meta">${meta.join('')}</p>` : ''}
  ${it.description ? `<p class="mi-desc">${esc(it.description)}</p>` : ''}
  ${options.map((o) => `<p class="mi-options">${o}</p>`).join('\n  ')}
</li>`;
}

const menuHTML = byCategory.map((c) => `<section class="menu-section" id="${esc(c.id)}" aria-labelledby="h-${esc(c.id)}">
  <div class="menu-section-head">
    ${c.kicker ? `<p class="kicker">${esc(c.kicker)}</p>` : ''}
    <h2 id="h-${esc(c.id)}"><span class="swoosh">${esc(c.name)}</span></h2>
    ${c.intro ? `<p class="intro">${esc(c.intro)}</p>` : ''}
  </div>
  <ul class="menu-list">
${c.items.map((it) => itemHTML(it, c)).join('\n')}
  </ul>
</section>`).join('\n');

const chipsHTML = byCategory.map((c) => {
  const hasVeg = c.items.some((it) => it.vegetarian === 'yes' || it.vegetarian === 'option');
  return `<li><a href="#${esc(c.id)}"${hasVeg ? '' : ' data-veg-none'}>${esc(c.name)}</a></li>`;
}).join('\n');

// ---------- homepage favorites ----------
const featured = byCategory.flatMap((c) => c.items.filter((it) => it.featured === 'yes'));
const featuredHTML = featured.map((it) => `<article class="dish-card">
  <div class="dish-photo">${it.photo
    ? `<img src="assets/menu/${esc(it.photo)}" alt="${esc(it.name)}" width="800" height="600" loading="lazy">`
    : `<span class="ph-tag">Photo coming</span><span class="ph-name">${esc(it.name)}</span>`}</div>
  <div class="dish-body">
    <div class="dish-top"><h3>${esc(it.name)}</h3>${priceHTML(it)}</div>
    ${vegTag(it)}
    ${it.description ? `<p>${esc(it.description)}</p>` : ''}
    <a class="text-link" href="menu.html#item-${esc(it.id)}">See it on the menu ${arrow}</a>
  </div>
</article>`).join('\n');

// ---------- write ----------
const inject = (html, name, content) => {
  const re = new RegExp(`<!-- ${name}:START -->[\\s\\S]*?<!-- ${name}:END -->`);
  if (!re.test(html)) throw new Error(`marker ${name} not found`);
  return html.replace(re, `<!-- ${name}:START -->\n${content}\n<!-- ${name}:END -->`);
};

// The artifact preview wraps its main page in its own document, so the preview's
// index.html keeps only what sits inside <head> and <body>.
const forPreviewMain = (html) => {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\s*/, '')
    .replace(/<meta name="viewport"[^>]*>\s*/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '<title>Cello Website</title>');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  return `${head.trim()}\n${body.trim()}\n`;
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'data'), { recursive: true });
cpSync(join(ROOT, 'src', 'assets'), join(OUT, 'assets'), { recursive: true });

let index = inject(readFileSync(join(ROOT, 'src', 'index.html'), 'utf8'), 'FEATURED', featuredHTML);
let menu = readFileSync(join(ROOT, 'src', 'menu.html'), 'utf8');
menu = inject(inject(menu, 'MENU', menuHTML), 'CHIPS', chipsHTML);
if (PREVIEW) index = forPreviewMain(index);

writeFileSync(join(OUT, 'index.html'), index);
writeFileSync(join(OUT, 'menu.html'), menu);

const json = {
  generated_at: new Date().toISOString(),
  categories: byCategory.map((c) => ({
    id: c.id, name: c.name, intro: c.intro,
    items: c.items.map((it) => ({
      id: it.id, name: it.name, description: it.description,
      price: it.price ? Number(it.price) : null, price_label: it.price_label || null,
      portion: it.portion || null, vegetarian: it.vegetarian || null,
      photo: it.photo || null, modifier_groups: itemGroups(it).map((g) => g.id)
    }))
  })),
  modifier_groups: [...groups.values()]
};
writeFileSync(join(OUT, 'data', 'menu.json'), `${JSON.stringify(json, null, 2)}\n`);

console.log(`Built ${live.length} items in ${byCategory.length} sections, ${featured.length} favorites -> ${OUT.replace(ROOT + '/', '')}/`);
