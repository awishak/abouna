// The screenings people can sign up for: one entry per screening with a date.
// The id sits in the Sign up link on the home page (/rsvp?s=<id>) and in every
// saved row, so it never changes once a row exists. Rows on the home page with
// no date yet stay on Notify me and are not listed here. To open sign-ups for a
// new screening: add it here, then swap that row's Notify me for a Sign up link.
// Andrew, 2026-10-14: New York is not ready for sign-ups, Keep me posted only.
// `open: false` keeps /rsvp closed until he says go; flip it and swap the button
// on the row. `tba: true` means the venue and time are still to come, and the
// register page says so after a sign-up. Fairfax opened 2026-10-20. Natick added 2026-10-22 from Andrew: Tuesday Dec 8, 7:30 PM. Davis the same day: Thursday Feb 4, 7:30 PM, UC Davis, room to come. New York venue added 2026-10-28: NYU C95 Lecture Hall, 238 Thompson St, 7 PM. Cleveland, OH added as TBD the same day.
// `address` shows on the register page under the venue, linked to a map. Fairfax and Natick added 2026-11-16, looked up from church listings; Andrew said yes to both the same day.
// `time` is its own field since 2026-11-16 so the register page can show When and Where as separate facts; `note` is whatever else there is to say.
// `poster` is the screening's own poster, shown on its register page and in the preview when the link is sent. Without one, the Episode Two poster is used. Fairfax and Natick posters from Andrew, 2026-11-16.
// Santa Clara added 2026-11-16 from Andrew: Friday Dec 4, 7:30 PM, Vari Communication Studio, sign-ups open. The map is map-santa-clara.svg, drawn from the screenshot he sent: park in the Main Parking Structure, walk to Vari Hall.
// `place` is a line under the venue with no map link (Google has Vari Hall labelled as another building). `map` is a picture for the register page, `steps` the numbered lines under it, `park` what the driving-directions link searches for.
export const SCREENINGS = [
  {
    id: 'ny-2026-11-06',
    city: 'New York, NY',
    date: '2026-11-06',
    when: 'Friday, November 6',
    venue: 'Beacon of Faith Conference, NYU C95 Lecture Hall, 238 Thompson St',
    time: '7 PM',
    note: 'Q&A with the director after the film.',
    open: false
  },
  {
    id: 'santa-clara-2026-12-04',
    city: 'Santa Clara, CA',
    date: '2026-12-04',
    when: 'Friday, December 4',
    venue: 'Vari Communication Studio',
    place: 'Vari Hall, Santa Clara University',
    map: '/map-santa-clara.svg',
    steps: ['Park in the Main Parking Structure.', 'Walk to Vari Hall.'],
    park: 'Main Parking Structure SCU, Santa Clara, CA',
    poster: '/poster-santa-clara-web.jpg',
    time: '7:30 PM',
    note: 'Q&A with the director after the film.',
    open: true
  },
  {
    id: 'dc-2026-12-10',
    city: 'Fairfax, VA (DC)',
    date: '2026-12-10',
    when: 'Thursday, December 10',
    venue: 'St. Mark Coptic Orthodox Church',
    address: '11911 Braddock Road, Fairfax, VA 22030',
    poster: '/poster-fairfax-web.jpg',
    time: '7:30 PM',
    note: 'Q&A with the director after the film.',
    open: true
  },
  {
    id: 'boston-2026-12-08',
    city: 'Natick, MA (Boston)',
    date: '2026-12-08',
    when: 'Tuesday, December 8',
    venue: 'St. Mark Coptic Orthodox Church',
    address: '145 Oak Street, Natick, MA 01760',
    poster: '/poster-natick-web.jpg',
    time: '7:30 PM',
    note: 'Q&A with the director after the film.',
    open: true
  },
  {
    id: 'davis-2027-02-04',
    city: 'Davis, CA',
    date: '2027-02-04',
    when: 'Thursday, February 4',
    venue: 'UC Davis',
    time: '7:30 PM',
    note: 'Room to be announced. Q&A with the director after the film.',
    open: true
  }
];

export const ID = /^[a-z0-9-]{3,40}$/;

export function find(id) {
  return SCREENINGS.find((s) => s.id === id) || null;
}
