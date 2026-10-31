# Cello Coffee House & Cafe website

The new website for Cello Coffee House & Cafe, 118 Campbell Ave SE, downtown Roanoke.

## How it's organized

```
data/                 The menu, as spreadsheets (the source of truth)
  menu-items.csv      One row per menu item: name, description, price, vegetarian, photo...
  categories.csv      Menu sections, their order and intro lines
  modifiers.csv       Choices and add-ons (bagel type, hummus flavors, burrito fillings...)
src/                  The site itself
  index.html          Homepage (favorites section is filled from the menu data)
  menu.html           Menu page (sections are filled from the menu data)
  assets/             CSS, JavaScript, logo and icons
scripts/build.mjs     Turns data/ + src/ into a finished site in dist/
docs/                 Original printed menus, logo files, open questions
```

## Changing the menu

1. Open `data/menu-items.csv` in Excel or Google Sheets.
2. Edit names, descriptions or prices. Set `status` to `hidden` to take an item off the site without deleting it.
3. To add a photo, put the image in `src/assets/menu/` and type its file name in the `photo` column.
4. Save as CSV, then run `npm run build`.

The build checks the data and stops with a plain message if something is off (a price that isn't a number, an unknown category, a duplicate id).

Column notes:

- `vegetarian`: `yes`, `option` (has a vegetarian version, like the burrito), or blank. Blank means not marked.
- `featured`: `yes` puts the item in "Cello favorites" on the homepage. Keep it to 6.
- `price_label`: shown instead of the price when set, e.g. `See the case`.
- `menu_star`: the asterisk from the printed menu (meaning to confirm, see docs/menu-questions.md).
- `notes`: for us; never shown on the site.

## Running it

Needs Node 18 or newer. No packages to install.

```
npm run build        # builds dist/
npx serve dist       # or open dist/index.html directly
npm run preview      # builds dist-preview/ for the claude.ai preview link
```

## Deploying

Planned host: Cloudflare Pages. Build command `npm run build`, output folder `dist`.

## What's next

- Phase 1: real photos, confirm hours and open questions, buy the domain, launch.
- Phase 2: online pickup ordering into Clover (menu will sync from Clover then; this CSV is what we import into Clover first).
- Phase 3: rewards and win-back discount codes.

Full plan: https://claude.ai/artifact/5PZQgLo72PK4u8a4T8xVNx
