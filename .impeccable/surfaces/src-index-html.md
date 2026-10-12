---
version: 1
slug: "src-index-html"
primary_target: "src/index.html"
related_targets: []
---

# Surface brief: Home (`/` and `/es/`)

## Scope and mode
- Production home page, English at `/`, Spanish at `/es/`, rendered from one template.
- Visitor mode: **Persuade**. Mobile-first (portrait, 390px frame is the design reference); desktop is the secondary layout.

## Audience and job
- Arrives from a social post, on a phone, mid-scroll, low attention.
- Primary: a non-technical professional afraid AI will change their job. Needs to understand the experiment in seconds and feel "this could be me."
- Secondary: founders and small-business owners asking "could this method work in my company?"; technical builders who want to copy the protocol and agents.

## Story order
1. Hook: the question ("What remains of a person when everything is delegated?") and the confession ("AI nearly destroyed my company. Yours could be next.").
2. "This could be me": the stakes are a real person's company, money and relationships.
3. Method: one cycle of Map, Delegate, Review, shown on the delegation grid (Relationships, Personal, Company; unmapped to autonomous).
4. Experiments: questions with statuses (sample data, labeled).
5. Act: Observe (weekly log by email) and Submit your company. Protocol link for builders.
6. Close: consent protocol and Subject 001 credit.

## Actions and success
- Primary action: Observe email signup, reachable within the first two mobile scroll lengths.
- Secondary action: Submit your company.
- Tertiary: Read the protocol (delegate.onhundred.com), Choose the next experiment.

## Proof and content
- Real: manifesto copy, method, delegation vocabulary, consent protocol.
- Sample (must carry a visible "Sample" label): experiments, grid counts, cycle day, voting dates, slot counts.

## Constraints
- Performance first: first viewport is type and code-drawn elements only, no raster or video above the fold; HTML+inline CSS under 20KB br per page, JS under 3KB br, fonts under 80KB.
- World: evolve the incumbent (Darkroom Black field, Live-Wire Green single signal, delegation grid signature); type and composition may push further.
- Static output on Cloudflare Pages; forms post to configurable URLs.

## Approved comp
- `.impeccable/mocks/decision/whats-left.png` (390x844 portrait), locked on the decision page; the surface round discharged the comp round.

## Direction contract
THESIS: The first screen is a vital-sign readout of a person: one figure, "81% of him is still him", with the delegation grid as its meter. It refuses the headline, subcopy and button hero.
OWN-WORLD: Darkroom Black ground, Bone Paper type, Live-Wire Green only on delegated cells and live signals; square cells escalating from dashed outline to solid lit; uppercase tracked mono labels; hairline rules; square outlined controls.
STORY: The visitor sees how much of a real person is left, reads two lines of confession, recognizes their own job in it, and subscribes to watch the number fall. Below: the method (Map, Delegate, Review), the experiments, submit your company, the protocol.
FIRST VIEWPORT: Mono header and live dot on top; the giant figure owns the upper third with OF HIM IS STILL HIM and a SAMPLE tag; three labeled grid groups (Relationships, Personal, Company) fill the middle; two confession lines; email field plus OBSERVE near the bottom; stage pills peek at the fold.
FORM: What's Left of Him, position 6 of 7 on the ranked list; seed key 10ed84e4. Signature interaction: tap an area to isolate its cells and the figure recomputes for that area.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Email provider and submission endpoint.
- Spanish copy needs owner review before launch.
