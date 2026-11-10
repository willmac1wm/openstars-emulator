/**
 * Short, verifiable ATC career facts for the end-of-round Expo card.
 * Only include claims that can be checked against a public FAA page.
 *
 * Sources (retrieved for this project; re-check before major events):
 * - FAA Air Traffic Controller careers overview: https://www.faa.gov/jobs
 * - FAA Air Traffic Controller occupation page: https://www.faa.gov/jobs/career_fields/aviation_careers
 * - USAJOBS ATC announcements typically list age/education requirements; the
 *   public FAA jobs hub is the safe pointer for visitors.
 */

export interface AtcFactCard {
  title: string;
  bullets: string[];
  careersUrl: string;
  sourceNote: string;
}

export const ATC_CAREER_CARD: AtcFactCard = {
  title: 'Real-world air traffic control',
  bullets: [
    'Air traffic controllers keep aircraft separated and organized in the sky and on the airport surface.',
    'In the U.S., civilian controllers work for the Federal Aviation Administration (FAA).',
    'Controllers use radar, radio phraseology, and clearances — skills you just practiced on this scope.',
    'Curious about the job? Start at the FAA careers page (no signup required to read).',
  ],
  careersUrl: 'https://www.faa.gov/jobs',
  sourceNote: 'Facts summarized from faa.gov/jobs public career materials.',
};
