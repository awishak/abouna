#!/bin/zsh
# Makes a new password for watchabouna.com/signups, saves it in the abouna
# Vercel project as ABOUNA_ADMIN_PASSWORD (production), and puts it on the
# clipboard. The password is never printed. Vercel does not show the value
# again afterwards, so paste it into a password manager straight away.
#
# The host links handed to priests do not change: those are made from
# ABOUNA_ADMIN_CODE, which this leaves alone.
#
# The site picks the new password up on the next deploy (any push to main).
#   zsh scripts/new-password.sh
set -e
cd /Users/ishak/Projects/abouna
NEW=$(LC_ALL=C tr -dc 'a-hj-km-np-z2-9' < /dev/urandom | head -c 14)
vercel env rm ABOUNA_ADMIN_PASSWORD production --yes >/dev/null 2>&1 || true
printf '%s' "$NEW" | vercel env add ABOUNA_ADMIN_PASSWORD production >/dev/null 2>&1
vercel env ls production 2>/dev/null | grep -E 'ABOUNA_ADMIN_PASSWORD' | awk '{print $1, "set for", $3}'
printf '%s' "$NEW" | pbcopy
echo "new password is on the clipboard, ${#NEW} characters"
