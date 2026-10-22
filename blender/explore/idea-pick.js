// Which idea an object shows (the star chart, the food on the counters, the Conservatory's herbs; Nicole, 22 Oct).
// Whatever Gemma names or the object points at is the card that comes out (QA 4 S1), so the pick is made from what the page
// can still show: first an idea serve() will take (in season first, when the idea says its seasons), else one already on a
// card (it reopens), else the first that fits (its page opens in the book). An object with no new card to give shows its own
// best match (its card again, or its page) rather than some other card; the star chart, which can name anything, reopens any.

/** candidates: atoms in order of fit; canServe(a), onCard(a), season: the Inn's season now (or null);
 *  anyCard: with nothing new, any candidate already on a card before the best match's page → an atom or null */
export function pickIdea(candidates, { canServe = () => true, onCard = () => false, season = null, anyCard = false } = {}) {
  const xs = candidates.filter(Boolean);
  if (!xs.length) return null;
  const inSeason = a => !season || !a.seasons?.length || a.seasons.includes(season);
  const ordered = [...xs.filter(inSeason), ...xs.filter(a => !inSeason(a))];
  return ordered.find(canServe) || (anyCard && ordered.find(onCard)) || ordered[0];
}
