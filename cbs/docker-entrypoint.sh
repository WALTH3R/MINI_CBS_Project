#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ "${SEED_DEMO_DATA:-0}" = "1" ]; then
  python manage.py seed_demo_data
fi

exec gunicorn cbs.wsgi:application --bind 0.0.0.0:8000 --workers 3
