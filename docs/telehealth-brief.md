# Telehealth brief

Northgate's manual and Harborline's bulletin give opposite instructions for telehealth visits, and a claim built from the manual is denied. The tool therefore suggests the manual's code, flags the denial, and offers the form Harborline pays. The clinic and Harborline need to settle which rule is authoritative.

## What the two documents say

| Source | Rule | Telehealth code |
|---|---|---|
| Manual v3.2, table | V-150: video or phone visit "regardless of time" | V-150 |
| Manual v3.2, G5 | "Any visit done by video or telephone is V-150, whatever its length. Do not add M-95." | V-150, no M-95 |
| Manual v3.2, table | M-95: "Used only where a payer requires it; see payer rules" | M-95 only if a payer requires it |
| Harborline bulletin HR-02 | "Harborline does not recognize code V-150... must be billed as V-110 with modifier M-95. Any claim containing V-150 is denied." | V-110 + M-95 |

The manual points to payer rules for M-95, and the bulletin is the payer rule. Read together, the two are consistent: V-150 is Northgate's internal code, and for Harborline it must be translated to V-110 + M-95. G5's "Do not add M-95" is what breaks that, because it says never to add the modifier. Dana's email calls the manual "the authority on how a visit should be coded" and the bulletin the rules Harborline applies when it decides whether to pay, so both statements are true and conflict only on this row.

## What the coders did

The 40 coder examples include 8 telehealth visits. Counts from the database (read-only):

| Coder form | Visits | Coders |
|---|---|---|
| V-150 (manual) | 5: E-50035, E-50079, E-50139, E-50350, E-50782 | DL (2), KM (1), RS (2) |
| V-110 + M-95 (bulletin) | 3: E-50160, E-50165, E-50266 | DL (3) |

Each group is partly right. The V-150 coders followed the manual exactly, and their claims would be denied under HR-02 (all 5). The V-110 + M-95 coders followed the bulletin and would be paid. DL used both forms, so this is not one coder's habit; the clinic should ask why. Coder initials are as exported; I have not asked anyone.

## Telehealth in the 251 unique visits

- 31 unique visits are telehealth (video or phone in the note). rules-v1 suggests V-150 for each, per the manual, and raises an HR-02 denial flag with the fix "Bill as V-110 + M-95". One further record is a duplicate of E-50266 and is excluded.
- Billed as the manual says (V-150): 31 of 31 would be denied under HR-02.
- Billed as the bulletin says (V-110 + M-95): 0 of 31 are denied by any of HR-01 to HR-08 in the checks the tool runs. One caveat: for E-50687 the member could not be matched to the roster, so HR-01 was not checked.
- Plans of the 31: Silver 21, Bronze 8, Gold 1, unresolved 1. None carries a procedure code, so HR-01 does not apply to them in practice.
- 9 of the 31 have no documented face-to-face time in the note. V-110 normally means under 15 minutes, so a longer telehealth visit billed as V-110 is a point to confirm with Harborline, not something the tool assumes.

## Recommended handling

1. Suggest V-150 with the quoted telehealth sentence, because the manual is Northgate's coding authority and G11 requires the sentence.
2. Flag HR-02 on every V-150, because Harborline will deny the claim.
3. Offer V-110 + M-95 as the billable form, with the same evidence sentence.

The tool does not change the code on its own. The coder reviews the suggestion and the accept/reject decision is saved.

## Open questions

For the clinic:
- Why did the coders differ on telehealth, and is the V-110 + M-95 form what they now use for Harborline?
- Should the manual's G5 and the M-95 row be updated to say V-110 + M-95 for Harborline claims?
- Is M-95 "used only where a payer requires it" the same as "always" for Harborline?

For Harborline:
- Confirm that V-110 is the correct visit code for a telehealth visit regardless of its length.
- Does M-95 change the payment rate?
- What is the effective date of HR-02 relative to the clinic's July renewal? The bulletin is effective July 1, 2026, and the earliest telehealth example here is 2026-06-05; HR-02 may not apply to visits before it. 6 of the 31 telehealth visits are dated before July 1.

## Limits of this brief

The counts come from the invented visit export in the database and the rules in the two documents. The reading that the two documents are consistent is my interpretation; neither the clinic nor Harborline has confirmed it. Whether a visit is telehealth was decided by the rules engine from the note text; a keyword count over the same notes also gives 31.
