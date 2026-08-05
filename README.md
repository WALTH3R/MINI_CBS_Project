Mini CBS

A small core banking system built with Django REST Framework and an Angular front end. Agents enroll customers, customers hold a wallet each, and money moves between them through deposits, transfers, and bill payments. Admins get a full in-app console on top: account management, transaction oversight, and a system-wide audit trail.

Features

- Customer & wallet management — agents (or an admin) register customers (KYC : name, parent name, DOB, marital status, place of birth, national ID) and each customer gets a wallet automatically, tied to a limits-and-currency wallet profile.

- Deposits — agents deposit cash into a customer's wallet; only the owning customer can view their deposit history.

- Wallet-to-wallet transfers — customers send money to each other by tag, blocked on insufficient balance or mismatched currencies.

- Bill payments — customers pay registered service providers (electricity, water, internet, etc.) by tag. Declined payments (insufficient balance, inactive provider, over limit) are recorded as failed transactions with a reason, not rejected outright.

- Reporting — agents (and admins) can pull a customer's full transaction history, filterable by type/status/date, plus rollup statistics (total deposited, transferred, paid in bills, transaction count). Admins can also pull everything one agent has personally performed.

- Admin console — an in-app dashboard (not just the Django admin) for managing agents, merchants, wallet profiles, and the customer directory, plus activating/deactivating any customer or agent account.

- Idempotency keys — deposits, transfers, and payments require an `Idempotency-Key` header; retrying the same request (e.g. after a network timeout) replays the original result instead of double-charging.

- Login protection — rate-limited to 5 attempts/minute per IP, and logging out actually invalidates the refresh token server-side (blacklisted, not just dropped client-side).

- System-wide audit trail — every state-changing request (POST/PUT/PATCH/DELETE) is logged with the actor, timestamp, IP, user agent, and a correlation request ID, browsable by admins in-app.

- Dark / light mode, with the preference remembered per browser.

- Pagination — long lists (merchants, transaction history) load 20 at a time with a "Load more" control instead of returning everything at once.

Technologies used:

- Python 3 / Django 5
- Django REST Framework
- `djangorestframework-simplejwt` for JWT authentication (including refresh-token blacklisting on logout)
- PostgreSQL (via Docker locally, Neon in production)
- Angular 21
- Vitest, Angular's native test runner, for frontend unit tests
- GIT
- Apidog
- Docker

Steps to run the project :

```bash
git clone https://github.com/WALTH3R/MINI_CBS_Project.git
cd MINI_CBS_Project

# copy .env.example to .env and fill in SECRET_KEY / DB_* before continuing

docker compose up -d

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd cbs
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

In a second terminal:

```bash
cd frontend
npm install
npx ng serve
```

The API is now at `http://127.0.0.1:8000/`.

The Front End runs at `http://localhost:4200/`. Log in there with any role's credentials — an admin lands on the same app with extra screens (Agents, Merchants, Wallet profiles, Customers, Audit Log).

The Different roles of the Users and steps are :

- Admin : Log in at `http://localhost:4200/login` with a superuser account (`createsuperuser`) to manage agents, merchants, wallet profiles, and customer accounts, review any customer's or agent's transaction history, and browse the audit trail — all in-app. The Django admin panel at `/admin/` still works too.
- Agent : Log in at `http://localhost:4200/login` to enroll customers and deposit money into their wallets.
- Customer : Log in at `http://localhost:4200/login` to view their wallet balance, transfer money to other customers, and pay bills to service providers.

Merchants (service providers — electricity, water, internet, etc.) don't have their own login; they're set up and managed by an agent or admin, and customers pay them by tag.

You can also browse the API directly: log in at `/api-auth/login/`

You can view the API documentation by using the file CBS.swagger.json or by visiting https://vkatz5ow8z.apidog.io

Some Sources :

- For the Front End Design (https://dribbble.com/shots/27075109-NovaBank-Dashboard-Bank-Design) or view the templates in the "stitch_novabank_dashboard" folder
- For the API Documentation (https://apidog.io/)

Hosted on : https://mini-cbs-project.onrender.com/
