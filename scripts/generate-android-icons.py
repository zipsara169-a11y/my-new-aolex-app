#!/usr/bin/env python3
"""Copy pre-generated APLEX launcher images into the generated Android project."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts' / 'android-icons'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
if not RES.exists():
    raise SystemExit('Android project is missing. Run "npx cap add android" first.')

for source_dir in SOURCE.glob('mipmap-*'):
    target_dir = RES / source_dir.name
    target_dir.mkdir(parents=True, exist_ok=True)
    for source_file in source_dir.glob('*.png'):
        shutil.copy2(source_file, target_dir / source_file.name)

adaptive_dir = RES / 'mipmap-anydpi-v26'
adaptive_dir.mkdir(parents=True, exist_ok=True)
xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
'''
(adaptive_dir / 'ic_launcher.xml').write_text(xml, encoding='utf-8')
(adaptive_dir / 'ic_launcher_round.xml').write_text(xml, encoding='utf-8')

print('APLEX launcher icons generated successfully.')
