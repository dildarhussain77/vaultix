# Vaultix - Zero-Knowledge Password & Credential Manager

Vaultix is a production-grade, highly secure, offline-first, zero-knowledge credential manager. It runs entirely in the browser as an installable Progressive Web App (PWA) with a serverless backend powered by Supabase.

Because of its zero-knowledge architecture, **your Master Password and unencrypted data never leave your device**. Even if the database or server is fully compromised, your passwords remain mathematically impossible to read without your Master Password.

---

## 🚀 Complete Feature Overview & Cryptographic Architecture

### 1. Zero-Knowledge Envelope Encryption (Core)
All encryption and decryption execute locally in the browser using the browser's hardware-accelerated Web Crypto API.
*   **Concepts Used**: Envelope Encryption, Key Derivation, Symmetric Encryption, PBKDF2, AES-KW, AES-GCM.
*   **How it works**:
    1.  When setting up your vault, the app generates a cryptographically secure, random 256-bit **Data Key**.
    2.  It derives a Key Encryption Key (KEK) from your **Master Password** using `PBKDF2` with a unique 16-byte salt and **300,000 SHA-256 iterations**.
    3.  The Data Key is encrypted (wrapped) using the KEK via `AES-KW` (Key Wrap).
    4.  Only the *wrapped* Data Key and salt are stored in Supabase. Your Master Password is never saved, transmitted, or logged.
    5.  When you add or update any credential, the payload is encrypted locally with the raw Data Key using `AES-GCM 256-bit` (with a unique 12-byte initialization vector) before being sent to the database.

### 2. Emergency Recovery & Phrase Regeneration
If you forget your Master Password, you can recover full access to your vault using a 12-word recovery phrase.
*   **Concepts Used**: BIP39-style Wordlist derivation, Cryptographic Re-wrapping.
*   **How it works**:
    *   During setup, a 12-word Recovery Phrase is generated. A second KEK is derived from this phrase using `PBKDF2` (100,000 iterations), wrapping a duplicate copy of the Data Key (`wrapped_data_key_rp`).
    *   **Recovery Flow**: If you forget your Master Password, you enter the 12 words on the Recovery screen to unwrap the Data Key and set a brand new Master Password.
    *   **Phrase Regeneration**: If you lose your paper copy or suspect it was compromised, navigate to `Settings > Backup & Recovery > Regenerate Phrase`. This creates 12 new words, updates the cloud recovery lock, and completely invalidates the old phrase.

### 3. Native Device Biometrics (Fingerprint & Face ID)
Vaultix supports physical device biometrics via the W3C Web Authentication API (WebAuthn).
*   **Concepts Used**: WebAuthn Passkeys / Biometric Enclave Credentials.
*   **How it works**:
    *   You can turn on Biometrics in `Settings`. It generates a resident credential in your device's hardware security chip (Secure Enclave on iOS/macOS, Titan/TEE on Android/Windows).
    *   Enabling biometrics establishes **Two-Factor Physical Protection**: unlocking your vault on that device requires both your Master Password (knowledge factor) and your physical biometric verification (fingerprint or face).
    *   Device-specific: turning on biometrics on your phone does not affect your laptop; each device pairs independently.

### 4. Active Device Tracking & Remote Logout
Track every physical phone, tablet, or laptop that has signed into your account.
*   **Tech Used**: Supabase table (`user_devices`) with Row Level Security (RLS), persistent device IDs, User-Agent parsing.
*   **How it works**:
    *   Accessible via `Settings > Logged-in Devices` (`/devices`).
    *   Displays each session's device type (📱 Mobile vs 💻 Laptop), OS (Windows, Android, iOS, macOS, Linux), browser name, and active status.
    *   Highlights the active device with a green **"This Device"** badge and *"Active now"*.
    *   **Remote Logout**: Tap "Log out" next to any lost or old device. If that device is open, its background heartbeat automatically purges encryption keys from memory and signs the session out.

### 5. Two-Step Verification on New Devices (Email OTP)
Protects your account if someone discovers your email and account password.
*   **Tech Used**: Supabase `signInWithOtp` and `verifyOtp`.
*   **How it works**:
    *   **Known Devices**: Logging in on your regular phone or laptop proceeds directly with your Email + Password.
    *   **New Devices**: If you sign in from an unrecognized device or private browsing window, Vaultix detects the new device and sends a **6-digit verification code** to your email.
    *   Access is strictly gated until the 6-digit OTP code is confirmed, after which the device is registered into your authorized devices list.

