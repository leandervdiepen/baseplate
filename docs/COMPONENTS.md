# Components

Nothing renders in Phase A.
These rules exist so Phase B does not invent a component system under time pressure.

When UI work starts, it lives under `src/delivery/dashboard/`.
That folder does not exist yet.
Do not create it until Phase B.

## Three tiers

Imports flow one way only: features → patterns → primitives.

### Primitives

Buttons, inputs, dialogs, tables.
No data fetching.
No domain types.
No knowledge of the product.
Styled only through tokens.

### Patterns

Combinations of primitives that solve a recurring layout or interaction problem (page header, confirm-and-destroy, data toolbar).
Still no data fetching.
Still no domain types.

### Features

Bound to one part of the product (table browser, policy editor, log viewer).
May hold domain types.
May call a use case.
Never imports another feature's internals.

## Import rules

Primitives never import patterns or features.
Patterns never import features.
Features never import another feature's files, only its public entry if one is later exported.

Every component takes typed props and returns markup.
Anything that fetches or mutates lives outside the component tree (a use case, called from a route or loader).

## Tokens

Colors, spacing, radii, and type scale live in exactly one token file with semantic names.
When the dashboard exists, that file is `src/delivery/dashboard/styles/tokens.css`.

No raw hex, rgb, or px values in component files.
Name tokens by role (`color-text`, `color-danger`, `space-md`), not by hue (`blue-500`).

## What a component is not

A component is not a use case.
A component is not an API client.
A component is not a place to put access-policy logic.
Those belong in `src/application/` and `src/domain/`.
