# Cello Coffee House & Cafe website

The new website for Cello Coffee House & Cafe, 118 Campbell Ave SE, downtown Roanoke.

## How it's organized

```
data/                 The menu, as spreadsheets (the source of truth)
  menu-items.csv      One row per menu item: name, description, price, vegetarian, photo...
  categories.csv      Menu sections, their order and intro lines
  modifiers.csv       Choices and add-ons (bagel type, hummus flavors, burrito fillings...)
  photos.csv          Every photo on the site: which Drive original, how it's cropped, alt text
src/                  The site itself
  index.html          Homepage (favorites section is filled from the menu data)
  menu.html           Menu page (sections are filled from the menu data)
  assets/             CSS, JavaScript, logo, icons and photos/ (small WebP files)
scripts/build.mjs     Turns data/ + src/ into a finished site in dist/
scripts/photos.py     Crops and compresses photos listed in data/photos.csv
photos-originals/     Full-size photos from Google Drive (not committed; they stay in Drive)
docs/                 Original printed menus, logo files, open questions
```

## Changing the menu

1. Open `data/menu-items.csv` in Excel or Google Sheets.
2. Edit names, descriptions or prices. Set `status` to `hidden` to take an item off the site without deleting it.
3. Save as CSV, then run `npm run build`.

## Adding a photo

1. Download the original from Google Drive into `photos-originals/`.
2. Add a row to `data/photos.csv`: a short `slug` (like `hummus-pita`), the file name, the crop shape (`4:3` for menu items), where the food sits in the frame (`focus_x`, `focus_y`, 0 to 1; `0.5,0.5` is the center) and `zoom` (1 keeps the whole frame, 2 moves in to half the width). Write the `alt` text as you'd describe the photo to someone on the phone.
3. Run `python3 scripts/photos.py` (needs `pip install Pillow`). It writes `src/assets/photos/<slug>-800.webp` and `-1600.webp`, usually 30 to 150 KB each.
4. Type the slug in the item's `photo` column in `data/menu-items.csv` and run `npm run build`.

If a crop is off, change `focus_x`/`focus_y` and run `python3 scripts/photos.py --force`.

The build checks the data and stops with a plain message if something is off (a price that isn't a number, an unknown category, a duplicate id).

Column notes:

- `vegetarian`: `yes`, `option` (has a vegetarian version, like the burrito), or blank. Blank means not marked.
- `featured`: `yes` puts the item in "Cello favorites" on the homepage. A number (`1`, `2`...) also sets its position. Keep it to 6.
- `photo`: a slug from `data/photos.csv`, not a file name.
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

- Phase 1: drink and dessert photos plus a drinks menu, confirm hours and open questions, buy the domain, add an `og:image` link preview once the site has its address, launch.
- Phase 2: online pickup ordering into Clover (menu will sync from Clover then; this CSV is what we import into Clover first).
- Phase 3: rewards and win-back discount codes.

Full plan: https://claude.ai/artifact/5PZQgLo72PK4u8a4T8xVNx
