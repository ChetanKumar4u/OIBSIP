# Pizza Studio — Level 3 Full-Stack Project

A responsive pizza-ordering application built for the Oasis Infobyte Web Development & Designing assessment. Customers can customize a pizza, manage a cart, create an account, verify their email, pay in test mode, and follow order progress. Staff use a separate admin portal to manage stock and move orders through fulfillment.

## Assessment requirements covered

- **React customer app:** featured menu, ingredient customizer, cart, INR totals, customer accounts, and order tracking.
- **Express and MongoDB API:** user accounts, email verification, password reset, catalog, orders, stock, and role-protected admin routes.
- **Authentication and roles:** bcrypt password hashes, expiring hashed email/reset tokens, JWT in an HttpOnly cookie, customer/admin authorization, request limits, and input validation.
- **Admin portal:** inventory and low-stock threshold updates, availability controls, order status workflow, and scheduled low-stock email notifications.
- **Payments:** optional Razorpay checkout and server-side HMAC signature verification. When Razorpay keys are not set in development, a prominently labeled local simulator is provided; it does not charge money and is disabled in production.
- **Responsive, accessible UI:** semantic forms and headings, keyboard-operable controls, status feedback, and mobile layouts.

## Requirements

- Node.js 20 or newer and npm
- MongoDB Community Server running locally, or a MongoDB connection string
- Optional for real email delivery: SMTP account
- Optional for payment-provider checkout: Razorpay test-mode API keys

## Run locally (Windows PowerShell)

From the repository root:

```powershell
Set-Location .\WebDev-L3-PizzaDelivery
npm install
Copy-Item .env.example .env
```

Edit `.env` and set `JWT_SECRET` to a random secret of at least 32 bytes. Generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` in `.env`, then create/update the admin account:

```powershell
npm run seed:admin
```

Start the client and API:

```powershell
npm run dev
```

Open <http://localhost:5173>. The API listens at <http://127.0.0.1:5000>. The API seeds the starter ingredient catalog in MongoDB on startup.

### Local demo without external accounts

Without SMTP credentials, verification and reset links are written to the API terminal and shown as development links in the UI. Without Razorpay keys, the checkout explicitly identifies itself as a local test simulator; its button marks the order paid for demonstration only. Set the email used for admin notifications with `ADMIN_EMAIL`.

### Razorpay test checkout

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to Razorpay **test-mode** credentials in `.env`, restart the API, and use the checkout flow. The secret stays on the server; only the public key ID is returned to the browser. The browser checkout result is verified against the server-side signature before an order is marked paid.

### Optional SMTP

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in `.env`. Password reset and verification links are single-use and expire. SMTP credentials and payment keys must never be committed.

## Demo walkthrough

1. Register a customer from the home page.
2. In development, open the verification link shown in the UI or API terminal; with SMTP configured, use the delivered email.
3. Sign in, add a preset pizza, or build a custom pizza with a base, sauce, cheese, and vegetable toppings.
4. Change quantities in the bag and continue to checkout.
5. Complete the local demo payment or Razorpay test checkout. Confirm the order is visible in tracking.
6. Visit `/admin`, sign in with the seeded administrator, update stock and thresholds, and move paid orders from received → kitchen → out for delivery → delivered.
7. Set an ingredient below its threshold and wait for the scheduled low-stock notification job (runs every 15 minutes). In development, the notification is logged to the API terminal.

## Commands

Run from `WebDev-L3-PizzaDelivery`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite and Express in development |
| `npm run build` | Create the optimized React production build |
| `npm start` | Start the API (serves the built client when present) |
| `npm test` | Run focused API utility tests |
| `npm run seed:admin` | Create or update the administrator from `.env` |

## API overview

All endpoints are under `/api`.

| Group | Routes |
|---|---|
| Auth | `POST /auth/register`, `/auth/verify-email`, `/auth/verify-resend`, `/auth/login`, `/auth/admin/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/logout`; `GET /auth/me` |
| Catalog | `GET /catalog` |
| Orders | `GET /orders/mine`, `POST /orders`, `POST /orders/:id/cancel` |
| Payments | `POST /payments/:id/checkout`, `/payments/:id/razorpay/verify`; local-only `/demo-success` and `/demo-failure` |
| Admin | `GET /admin/inventory`, `PATCH /admin/inventory/:ingredientId`, `GET /admin/orders`, `PATCH /admin/orders/:id/status` |

Prices are integer paise in API responses and are formatted as INR by the client. The server calculates totals from the current ingredient catalog and atomically reserves each ingredient quantity before creating an order; a failed reservation is rolled back.

## Project structure

```text
client/                 React 19 + Vite customer and admin interfaces
server/src/routes/      Auth, catalog, order, payment, and admin APIs
server/src/models/      MongoDB user, ingredient, and order schemas
server/src/services/    Catalog, inventory, email, and low-stock job
server/src/utils/       Auth, pricing, and inventory calculations
server/test/            Focused Node test-runner unit tests
```

## Production and assessment notes

- Configure production SMTP, admin email, and Razorpay credentials; production startup rejects missing secrets and integrations.
- Use HTTPS in production; the session cookie is Secure in production and HttpOnly in all environments.
- Configure MongoDB backups and restrict admin credentials before deployment.
- The local payment simulator is for assessment demonstrations only, not a real payment system.
- Record and submit your own project demonstration, LinkedIn milestone, peer evaluation (if required), and official assessment form. Include this repository URL and a live demo URL if you deploy the app.
