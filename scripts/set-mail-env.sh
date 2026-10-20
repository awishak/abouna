#!/bin/zsh
# Puts the three values api/request.js needs to email Andrew a screening request
# into the abouna Vercel project: RESEND_API_KEY (copied from fieldtime/.env, the
# Resend account he already has), RESEND_FROM (an address at the domain verified
# there; change it to an @watchabouna.com address once that domain is verified in
# Resend) and ABOUNA_NOTIFY (where the email goes). Prints names only, never the
# key. A deploy after this picks the values up.
#   scripts/set-mail-env.sh [notify-address]
set -e
cd /Users/ishak/Projects/abouna
SRC=/Users/ishak/Projects/fieldtime/.env
KEY=$(grep "^RESEND_API_KEY=" "$SRC" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
if [ -z "$KEY" ]; then echo "no RESEND_API_KEY in $SRC"; exit 1; fi
FROM="Abouna <abouna@fieldtime.net>"
TO="${1:-andrewishak@gmail.com}"
for ENV in production preview development; do
  printf '%s' "$KEY" | vercel env add RESEND_API_KEY "$ENV" >/dev/null 2>&1 || echo "RESEND_API_KEY $ENV: already set or failed"
  printf '%s' "$FROM" | vercel env add RESEND_FROM "$ENV" >/dev/null 2>&1 || echo "RESEND_FROM $ENV: already set or failed"
  printf '%s' "$TO" | vercel env add ABOUNA_NOTIFY "$ENV" >/dev/null 2>&1 || echo "ABOUNA_NOTIFY $ENV: already set or failed"
done
echo "from: $FROM"
echo "to: $TO"
vercel env ls 2>/dev/null | grep -E 'RESEND_API_KEY|RESEND_FROM|ABOUNA_NOTIFY' | awk '{print $1, $3}'
