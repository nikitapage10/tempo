# TEMPO — connecting Google and Microsoft sign-in

The login screen shows **Continue with Google** and **Continue with Microsoft**.
Those buttons call Supabase OAuth. Until each provider is turned on in Supabase
(and registered with that vendor), the button will toast something like
“sign-in isn’t turned on yet.”

Apple Sign In is not offered in the UI right now; the Apple section below is
kept only as a reference if you add it later.

Production site: `https://tempo-ten-sigma.vercel.app`  
Auth callback TEMPO uses: `https://tempo-ten-sigma.vercel.app/auth/callback`

**TEMPO Desktop:** Google / Microsoft sign-in opens in your **system browser**
(so providers don’t flag Electron as an insecure embedded app). After you
finish, the browser hits `/auth/desktop-bridge`, which hands the one-time
code back to the app via `tempo://auth/callback`. The code is exchanged
**inside** Electron so session cookies land in TEMPO, not Chrome/Edge.

Add this redirect URL in Supabase as well as `/auth/callback`:
- `https://tempo-ten-sigma.vercel.app/auth/desktop-bridge`
- `https://tempo-ten-sigma.vercel.app/auth/desktop-bridge?**` (if wildcards work)

Do this once per provider. Localhost testing needs the same redirect URLs with
`http://localhost:3000` instead of the production host.

---

## 0. Supabase redirect allow-list (do this first)

1. Open **Supabase → Authentication → URL Configuration**.
2. **Site URL:** `https://tempo-ten-sigma.vercel.app`
3. **Redirect URLs** — add at least:
   - `https://tempo-ten-sigma.vercel.app/auth/callback`
   - `https://tempo-ten-sigma.vercel.app/auth/callback?**` (if your project
     allows wildcards; otherwise add exact URLs you use with `?next=…`)
   - `https://tempo-ten-sigma.vercel.app/auth/desktop-bridge`
   - `https://tempo-ten-sigma.vercel.app/auth/desktop-bridge?**`
   - For local: `http://localhost:3000/auth/callback` and
     `http://localhost:3000/auth/desktop-bridge`
4. Save.

Password-reset emails also land on `/auth/callback?next=/reset-password`, so
that callback host must be allowed too.

---

## 1. Google

### A. Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create or
   pick a project.
2. **APIs & Services → OAuth consent screen** — configure (External is fine for
   testing; add yourself as a test user while in Testing).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Authorized JavaScript origins:
   - `https://tempo-ten-sigma.vercel.app`
   - `http://localhost:3000` (dev)
6. Authorized redirect URIs — **must be the Supabase callback**, not TEMPO’s:
   - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
   - Find the exact URL in Supabase → Authentication → Providers → Google
     (Supabase shows it).
7. Copy the **Client ID** and **Client secret**.

### B. Supabase
1. **Authentication → Providers → Google** → Enable.
2. Paste Client ID and Client secret.
3. Save.
4. Try **Continue with Google** on `/login`.

---

## 2. Microsoft (Azure / Entra ID)

Supabase calls this provider **`azure`** — TEMPO’s button already uses that id.

### A. Azure Portal
1. [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** →
   **App registrations → New registration**.
2. Name: e.g. `TEMPO`.
3. Supported account types: usually
   **Accounts in any organizational directory and personal Microsoft accounts**.
4. Redirect URI — type **Web**, value:
   `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
5. Register. Copy **Application (client) ID**.
6. **Certificates & secrets → New client secret** — copy the **Value** once
   (not the Secret ID). If you paste the Secret ID into Supabase you’ll get
   `Unable to exchange external code`.
7. **API permissions → Add a permission → Microsoft Graph → Delegated**:
   `openid`, `email`, `profile`, `offline_access`, `User.Read`. Then
   **Grant admin consent** if the button is available.
8. **Token configuration → Optional claims → Add → ID** — add `email`
   (and optionally `preferred_username`). Save.
9. Confirm **Authentication** redirect is **Web** (not SPA):
   `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`

### B. Supabase
1. **Authentication → Providers → Azure** → Enable.
2. Paste Client ID and the secret **Value**.
3. Azure Tenant URL: `https://login.microsoftonline.com/common` for “any
   Microsoft account” (or your tenant id for single-tenant apps).
4. Leave **Allow users without an email** off unless you truly need it —
   TEMPO expects an email. Prefer fixing Azure permissions/scopes instead.
5. Save.
6. Try **Continue with Microsoft** on `/login`.

If login reaches Microsoft then fails with **Error getting user email from
external provider**, re-check steps 7–8 above and that TEMPO is deployed with
the Azure `email` scope request (v0.81.1+).

---

## 3. Apple

Apple is the pickiest (paid Apple Developer account required).

### A. Apple Developer
1. [Apple Developer](https://developer.apple.com/account) → **Certificates,
   Identifiers & Profiles**.
2. **Identifiers → App IDs** — enable **Sign In with Apple** for your App ID
   (even if the web service is primary).
3. **Identifiers → Services IDs → (+)** — create a Services ID (this is the
   OAuth client id string). Enable **Sign In with Apple** → Configure.
4. Domains and Return URLs:
   - Domain: `YOUR-PROJECT-REF.supabase.co`
   - Return URL: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
5. **Keys → (+)** — create a key with **Sign In with Apple**, download the
   `.p8` once. Note Key ID and your Team ID.

### B. Supabase
1. **Authentication → Providers → Apple** → Enable.
2. Fill Services ID, Team ID, Key ID, and the `.p8` private key contents.
3. Save.
4. Try **Continue with Apple** on `/login`.

Apple often requires HTTPS and correctly registered domains; localhost testing
is harder than Google — prefer production/preview HTTPS URLs when debugging.

---

## 4. Quick verify checklist

- [ ] Supabase redirect allow-list includes TEMPO `/auth/callback` and
      `/auth/desktop-bridge` (desktop system-browser return)
- [ ] Provider enabled in Supabase with correct secrets
- [ ] Vendor console redirect URI is **Supabase** `/auth/v1/callback`, not
      `tempo-ten-sigma.vercel.app/auth/callback`
- [ ] Button on `/login` redirects to the provider and returns to TEMPO signed in
- [ ] A brand-new OAuth user still respects your invite/register rules if you
      gate sign-ups — today OAuth is on the login screen; if you need
      invite-only for OAuth too, say so and we can tighten that separately

---

## 5. Common failures

| Symptom | Likely cause |
|--------|----------------|
| “Provider is not enabled” toast | Provider toggle still off in Supabase |
| Redirect / `redirect_uri_mismatch` | Vendor console has TEMPO URL instead of Supabase callback |
| Works locally, fails in prod | Prod redirect URL missing from Supabase allow-list or vendor console |
| Apple errors on localhost | Use HTTPS production/preview; Apple is strict |

No TEMPO code change is required to “turn on” a provider once Supabase + the
vendor app are configured — the existing `OAuthButtons` component will start
completing successfully.
