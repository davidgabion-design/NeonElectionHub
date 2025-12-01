# Multi-Org Voting App (Material-You) — README

## Overview
This is a local/offline multi-organization voting app. Each organization gets its own:
- Org ID (e.g. `ORG-47291`)
- EC password (managed per-org)
- Voters, Positions, Candidates, Votes
- Optional logo (Base64 stored in browser storage)
- Public read-only results link + embed (token-protected)

The app stores everything in the browser's `localStorage`. It's ideal for demos, intranet, local elections, or as a client-side prototype. For production you should move storage to a secure backend.

---

## Files
- `index.html` — main UI
- `material-you.css` — styling (Material-ish look)
- `script.js` — main app logic
- `README.md` — this file

---

## Quick start
1. Open `index.html` in a browser (Chrome / Edge recommended).
2. Owner login:
   - Click **Owner Login**.
   - Default owner password: `superadmin123` (change after first login).
3. Create organizations (Owner):
   - Add org name, optional EC password, optional logo.
   - If EC password left blank one is generated (e.g. `ec47291`).
   - Copy and share Org ID + EC password with the organization's EC.

4. Organization EC:
   - Go to **Organization EC Login**, enter Org ID and EC password.
   - Add positions, candidates (with photos), and voters (manually or bulk).
   - Enable public results if desired (Generate token → Enable public).
   - Copy public link or embed code and share.

5. Voters:
   - On the main login screen select organization and enter phone number.
   - OTP is simulated: `123456`.
   - Cast votes for all positions.

---

## Important features
- **Public results link:** `?public=ORGID&token=TOKEN`
  - Example: `index.html?public=ORG-47291&token=RX82FQK01B`
- **Embed iframe:** append `&embed=1`
  - Example: `<iframe src="...&embed=1" style="width:100%;height:600px;"></iframe>`
  - Embed hides back button and app nav, showing a clean card layout.
- **Persistent sessions:**
  - Owner and EC sessions persist in `localStorage` until logout.
  - Voter sessions are ephemeral and not persisted (security).

- **Bulk upload:** Excel template (Name, Phone).
- **Candidate photos & Org logos:** stored as Base64 in `localStorage`.
- **Export results:** Opens printable results page (PDF via browser print).
- **Undo:** After deletes, you can immediately undo the last deletion (limited undo).

---

## Security & production notes
- This app is client-side only; storing sensitive election data in `localStorage` is _not_ secure for real-world public elections.
- For production:
  - Move storage to a trusted backend (e.g., Supabase, Firebase, Postgres) with encryption.
  - Use proper authentication (hashed passwords on server, salted).
  - Use TLS (HTTPS) and secure hosting.
  - Use server-side verification for votes and OTPs (don’t rely on client-only OTP).
  - Store photos on a file store (S3) rather than Base64 in localStorage.
  - Audit access and consider role-based access control.

---

## How to hand organizations their IDs & passwords
1. Create org as Owner.
2. Copy the generated Org ID and EC password.
3. Deliver via a secure channel (email, WhatsApp, printed letter).
4. If EC loses password: Owner can reset the EC password (Owner dashboard → key icon).

---

## How to share public results (recommended)
- Org Admin → QR & Public → Generate Token → Enable Public → Copy Public Link.
- To embed in a webpage, use the `embed=1` variant and set iframe height to at least 500–700 px.
- Regenerate the token to invalidate old public links.

---

## Troubleshooting
- If you accidentally delete an item: use the Undo (recent deletes stored in local session until reload).
- If sessions behave oddly: clear `localStorage` (developer tools) to reset everything.
- To back up data: open the browser console and run:
```js
localStorage.getItem('multi_org_voting_root_v3')
