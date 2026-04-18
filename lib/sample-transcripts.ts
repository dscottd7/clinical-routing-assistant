export interface SampleTranscript {
  label: string;
  body: string;
}

export const SAMPLE_TRANSCRIPTS: SampleTranscript[] = [
  {
    label: "Sarah T — Bariatric",
    body: `Patient: Sarah T., 42-year-old female
Date of call: Today

Reason for contact: Patient is inquiring about weight-loss surgery options and wants to understand next steps for getting a consultation.

Sarah reports she has been struggling with her weight for many years. She had a lap band surgery back in 2017 and lost about 60 pounds initially, but has since regained most of the weight. She is now interested in a gastric sleeve or bypass.

She does not currently have a dietician that she is working with. She mentioned she went to the dentist for a cleaning back in May, but did not specify the year. She has no pending dental work that she is aware of.

She denies any history of endoscopy in recent months and has not been referred for one.

She is not a smoker and has never smoked. No diabetes mentioned. No mention of opioid use.

Additional notes: Patient expressed frustration with the lap band slippage she experienced in 2020. She may benefit from a consultation that includes a discussion of revision surgery options and realistic expectations.`,
  },
  {
    label: "Bob L — Joint (Hip)",
    body: `Patient: Bob L., 67-year-old male
Date of call: Today

Reason for contact: Patient calling to inquire about hip replacement surgery. Has been dealing with severe left hip pain for approximately 3 years.

Bob reports constant left hip pain that limits his ability to walk more than a block. He was diagnosed with severe osteoarthritis of the left hip by his orthopedist last year.

Regarding physical therapy: Bob mentioned he "went to the gym a couple of times" about a year ago but stopped because it hurt too much. He has not undergone any formal physical therapy program.

Pain management: Bob has been taking oxycodone 10mg twice daily for the past two years under the supervision of his pain management doctor. He states he cannot function without it.

Dental: He saw his dentist in September and is current on cleanings. No pending dental work.

Smoking: Non-smoker, never smoked.

No diabetes or HbA1c concerns noted.

Additional notes: Patient is highly motivated and has caregiver support at home. His pain management situation will require careful coordination with anesthesia.`,
  },
  {
    label: "Maria V — Joint (Knee)",
    body: `Patient: Maria V., 58-year-old female
Date of call: Today

Reason for contact: Referred by her orthopedist for pre-surgical screening for right total knee replacement.

Maria has moderate-to-severe osteoarthritis of the right knee. She reports pain at rest and with activity.

Physical therapy: Maria completed a 12-week formal physical therapy program at ABC Physical Therapy, finishing about 8 weeks ago. She has PT documentation available.

Smoking: Maria is an active smoker, approximately half a pack per day. She has tried to quit twice but has not succeeded.

Diabetes/Labs: Her most recent HbA1c was 7.4, drawn about 6 weeks ago by her primary care physician. She is managed on metformin.

Dental: She had a full dental exam and cleaning 4 months ago, with no pending work noted by her dentist.

No prior joint surgeries. No opioid use — she manages pain with ibuprofen.

Additional notes: Maria is motivated to have surgery but expressed concern about the smoking requirement. She asked if a nicotine patch would be acceptable. Her PCP is engaged and can coordinate on the HbA1c management.`,
  },
];
