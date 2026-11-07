# Expo public web assets

## Purpose
- Own the SPA HTML template and school crest served without a private session.

## Ownership
- `index.html` owns app title, description, sharing metadata and root web layout. `logo.png` is a copy of the supplied crest from `../assets/logo.png`.

## Local Contracts
- Preserve school names, Honor Before Honours, the crest and red theme colour. No private data, credentials, fixture IDs or provider branding in public assets.
- Expo injects the bundle script during web export. Keep the root element and closing head/body tags. Hosting serves the exported index.html as the SPA fallback.

## Work Guidance
- Native screens remain under src; this template is web-only.

## Verification
- Root export:expo verifies the template and assets are copied. Inspect dist/index.html for school metadata and the generated bundle script; compare the crest to assets/logo.png.

## Child DOX Index
- None.
