import { manualHref } from './manual';
import { bulletinHref } from './bulletin';

/** Where a code or rule id is documented: the clinic manual (codes, G rules) or the Harborline bulletin (HR rules). */
export const ruleHref = (ref: string): string | null => manualHref(ref) ?? bulletinHref(ref);
