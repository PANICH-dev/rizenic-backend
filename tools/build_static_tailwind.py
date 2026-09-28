#!/usr/bin/env python3
from pathlib import Path
import re, html, subprocess, time, os, sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
OUT = PUBLIC / 'compiled'
OUT.mkdir(exist_ok=True)
PAGES = [
  'index.html','jobs.html','jobs_table.html','parts.html','repair.html','dashboard.html',
  'finance.html','admin.html','history.html','repair_export.html','repair_date_update.html','repair_board.html'
]
SIMPLE = {'flex','grid','hidden','block','inline','inline-block','relative','absolute','fixed','sticky','static','table','truncate','italic','uppercase','lowercase','capitalize','transition','transform','visible','invisible','isolate','contents','sr-only','antialiased'}

script_re = re.compile(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*></script>', re.I)
style_tw_re = re.compile(r'<style\s+type=["\']text/tailwindcss["\'][^>]*>(.*?)</style>', re.I|re.S)
style_any_re = re.compile(r'<style(?![^>]*type=["\']text/tailwindcss["\'])[^>]*>(.*?)</style>', re.I|re.S)
class_attr_re = re.compile(r'class(?:Name)?\s*=\s*["\'`]([^"\'`]+)["\'`]', re.I)
# Broad token characters accepted by Tailwind candidates. False positives are harmless.
token_re = re.compile(r'!?-?[A-Za-z0-9_\[\]#.%/,:()]+(?:-[A-Za-z0-9_\[\]#.%/,:()]+)+|(?:sm|md|lg|xl|2xl|hover|focus|active|disabled|group-hover|first|last|odd|even):[^\s"\'`<>]+')

def referenced_sources(page_path: Path, html_text: str):
    texts = [html_text]
    for src in script_re.findall(html_text):
        if src.startswith(('http://','https://','//','/vendor/')):
            continue
        clean = src.split('?',1)[0]
        if clean.startswith('/'):
            p = PUBLIC / clean.lstrip('/')
        else:
            p = page_path.parent / clean
        if p.exists() and p.is_file() and p.suffix == '.js':
            try: texts.append(p.read_text(encoding='utf-8'))
            except Exception: pass
    return texts

def extract_candidates(texts):
    tokens = set()
    for text in texts:
        for attrs in class_attr_re.findall(text):
            for tok in re.split(r'\s+', attrs):
                tok = tok.strip()
                if tok and '${' not in tok:
                    tokens.add(tok)
        for tok in token_re.findall(text):
            tok = tok.strip('"\'`;,{}<>')
            if tok and '${' not in tok and len(tok) < 180:
                tokens.add(tok)
        for tok in re.findall(r'(?<![\w-])(flex|grid|hidden|block|inline-block|relative|absolute|fixed|sticky|truncate|uppercase|transition|transform)(?![\w-])', text):
            tokens.add(tok)
    return sorted(tokens)

def custom_tailwind_css(html_text, page):
    blocks = style_tw_re.findall(html_text)
    # Some legacy pages put @apply inside a normal style block. Feed those blocks through Tailwind too.
    for block in style_any_re.findall(html_text):
        if '@apply' in block:
            blocks.append(block)
    # Production HTML no longer ships Tailwind runtime/@apply blocks. Keep the legacy
    # component rules as build-only sources so recompilation preserves the exact UI.
    sidecar = ROOT / 'tools' / 'tailwind_sources' / f'{Path(page).stem}.css'
    if sidecar.exists():
        blocks.append(sidecar.read_text(encoding='utf-8'))
    return '\n'.join(blocks)

def make_compile_html(page, candidates, custom_css, runtime_js):
    els = ''.join(f'<i class="{html.escape(c, quote=True)}"></i>' for c in candidates)
    return f'''<!doctype html><html><head><meta charset="utf-8">
<style type="text/tailwindcss">{custom_css}</style>
<script>{runtime_js}</script>
</head><body><div id="safelist">{els}</div><div data-page="{page}"></div></body></html>'''

def main():
    runtime_js = (PUBLIC / 'vendor' / 'tailwindcss.js').read_text(encoding='utf-8')
    docs = {}
    for page in PAGES:
        p = PUBLIC / page
        text = p.read_text(encoding='utf-8')
        texts = referenced_sources(p, text)
        candidates = extract_candidates(texts)
        docs[page] = make_compile_html(page, candidates, custom_tailwind_css(text, page), runtime_js)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        try:
            for page in PAGES:
                pg = browser.new_page()
                errors=[]
                pg.on('pageerror', lambda e: errors.append(str(e)))
                pg.set_content(docs[page], wait_until='load', timeout=120000)
                pg.wait_for_function('''() => [...document.head.querySelectorAll("style")].some(s => !s.matches('[type="text/tailwindcss"]') && s.textContent.includes('--tw-'))''', timeout=120000)
                css = pg.evaluate("""() => [...document.head.querySelectorAll('style')].filter(s => !s.matches('[type=\"text/tailwindcss\"]')).map(s => s.textContent).sort((a,b)=>b.length-a.length)[0] || ''""")
                # Strip the Tailwind license banner URL from browser runtime output.
                # The build-time vendor source remains untouched; generated CSS must contain no external URL.
                css = re.sub(r'/\*\s*!?\s*tailwindcss[^*]*https://tailwindcss\.com\s*\*/', '/* tailwindcss precompiled */', css, flags=re.I)
                if len(css) < 5000:
                    raise RuntimeError(f'{page}: generated CSS too small ({len(css)}) errors={errors}')
                out = OUT / f'{Path(page).stem}.tailwind.css'
                out.write_text(css, encoding='utf-8')
                print(f'{page}: {len(css):,} bytes')
                pg.close()
        finally:
            browser.close()

if __name__ == '__main__': main()
