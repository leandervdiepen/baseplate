# Components

The studio lives under `src/delivery/dashboard/`.
Visual source: [Baseplate operator dashboard](https://app.paper.design/file/01M07TKASYE9J372976D943J30) (alpine: snow × evergreen, IBM Plex Sans / Mono).

Stack: Vite + React + Tailwind + shadcn.
Not Next.js: this UI is a localhost operator tool, not a hosted app.

## Three tiers

Imports flow one way only: features → patterns → primitives.

### Primitives

Buttons, inputs, dialogs, tables.
No data fetching.
No domain types.
No knowledge of the product.
Styled only through tokens.

### Patterns

Combinations of primitives that solve a recurring layout or interaction problem (page header, confirm-and-destroy, data toolbar, app shell).
Still no data fetching.
Still no domain types.

### Features

Bound to one part of the product (table browser, schema map, policy editor, log viewer, settings, issue-token).
May hold domain types.
May call a use case only through the localhost operator HTTP client, never Hetzner or PostgREST from a primitive.
Never imports another feature's internals.

## Import rules

Primitives never import patterns or features.
Patterns never import features.
Features never import another feature's files, only its public entry if one is later exported.

Every component takes typed props and returns markup.
Anything that fetches or mutates lives outside the component tree (a use case, called from operator HTTP).

## Tokens

Colors, spacing, radii, and type scale live in exactly one token file with semantic names: `src/delivery/dashboard/styles/tokens.css`.

Copy values from the Paper tokens.
No raw hex, rgb, or px values in component files.
Name tokens by role (`color-text`, `color-danger`, `space-md`), not by hue (`blue-500`).

## DX and motion

One filled primary action per view.
Verb-first, sentence-case labels: "Save locally", "Insert row", "Issue token".
Secrets copy: "These keys stay on this machine."
Hit areas at least 40×40.
Tabular numbers on UUIDs, timestamps, and counts.
Press scale about 0.96.
No `transition: all`.
No animation on high-frequency chrome.
`prefers-reduced-motion` is not optional.

## What a component is not

A component is not a use case.
A component is not an API client that talks to Hetzner.
A component is not a place to put access-policy logic.
Those belong in `src/application/` and `src/domain/`.
Secrets belong in the project's `baseplate.env`, written by operator HTTP, not in the browser.
