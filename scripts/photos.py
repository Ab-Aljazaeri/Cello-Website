"""Crop and compress photos for the site.

    python3 scripts/photos.py            # process every row in data/photos.csv
    python3 scripts/photos.py --force    # redo files that already exist
    python3 scripts/photos.py --src ~/Downloads/cello-photos

Reads full-size originals (straight from Google Drive) out of photos-originals/
(not committed; the originals stay in Drive) and writes small WebP files to
src/assets/photos/<slug>-800.webp and <slug>-1600.webp.

Each row of data/photos.csv says which original to use, the shape to crop to
(ratio, e.g. 4:3), where the subject sits (focus_x, focus_y from 0 to 1) and how
far to move in (zoom: 1 keeps the whole frame, 2 crops to half the width), so a
crop can be nudged without opening an image editor. Needs Pillow:
pip install Pillow
"""
import argparse
import csv
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
WIDTHS = (800, 1600)


def crop_to_ratio(im, ratio, fx, fy, zoom=1.0):
    rw, rh = (float(v) for v in ratio.split(':'))
    target = rw / rh
    w, h = im.size
    if w / h > target:  # too wide: trim the sides
        cw, ch = round(h * target), h
    else:  # too tall: trim top and bottom
        cw, ch = w, round(w / target)
    if zoom > 1:  # move in closer: a smaller window around the focus point
        cw, ch = round(cw / zoom), round(ch / zoom)
    left = min(max(round(fx * w - cw / 2), 0), w - cw)
    top = min(max(round(fy * h - ch / 2), 0), h - ch)
    return im.crop((left, top, left + cw, top + ch))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=str(ROOT / 'photos-originals'))
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    src = Path(args.src).expanduser()
    out = ROOT / 'src' / 'assets' / 'photos'
    out.mkdir(parents=True, exist_ok=True)

    rows = list(csv.DictReader(open(ROOT / 'data' / 'photos.csv', encoding='utf-8')))
    missing = []
    for row in rows:
        slug = row['slug']
        targets = [out / f'{slug}-{w}.webp' for w in WIDTHS]
        if not args.force and all(t.exists() for t in targets):
            continue
        original = src / row['source_file']
        if not original.exists():
            missing.append(f"{slug}: {row['source_file']} (Drive folder \"{row['drive_folder']}\")")
            continue
        im = ImageOps.exif_transpose(Image.open(original)).convert('RGB')
        im = crop_to_ratio(im, row['ratio'], float(row['focus_x']), float(row['focus_y']), float(row.get('zoom') or 1))
        for w, target in zip(WIDTHS, targets):
            w = min(w, im.width)  # never enlarge; a tight crop's large file is just the crop
            size = (w, round(w * im.height / im.width))
            im.resize(size, Image.LANCZOS).save(target, 'WEBP', quality=78, method=6)
            print(f'{target.relative_to(ROOT)}  {size[0]}x{size[1]}  {target.stat().st_size // 1024} KB')

    if missing:
        print('Originals not found in', src, file=sys.stderr)
        for m in missing:
            print('  -', m, file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
