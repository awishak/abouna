#!/bin/zsh
# Copies the two Supabase values from encore/.env into the abouna Vercel project
# and makes a fresh admin code. Prints only the admin code and the names set.
set -e
cd /Users/ishak/Projects/abouna
SRC=/Users/ishak/Projects/encore/.env
val() { grep "^$1=" "$SRC" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }
URL=$(val SUPABASE_URL)
KEY=$(val SUPABASE_SERVICE_ROLE_KEY)
if [ -z "$URL" ] || [ -z "$KEY" ]; then echo "missing supabase values"; exit 1; fi
CODE=$(openssl rand -base64 18 | tr -dc 'a-z0-9' | head -c 14)
for ENV in production preview development; do
  printf '%s' "$URL" | vercel env add SUPABASE_URL "$ENV" >/dev/null 2>&1 || echo "SUPABASE_URL $ENV: already set or failed"
  printf '%s' "$KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY "$ENV" >/dev/null 2>&1 || echo "SUPABASE_SERVICE_ROLE_KEY $ENV: already set or failed"
  printf '%s' "$CODE" | vercel env add ABOUNA_ADMIN_CODE "$ENV" >/dev/null 2>&1 || echo "ABOUNA_ADMIN_CODE $ENV: already set or failed"
done
echo "ADMIN_CODE=$CODE"
vercel env ls 2>/dev/null | grep -E 'SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|ABOUNA_ADMIN_CODE' | awk '{print $1, $3}'
