Mini CBS

A small core banking system built with Django REST Framework. Agents enroll customers, customers hold a wallet each, and money moves between them through deposits, transfers, and bill payments

Features

- Customer & wallet management — agents register customers (KYC : name, parent name, DOB, marital status, place of birth, national ID) and each customer gets a wallet automatically, tied to a limits-and-currency wallet profile.

- Deposits — agents deposit cash into a customer's wallet; only the owning customer can view their deposit history.

- Wallet-to-wallet transfers — customers send money to each other by tag, blocked on insufficient balance or mismatched currencies.

- Bill payments — customers pay registered service providers (electricity, water, internet, etc.) by tag. Declined payments (insufficient balance, inactive provider, over limit) are recorded as failed transactions with a reason, not rejected outright.

- Reporting — agents can pull a customer's full transaction history, filterable by type/status/date, plus rollup statistics (total deposited, transferred, paid in bills, transaction count).

Technologies used:

- Python 3 / Django 5
- Django REST Framework
- `djangorestframework-simplejwt` for JWT authentication
- PostgreSQL
- GIT
- Docker
- Angular 17

Steps to run the project :

```bash
git clone https://github.com/WALTH3R/MINI_CBS_Project.git
cd MINI_CBS_Project

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

cd cbs
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
npx ng serve
```

The API is now at `http://127.0.0.1:8000/`.

The Front End runs on 'http://localhost:4200/'. (For the Admin Page, use the Django Admin Panel at)

The Different roles of the Users and steps are :

- Admin : Create a superuser and log in to the admin panel at `/admin/` to create agents, customers, and service providers.
- Agent : Log in at `/api-auth/login/` to create customers and deposit money into their wallets.
- Customer : Log in at `/api-auth/login/` to view their wallet balance, transfer money to other customers, and pay bills to service providers.
- Service Provider : Log in at `/api-auth/login/` to view their bill payment history.

You can also browse the API in a browser: log in at `/api-auth/login/`

You can view the API documentation by using the file CBS.swagger.json or by visiting https://vkatz5ow8z.apidog.io

Some Sources :

- For the Front End Design (https://dribbble.com/shots/27075109-NovaBank-Dashboard-Bank-Design) or view the templates in the "stitch_novabank_dashboard" folder
- For the API Documentation (https://apidog.io/)
