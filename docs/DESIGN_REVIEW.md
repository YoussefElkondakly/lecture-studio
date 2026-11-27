# Design review — consultation questionnaire (iteration 1 → 2)

Use with the running prototype ([DEMO_SCRIPT.md](DEMO_SCRIPT.md)). Record each answer with its source:
**D** = Dr. Ashraf (doctor-validated) · **Dev** = developer decision · **Open** = still undecided.
Screenshots referenced below are in `docs/screenshots/`.

## A. First impressions (ask before explaining anything)
1. On the Home screen, what would you do first? Was it obvious? (`1440-01-home.png`)
2. Is anything on Home unnecessary, or missing for a clinic day?
3. Does the interface feel like your tool, or like generic software? What would make it feel more personal?

## B. Navigation and density
4. The left menu is always expanded with labels. Keep it, or prefer a collapsible icon rail? (Q14)
5. My lectures is a table on a laptop. Do you prefer this table or larger cards? (`1440-02-lectures.png`)
6. Is the amount of information per screen comfortable, too sparse or too dense?
7. Are the four counts on Home (Needs review, Processing, Action needed, Completed) the right ones? Any to add or remove?

## C. Typography and colour
8. Is the text size comfortable for long reading (17 px body, serif documents)? Larger, smaller?
9. The serif face is used for titles and lecture documents. Does it help reading, or would you prefer one typeface?
10. Navy/teal balance: is the navy sidebar too heavy? Is teal clear as the “approve / continue” colour?

## D. Reviewing medical content (H1)
11. Source and draft side by side, or the draft full-width with the source on demand? (Q13, `1440-05-h1-medical-content-rtl.png`)
12. Is the highlighting of changed lines between revisions useful? Should it be on by default?
13. Direct editing of the canonical text vs requesting an AI revision: which would you use more, and when?
14. Is the confirmation wording right for your sign-off? Should it list specific checks (doses, units, references)?
15. Is the paired PDF view needed on screen, or only as a download?

## E. Prompts and Skills
16. How many master prompts do you have today, and for which stages? Can you share anonymised examples? (Q04)
17. Prompt choice: rely on saved defaults per stage, choose at each gate, or reusable “lecture presets”? (Q15)
18. Are the category names right? (Lecture content, Storyboard, Visual production, Narration transcripts, Voice generation)
19. Which Claude Skills do you actually use? Can you export the permitted bundles for API import? (Q05)
20. Should H2 (Skills confirmation) become a saved preference instead of a gate every time? (Q06)

## F. Lecture defaults
21. Which defaults should be fixed vs asked each time: audience, language, PDF style, duration, speakers, voice? (Q07)
22. Typical source types and sizes? Are your slides or notes in English or Arabic? (Q12)

## G. Notifications and interruptions
23. Where do you want to be told a review is ready: in the app, email, phone push, or all three? (Q08)
24. One message per review (current), or a digest? Quiet hours during clinic?
25. When you come back between patients, what do you need to see first to resume?

## H. Status and errors
26. Are the status words clear: Needs review, Processing, Revising, Action needed, Completed?
27. When a provider fails (`1440-11-lecture-blocked.png`), is the explanation and the Retry enough?

## I. Mobile
28. Would you review on your phone? Which gates (transcripts? audio? final video?) (Q03, `390-08-h4-review.png`)
29. Which browser and devices do you use?

## J. Branding
30. Is “Lecture Studio” the right name, or a personal brand? Is there a logo or colour you already use? (Q10)

## K. Budget
31. Is USD 10–20 per month a hard cap or a target? Should jobs stop at the limit or just warn? (Q09)

---

### Decision record template

| ID | Topic | Answer | Source (D / Dev / Open) | Follow-up |
|---|---|---|---|---|
| | | | | |
