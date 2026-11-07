# Scope and requirements

## Purpose
- Own the client scope for Wynberg Girls Junior Connect.

## Ownership
- `build_scope.py` owns content, layout, vector diagrams, and Draw.io source generation.
- `verify_scope.py` verifies PDF structure, content, fonts, links, bounds, and renders every page for visual review.
- `system-diagrams.drawio` is generated editable diagram source; regenerate instead of editing it independently.
- Root `WGJS-Connect-Scope-and-Requirements.pdf` is the client deliverable.

## Local Contracts
- Use supplied `public/logo.png`, local Open Sans fonts, and school red/gold branding.
- Keep core production requirements, prototype status, dependencies, and future options distinct.
- Parent mobile scope covers Android/iOS; staff operations remain web scope.
- Do not invent costs, dates, provider commitments, legal compliance claims, or client approval.

## Work Guidance
- Run `python documents/scope/build_scope.py` from the root; requires ReportLab and installed workspace fonts.
- Run `python documents/scope/verify_scope.py`; requires PyMuPDF, Pillow, and pypdf.
- QA renders live in ignored `.cache/scope-qa/`; do not add them to the DOX index.

## Verification
- Require 25 A4 pages, six diagram pages in editable Draw.io, working internal links/bookmarks, embedded Open Sans, required module coverage, and text within page bounds.
- Inspect every rendered page; correct clipping, overlap, low contrast, or unreadable diagrams before delivery.
- Run `git diff --check` and validate Draw.io XML with the diagram skill validator.

## Child DOX Index
- None.