### 6. 60-Second Clipboard Shield & 5-Minute Auto-Lock
Prevents credential leaks to malicious background apps or shoulder surfers.
*   **60-Second Clipboard Clear**: Whenever you copy a password, token, or secret, Vaultix starts a 60-second timer. After 60 seconds, the clipboard is wiped and an informative toast confirms the purge.
*   **Focus-Aware Clearing**: If you switch to another tab or app to paste, Vaultix checks the elapsed time the moment you return; if 60 seconds have passed, it clears the clipboard immediately.
*   **5-Minute Inactivity Auto-Lock**: If you leave Vaultix open without touching it for 5 minutes, or manually tap "Lock Vault", all decrypted keys are immediately wiped from RAM and the clipboard is cleared.

### 7. Encrypted JSON Backups (.json)
Total ownership and portability of your secrets.
*   **Tech Used**: Web Blob API, File Reader API.
*   **Export**: Generates a `.json` snapshot of your encrypted credentials, folders, and wrapped keys. All data inside is 100% encrypted with AES-256—no plain text passwords exist in the file, making it completely safe to store on cloud drives or flash drives.
*   **Import**: If you switch accounts or want to restore data, you can import this file from `Settings` to merge credentials and restore folder hierarchies.

### 8. Fully Offline Capable (PWA & IndexedDB)
Access your credentials without internet connectivity.
*   **Tech Used**: `vite-plugin-pwa`, Service Workers, `idb-keyval` (IndexedDB).
*   **How it works**: The service worker caches static assets so the app loads offline. Encrypted rows fetched from Supabase are cached into IndexedDB. When offline, you can open Vaultix, unlock with your Master Password, and decrypt your credentials locally. **Unencrypted data is never written to disk.**

### 9. Mobile-First Dark UI & Custom Modals
*   Glassmorphic dark design system (`--bg-primary: #121212`, `--accent-teal: #0d9488`, `--border-color: #333333`).
*   Zero native browser `alert()` or `confirm()` dialogs—all prompts use custom themed glassmorphic modals with error/warning badges.
*   Toast notification system for copy events, CRUD actions, and security alerts.
*   Dedicated **Security & User Guidelines** page (`/security-guide`) with plain-English structured documentation.

### 10. Native Security & System Notifications
Zero-tracker, 100% private security notifications without external SDKs or Firebase.
*   **Tech Used**: Web Notifications API (`window.Notification`).
*   **How it works**: Accessible and toggleable from `Settings > Alerts & Notifications`. When enabled, it delivers immediate system alerts on phone lock screens or laptop notification centers when:
    *   The vault is unlocked.
    *   A credential is created, edited, or deleted.
*   **In-App Notification Center**: Top-right bell icon on the dashboard displays unread alert badges, opening a slide-in notification drawer with timestamps and a "Clear All" option.

---

## 🔮 Future Roadmap (Admin Web Push & VAPID)

### Serverless Web Push Notifications (Background & Offline Delivery)
To enable broadcast and admin push notifications even when the user's browser or PWA is completely closed:
*   **Technology**: Standard **W3C Push API + VAPID keys** (`web-push` library via Supabase Edge Functions).
*   **No Firebase Needed**: Works natively with Apple Push Notification service (APNs for iOS Safari), Google FCM (native browser push for Chrome/Android), and Microsoft Windows Action Center.
*   **Implementation Plan**:
    1.  **Subscription**: The Service Worker (`sw.js`) registers a push subscription with `registration.pushManager.subscribe()`.
    2.  **Storage**: Push endpoints and keys (`endpoint`, `p256dh`, `auth`) are saved in a `user_push_subscriptions` Supabase table.
    3.  **Admin Broadcasting**: A Supabase Edge Function uses VAPID private keys to dispatch encrypted background payloads.
    4.  **Background Wakeup**: The device's Service Worker receives the `push` event and displays the notification banner even if Vaultix is closed.

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Frontend Framework** | React 18 (TypeScript) |
| **Build Tool** | Vite |
| **Routing** | React Router DOM (`HashRouter` for GitHub Pages support) |
| **Styling** | Vanilla CSS Design System (`index.css`) |
| **Icons** | Lucide React |
| **Backend / Database** | Supabase (PostgreSQL with Row Level Security) |
| **Cryptography** | Native Web Crypto API (`window.crypto.subtle`) |
| **Authentication** | Supabase Auth (Email/Password + 6-digit Email OTP) |
| **Biometrics** | WebAuthn API (`navigator.credentials`) |
| **Notifications** | Native Web Notifications API (`Notification`) |
| **Offline Cache** | IndexedDB via `idb-keyval` |
| **PWA Support** | `vite-plugin-pwa` + Service Workers |

---

## 🗄️ Database Schema & RLS Setup

Ensure the following tables and RLS policies are active in your Supabase SQL Editor:

