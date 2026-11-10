import { MANUAL_CODES } from '../lib/manual';

/** Every code id in the clinic manual's code table (G10). The manual data module is the single source. */
export const CODES: ReadonlySet<string> = new Set(MANUAL_CODES.map((c) => c.code));
