# Security

Baseplate holds a database, its users, and their files. If you find a way past
that, please tell me before you tell anyone else.

## Reporting

Open a [private security advisory](https://github.com/diepenio/baseplate/security/advisories/new),
or email leander.vandiepen@chaptr.com.

Please include what you did, what you expected, and what happened instead. A
failing script is worth more than a description. I will confirm within a few
days and tell you plainly whether I think it is a real issue.

There is no bounty. This is one person's project.

## What counts

The load-bearing claim is that **a caller only ever reaches their own rows and
their own objects**, and that the database, not any TypeScript, is what enforces
it. Anything that breaks that is the most serious kind of bug here:

- Reading, writing, or deleting another caller's rows or objects.
- Reaching `auth.users`, `auth.refresh_tokens`, or the `baseplate` schema through
  the public API.
- Forging a token the stack accepts, or making an expired or revoked one work.
- Making a signed object link open something it was not signed for.
- Getting an operator's cloud credentials off their machine, or into a log, a
  browser, a container, or a published package.
- SQL injection through a table name, a column name, an object key, or a filter.

## What does not

- **Anything that needs the operator's own machine.** The studio binds
  127.0.0.1, and `baseplate.env` is theirs to protect.
- **The blob store having no auth of its own.** It is on the compose network,
  never published and never routed by Caddy, and the storage service in front of
  it is the gate.
- **Denial of service by an authenticated caller.** There is no rate limiting
  yet, and that is stated in the README rather than hidden.
- **A missing feature.** See the README's list of what is not built.

## Supported versions

The latest published version. Baseplate is installed, not forked, so upgrading
is installing a different version.
