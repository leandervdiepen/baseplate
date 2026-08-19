One-command entry points.

| Script | What it does |
| --- | --- |
| `provision` | Brings the stack up on `TARGET` and prints the API URL |
| `teardown` | Stops the stack and destroys its volumes |
| `migrate` | Applies anything pending in `stack/migrations` |
| `schema` | Adds, renames, or drops a table or column, then applies it |
| `mint-token --sub UUID` | Signs a caller JWT, for operators and tests |
| `dashboard` | Starts the local UI on 127.0.0.1 |

All of them call the CLI, which calls the same use cases the dashboard does.
