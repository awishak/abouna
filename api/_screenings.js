// The screenings people can sign up for: one entry per screening with a date.
// The id sits in the Sign up link on the home page (/rsvp?s=<id>) and in every
// saved row, so it never changes once a row exists. Rows on the home page with
// no date yet stay on Notify me and are not listed here. To open sign-ups for a
// new screening: add it here, then swap that row's Notify me for a Sign up link.
// Andrew, 2026-10-14: New York is not ready for sign-ups, Keep me posted only.
// `open: false` keeps /rsvp closed until he says go; flip it and swap the button
// on the row. `tba: true` means the venue and time are still to come, and the
// register page says so after a sign-up. Fairfax opened 2026-10-20.
export const SCREENINGS = [
  {
    id: 'ny-2026-11-06',
    city: 'New York, NY',
    date: '2026-11-06',
    when: 'Friday, November 6',
    venue: 'Beacon of Faith Conference',
    note: 'Venue and time to be announced. Q&A with the director after the film.',
    tba: true,
    open: false
  },
  {
    id: 'dc-2026-12-10',
    city: 'Fairfax, VA (DC)',
    date: '2026-12-10',
    when: 'Thursday, December 10',
    venue: 'St. Mark Coptic Orthodox Church',
    note: '7:30 PM. Q&A with the director after the film.',
    open: true
  }
];

export const ID = /^[a-z0-9-]{3,40}$/;

export function find(id) {
  return SCREENINGS.find((s) => s.id === id) || null;
}
