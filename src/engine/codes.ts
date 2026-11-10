/** The Northgate code table (one source for the model prompt and the validator). */
export const CODE_TABLE = `V-110 Brief visit: documented face-to-face time under 15 min
V-120 Standard visit: 15-29 min, or time not documented
V-130 Extended visit: 30-44 min
V-140 Comprehensive visit: 45+ min
V-150 Telehealth visit: any video/phone visit regardless of time
V-200 Preventive (annual) visit: scheduled wellness visit, no presenting complaint
V-300 Urgent same-day visit: unscheduled visit for an acute problem
P-210 Simple wound repair: single layer, 5 cm or less
P-220 Complex wound repair: layered, or longer than 5 cm
P-310 Joint injection
P-320 Skin lesion removal
P-330 Fracture or sprain splinting
P-410 ECG (performed and read in clinic)
P-420 Spirometry
P-430 Rapid strep test
D-101 High blood pressure; D-102 Type 2 diabetes; D-103 Upper respiratory infection; D-104 Low back pain; D-105 Anxiety; D-106 Laceration;
D-107 Knee pain; D-108 Skin lesion; D-109 Asthma; D-110 Ankle sprain; D-111 Sore throat; D-112 Chest pain; D-113 Routine wellness, no complaint;
D-114 Wrist sprain or suspected fracture; D-115 Headache; D-116 Medication refill / management
M-25 Separate visit on procedure day (append to V- code); M-52 Reduced or incomplete procedure (append to P- code); M-95 Telehealth modifier: do NOT assign (G5)`;

/** Every code id in the table. */
export const CODES: ReadonlySet<string> = new Set(CODE_TABLE.match(/\b[VPDM]-\d+\b/g));
