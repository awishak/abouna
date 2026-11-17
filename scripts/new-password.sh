#!/bin/zsh
# Sets the password for watchabouna.com/signups: the one you give it, or a
# made-up one when you give none. Saves it in the abouna
# Vercel project as ABOUNA_ADMIN_PASSWORD (production), and puts it on the
# clipboard. The password is never printed. Vercel does not show the value
# again afterwards, so paste it into a password manager straight away.
#
# The host links handed to priests do not change: those are made from
# ABOUNA_ADMIN_CODE, which this leaves alone.
#
# The site picks the new password up on the next deploy (any push to main).
#   zsh scripts/new-password.sh 'the password you want'
#   zsh scripts/new-password.sh            (makes one up)
set -e
cd /Users/ishak/Projects/abouna
NEW="$1"
if [ -z "$NEW" ]; then NEW=$(LC_ALL=C tr -dc 'a-hj-km-np-z2-9' < /dev/urandom | head -c 14); fi
if [ ${#NEW} -lt 8 ] || [ ${#NEW} -gt 80 ]; then echo "the password has to be 8 to 80 characters"; exit 1; fi
vercel env rm ABOUNA_ADMIN_PASSWORD production --yes >/dev/null 2>&1 || true
printf '%s' "$NEW" | vercel env add ABOUNA_ADMIN_PASSWORD production >/dev/null 2>&1
vercel env ls production 2>/dev/null | grep -E 'ABOUNA_ADMIN_PASSWORD' | awk '{print $1, "set for", $3}'
printf '%s' "$NEW" | pbcopy
echo "new password is on the clipboard, ${#NEW} characters"
