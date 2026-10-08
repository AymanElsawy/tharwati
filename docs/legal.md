# Legal public pages (L1-B)

`legal-copy.json` is the approved EN/AR legal source of truth, transcribed from
user-supplied copy on 7 October 2026. Its titles, dates, headings, paragraphs,
and list items retain the exact approved wording. Web imports this source directly;
there is no separately maintained copy in application translations.

The public origin is https://tharwati-dgp.pages.dev. Publication and last update
are 2026-10-07. Maintain ISO dates and the approved localized date strings in the
source together when a new revision is approved; dates are not build timestamps.

`/privacy` and `/terms` render independently of Supabase initialization, session
startup, onboarding, and recovery. Both use the Web theme, a language switcher,
semantic headings/lists, last-updated time, mail links, and EN/AR direction.
`?lang=en` or `?lang=ar` selects the entry language, and the switcher remains available.

Web Signup and Settings open the legal pages in a new tab so forms remain mounted.
Mobile Signup and Settings open the same public URLs externally, with the current
language as a query parameter. Failed launches display localized retry feedback.
The existing signup checkbox, validation, and authentication flow are unchanged;
there is no consent persistence. `/delete-account` uses its existing implementation.