```sql
-- 1. Wrapped Keys (Data Keys wrapped with Master Password & Recovery Phrase)
create table if not exists public.wrapped_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wrapped_data_key text not null,
  wrapped_data_key_rp text not null,
  salt text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.wrapped_keys enable row level security;
create policy "Users manage own wrapped keys" on public.wrapped_keys 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Folders
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.folders enable row level security;
create policy "Users manage own folders" on public.folders 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Credentials (Encrypted Blobs)
create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  folder_id uuid references public.folders(id) on delete set null,
  encrypted_data text not null,
  iv text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.credentials enable row level security;
create policy "Users manage own credentials" on public.credentials 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. User Devices (Active Sessions & Remote Logout)
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  device_id text not null,
  device_type text not null default 'desktop',
  os_name text not null default 'Unknown OS',
  browser_name text not null default 'Unknown Browser',
  last_active timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, device_id)
);
alter table public.user_devices enable row level security;
create policy "Users manage own devices" on public.user_devices 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## 🧪 Automated Testing & CI/CD Quality Assurance

Vaultix features an automated test suite powered by **Vitest** (the Vite-native equivalent to Python's `pytest`). Automated testing guarantees zero data loss, validates military-grade encryption, and prevents broken builds from reaching production.

### 1. Test Commands

| Command | Purpose | Equivalent in Python |
| :--- | :--- | :--- |
| `npm test` | Run all automated unit & integration tests once | `pytest` |
| `npm run test:watch` | Run tests in interactive watch mode on file change | `pytest -f` / `ptw` |
| `npm run build` | Verify TypeScript compilation (`tsc -b`) & bundle | `mypy . && python setup.py build` |

### 2. Files Involved in Automated Testing

*   **`src/lib/crypto.test.ts`**:
    *   Tests zero-knowledge Web Crypto primitives (PBKDF2 key derivation, AES-GCM envelope encryption, AES-KW key wrapping).
    *   Verifies 12-word recovery phrase generator.
    *   Verifies tamper resistance (tampered ciphertexts or wrong keys immediately fail decryption).
*   **`src/lib/folders.test.ts`**:
    *   Tests folder hierarchy logic and circular move prevention (e.g. blocking a folder from being moved into itself or into its own descendant subfolders).
*   **`src/lib/crypto.ts`**:
    *   Core encryption utility equipped with environment-agnostic `getCrypto()` supporting both browser and Node/Vitest environments.
*   **`.github/workflows/deploy.yml`**:
    *   GitHub Actions CI/CD pipeline that automatically executes `npm test` before building and deploying to GitHub Pages. If any test fails, deployment halts immediately.
*   **`package.json`**:
    *   Contains test runner configuration and dependencies (`vitest`).
*   **`tsconfig.app.json`**:
    *   Configures TypeScript build flags (`noUnusedLocals: false`, `noUnusedParameters: false`) ensuring clean, failure-free production builds.

### 3. All Critical Test Cases Covered

1. **Uint8Array / Base64 Conversion**: Ensures binary encryption buffers convert to and from base64 strings with zero data loss.
2. **Salt & IV Generation**: Confirms cryptographic randomness (16-byte salts and 12-byte IVs).
3. **12-Word Recovery Phrases**: Asserts proper length, uniqueness, and wordlist composition.
4. **PBKDF2 Key Derivation**: Guarantees identical master password + salt produces consistent AES-256 keys.
5. **AES-GCM Envelope Encryption/Decryption**: Ensures plaintext passwords never leak into ciphertexts and decrypt cleanly back into JSON objects.
6. **Key Wrapping & Unwrapping**: Validates master key wrapping with KEKs.
7. **Tamper & Invalid Key Rejection**: Verifies that unauthorized keys or altered ciphertexts are strictly rejected with an exception.
8. **Folder Hierarchy & Moving**: Confirms moving to Root (`null`), non-nested moves, and blocks circular loops.

---

## 📦 Verification & Production Build

### How to verify everything is working:

1. **Run Automated Tests**:
   ```bash
   npm test
   ```
   *Expected output*: All unit and cryptographic tests pass (`✓ 11 passed`).

2. **Verify Types & Build**:
   ```bash
   npm run build
   ```
   *Expected output*: Vite will compile TypeScript and bundle files into `/dist` with exit code `0` and 0 errors.

3. **Run Local Production Preview**:
   ```bash
   npm run preview
   ```
   *Test*: Open the preview URL (usually `http://localhost:4173/`).

3. **Check Production Deployment (GitHub Actions / Pages)**:
   - Commit and push your changes to `main`:
     ```bash
     git add .
     git commit -m "feat: complete production security suite"
     git push origin main
     ```
   - In GitHub &rarr; **Actions**, watch the deploy workflow build and publish to GitHub Pages.

---

## 📱 Installing the PWA (Mobile & Desktop)

*   **On Desktop (Chrome/Edge/Brave)**: Click the "Install" icon on the right side of the browser URL bar.
*   **On iOS (Safari)**: Tap the Share icon &rarr; select **"Add to Home Screen"**.
*   **On Android (Chrome)**: Tap the three dots &rarr; select **"Install app"** or **"Add to Home screen"**.
