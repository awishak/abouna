// The screenings people can sign up for: one entry per screening with a date.
// The id sits in the Sign up link on the home page (/rsvp?s=<id>) and in every
// saved row, so it never changes once a row exists. Rows on the home page with
// no date yet stay on Notify me and are not listed here. To open sign-ups for a
// new screening: add it here, then swap that row's Notify me for a Sign up link.
export const SCREENINGS = [
  {
    id: 'ny-2026-11-06',
    city: 'New York, NY',
    date: '2026-11-06',
    when: 'Friday, November 6',
    venue: 'Beacon of Faith Conference',
    note: 'Venue and time to be announced. Q&A with the director after the film.',
    open: true
  }
];

export const ID = /^[a-z0-9-]{3,40}$/;

export function find(id) {
  return SCREENINGS.find((s) => s.id === id) || null;
}
