# Level 2 — Login Authentication System

A Node.js/Express demonstration of account registration, login, and a protected dashboard. Registration data is stored in a local JSON file; passwords are salted and hashed with Node.js `crypto.scrypt`. The browser never stores passwords or session identifiers in JavaScript storage.

## Features

- Registration with username, email, and password checks
- Duplicate username/email detection
- Password length and numeric-character validation
- Unique random salts and `scrypt` password hashes
- Neutral incorrect-login message
- `HttpOnly`, `SameSite=Lax` session cookie and protected dashboard route
- Session ID regeneration on login and registration; logout destroys the session

## Run locally (PowerShell)

Requires Node.js 20 or newer.

1. Open a terminal in this folder.
2. Install dependencies: `npm install`
3. Generate an ephemeral development session secret and start the app:

   ```powershell
   $env:SESSION_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
   npm start
   ```

4. Open `http://localhost:3000`.
5. Choose **Create account**, register a demo account, and confirm the protected dashboard opens.
6. Sign out. Open `http://localhost:3000/dashboard` directly; it should redirect to sign-in.
7. Test the checks with `npm test`.

The generated secret exists only in that terminal session. The account file is created under `data/users.json` and is ignored by Git.

## Important limitations

This is an internship demo, not a production identity service. Express's default in-memory session store loses sessions when the server restarts and is not suitable for production. Use HTTPS, a production session store, rate limiting, CSRF defenses, secure secret management, and an audited database before deploying real accounts. Do not reuse a personal password for the demo.
