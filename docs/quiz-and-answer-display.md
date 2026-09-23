# Small quiz entry and answer display

The original inquiry layout is retained. A small Quiz navigation link opens `/quiz`; no quiz card or promotional section is inserted on the homepage. The separate quiz restores the existing five-question deterministic exercise with scoped page styling, local scoring, skips, restart and source links. It does not call the Q&A endpoint.

`plainAnswerText` removes paired asterisk emphasis markers from displayed prose and link labels. Source URLs and saved conversation content are unchanged; literal arithmetic and unmatched asterisks are retained. This is display normalization, not a change to historical claims or evidence.

Validation includes marker/unit tests, quiz scoring tests, targeted types/lint, and mobile/desktop browser checks for answer rendering, links, quiz navigation, deterministic completion and no quiz model calls.
