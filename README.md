# Vaultix - Zero-Knowledge Password Manager

Vaultix is a highly secure, offline-capable, zero-knowledge password and credential manager. It is designed to run entirely in the browser as a static Progressive Web App (PWA) with a serverless backend powered by Supabase.

Because of its zero-knowledge architecture, **your Master Password and unencrypted data never leave your device**. Even if the database is compromised, your passwords remain mathematically impossible to read without your Master Password.

---

## 🚀 Features & Concepts

### 1. Zero-Knowledge Encryption (The Core)
All encryption and decryption happen locally in the browser using the Web Crypto API.
*   **Concepts Used**: Envelope Encryption, Key Derivation, Symmetric Encryption.
*   **How it works**:
    1.  When you set up your vault, the app generates a random 256-bit **Data Key**.
    2.  It uses `PBKDF2` (with a random salt and 100,000 iterations) to derive a Key Encryption Key (KEK) from your **Master Password**.
    3.  The Data Key is encrypted (wrapped) using the KEK via `AES-KW` (Key Wrap).
    4.  Only the *wrapped* Data Key is sent to Supabase. Your Master Password is never saved.
    5.  When you add a credential, it is encrypted using the raw Data Key via `AES-GCM` before being sent to the database.

### 2. Emergency Recovery Flow
If you forget your Master Password, you are not permanently locked out, provided you saved your Recovery Phrase.
*   **Concepts Used**: BIP39-style Wordlists, Cryptographic Key Wrapping.
*   **How it works**: During setup, a 12-word Recovery Phrase is generated. A second KEK is derived from this phrase, and a *second copy* of the Data Key is wrapped with it. If you forget your Master Password, you can use the Recovery Phrase to unwrap the Data Key and create a brand new Master Password.

### 3. Serverless Backend & Authentication
Vaultix does not have a traditional Node.js/Python backend server.
*   **Tech Used**: Supabase, PostgreSQL, Row Level Security (RLS).
*   **How it works**: The frontend connects directly to Supabase via `@supabase/supabase-js`. You log in using standard Email/Password authentication. Supabase issues a secure JWT token to your browser. The PostgreSQL database uses strict RLS policies to ensure that even though the frontend talks directly to the database, a user can only ever `SELECT`, `INSERT`, `UPDATE`, or `DELETE` rows that belong to their specific `user_id`.

### 4. Fully Offline Capable (PWA & IndexedDB)
You can view your passwords even on an airplane with no internet.
*   **Tech Used**: `vite-plugin-pwa`, Service Workers, `idb-keyval` (IndexedDB).
*   **How it works**: Service workers cache the HTML, CSS, and JS files so the app loads offline. Meanwhile, `idb-keyval` instantly caches every encrypted row fetched from Supabase into your browser's local IndexedDB. When offline, the app reads the encrypted cache, asks for your Master Password, and decrypts your vault locally. Note: **Unencrypted data is never cached to disk.**

### 5. Expanded Credentials & Nested Folders
Vaultix supports complex organizational structures and a wide array of credential types.
*   **Tech Used**: React State, JSON Serialization.
*   **How it works**: The encryption function accepts a flexible JSON payload. Instead of creating database columns for every possible field (Phone, API Key, Token, etc.), Vaultix simply builds a JSON object containing only the fields you filled out, encrypts the entire object as a single string, and saves it. Folders support infinite nesting via a `parent_id` relationship.

### 6. Export & Import Backups
Total ownership of your data.
*   **Tech Used**: Web Blob API, File Reader API.
*   **How it works**:
    *   **Export**: Clicking "Export Backup" downloads a `.json` file containing a snapshot of your `wrapped_keys`, `folders`, and `credentials`. This file is completely encrypted and safe to store on a USB drive or Google Drive.
    *   **Import**: If your database is wiped, you can upload this `.json` file on the Setup screen. The app parses it and pushes all rows back up to Supabase to seamlessly restore your vault.

### 7. Responsive Mobile-First UI
*   **Tech Used**: React (`lucide-react` for icons), Vanilla CSS.
*   **How it works**: The UI uses CSS Grid and Flexbox for a clean, dark-mode-first aesthetic. On mobile devices, the side-by-side layout automatically converts to a slide-in off-canvas hamburger menu, ensuring the vault is highly usable on small touch screens. Sensitive fields are masked by default with easy "Eye" and "Copy" buttons.

---

## 📖 Application Workflow (UX)

1.  **Sign Up / Log In**: The user authenticates with Supabase using their Email and Password.
2.  **Setup (First Time Only)**: If the user's database is empty, they are forced to create a **Master Password**. The app generates their encryption keys, saves the wrapped keys to Supabase, and shows them their 12-word Recovery Phrase.
3.  **Unlock**: If the user has a vault, they are prompted for their Master Password. The app unwraps the Data Key and holds it securely in RAM.
4.  **The Vault**: The main dashboard. The user can create folders, nest them, and add credentials. The UI only displays the fields the user actually filled out.
5.  **Auto-Lock**: If the user is inactive for 5 minutes, or manually clicks "Lock", the decrypted Data Key is instantly purged from RAM, and the user is kicked back to the Unlock screen.

---

## 🛠️ Technology Stack

*   **Frontend Framework**: React 18 (with TypeScript)
*   **Build Tool**: Vite
*   **Routing**: React Router (`HashRouter` for GitHub Pages compatibility)
*   **Styling**: Vanilla CSS (`index.css`)
*   **Icons**: Lucide React
*   **Backend / Database**: Supabase (PostgreSQL)
*   **Cryptography**: Native Web Crypto API (`window.crypto.subtle`)
*   **Offline Storage**: IndexedDB via `idb-keyval`
*   **PWA**: `vite-plugin-pwa`

---

## 📦 Deployment (GitHub Pages)

Because Vaultix relies entirely on Supabase for the backend, the frontend is a pure static site that can be hosted for free on GitHub Pages.

1.  **HashRouter**: The app uses `HashRouter` instead of `BrowserRouter`. This prevents 404 errors on GitHub Pages when a user refreshes the page on a specific route (like `/vault`).
2.  **Environment Variables**: Only non-sensitive keys (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) are bundled into the frontend. The direct Postgres connection string is strictly kept out of the frontend.
3.  **Deploying**:
    *   Run `npm run build` to generate the static files in the `/dist` folder.
    *   Push the contents of the `/dist` folder to the `gh-pages` branch of your GitHub repository.

---

## 📱 Installing the PWA (Mobile & Desktop)

Vaultix is a Progressive Web App, meaning it can be "installed" to your device and run like a native application, complete with an app icon and no browser address bar.

*   **On Desktop (Chrome/Edge)**: Navigate to the hosted Vaultix URL. Look for a small "Install" icon (a screen with a down arrow) on the far right side of the URL address bar. Click it to install Vaultix to your computer.
*   **On iOS (Safari)**: Navigate to the URL in Safari. Tap the "Share" icon at the bottom of the screen, scroll down, and tap **"Add to Home Screen"**.
*   **On Android (Chrome)**: Navigate to the URL in Chrome. A banner may pop up at the bottom saying "Add Vaultix to Home screen." If not, tap the three-dot menu icon in the top right and select **"Install app"** or **"Add to Home screen"**.
