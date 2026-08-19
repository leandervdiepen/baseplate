Baseplate's own schema: the `auth` tables and the grants the stack needs.

These are applied before `stack/migrations/`, which is where the app's tables live.
Do not put app tables here. An operator who resets their app schema should not lose their users.
