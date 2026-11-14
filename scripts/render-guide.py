"""Render the revision Markdown into standalone HTML without dependencies."""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parent.parent

def inline(text):
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https://[^)]+)\)', r'<a href="\2">\1</a>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'`([^`]+)`', r'<code>\1</code>', text)

parts, toc, paragraph = [], [], []
listing, code, section = None, None, False

def flush():
    if paragraph:
        parts.append('<p>' + inline(' '.join(paragraph)) + '</p>')
        paragraph.clear()

def close_list():
    global listing
    if listing:
        parts.append('</' + listing + '>')
        listing = None

for line in (ROOT / 'angular-microfrontend-guide.md').read_text().splitlines():
    if line.startswith('```'):
        flush()
        close_list()
        if code is None:
            code = []
        else:
            parts.append('<pre><code>' + html.escape('\n'.join(code)) + '</code></pre>')
            code = None
        continue
    if code is not None:
        code.append(line)
        continue
    if not line.strip():
        flush()
        close_list()
        continue
    if line.startswith('# '):
        flush()
        close_list()
        parts.append('<header><span class="eyebrow">PULSEOPS · ARCHITECTURE & BUILD JOURNAL</span><h1>' + inline(line[2:]) + '</h1><p class="meta">Offline revision guide · Milestones 01–03 · Runtime federation</p></header>')
    elif line.startswith('## '):
        flush()
        close_list()
        if section:
            parts.append('</section>')
        anchor = 'section-' + str(len(toc) + 1)
        title = inline(line[3:])
        toc.append('<a href="#' + anchor + '">' + title + '</a>')
        parts.append('<section id="' + anchor + '"><h2>' + title + '</h2>')
        section = True
    else:
        item = re.match(r'^(?:- |(\d+)\. )(.*)$', line)
        if item:
            flush()
            tag = 'ol' if item.group(1) else 'ul'
            if listing != tag:
                close_list()
                listing = tag
                parts.append('<' + tag + '>')
            parts.append('<li>' + inline(item.group(2)) + '</li>')
        else:
            close_list()
            paragraph.append(line)
flush()
close_list()
if code is not None:
    raise ValueError('Unclosed Markdown code fence')
if section:
    parts.append('</section>')
css = (ROOT / 'scripts/guide.css').read_text()
page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Angular Microfrontend — Revision Guide</title><style>' + css + '</style></head><body><a class="skip" href="#guide">Skip to guide</a><div class="layout"><aside><strong>Revision guide</strong><nav aria-label="Guide sections">' + ''.join(toc) + '</nav></aside><main id="guide">' + ''.join(parts) + '<footer>Standalone HTML · No external assets required · Print to save as PDF.</footer></main></div></body></html>\n'
(ROOT / 'angular-microfrontend-guide.html').write_text(page)
print(f'Rendered {len(toc)} guide sections.')
