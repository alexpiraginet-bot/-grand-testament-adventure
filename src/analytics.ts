// Visit counting, asked for by Alex on 13/11/2026 (`npm i @vercel/analytics`): Vercel Web Analytics, aggregated and
// without cookies. It runs only in the build Vercel makes for production (vite.config.ts defines __COUNT_VISITS__
// from VERCEL_ENV): a local build, a preview deployment and every test load no script and send nothing. Of the page's
// address only the path is sent: the query string and the hash are cut, because the game's parameters (?nuvem, ?debug,
// test flags) are nobody's business but the player's. The devs' panel (painel.html) does not load this.
import { inject } from "@vercel/analytics";

declare const __COUNT_VISITS__: boolean | undefined;

/** Whether this bundle counts visits. Absent under node --test, where there is no Vite: off. */
export const COUNTS_VISITS: boolean = typeof __COUNT_VISITS__ === "boolean" ? __COUNT_VISITS__ : false;

/** The address as it may be sent: everything before the first "?" or "#". */
export function visitUrl(url: string): string {
  const cut = url.search(/[?#]/);
  return cut < 0 ? url : url.slice(0, cut);
}

/** Start counting this visit, if this is the production build. `start` is the package's inject(), a parameter so the
 * test can see what it is given. */
export function countVisits(on: boolean = COUNTS_VISITS, start: typeof inject = inject): boolean {
  if (!on) return false;
  start({ mode: "production", beforeSend: (event) => ({ ...event, url: visitUrl(event.url) }) });
  return true;
}
