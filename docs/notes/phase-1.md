# Phase 1: Design documents

## What was built

- `docs/API.md`: every endpoint (method, path, roles, request, response, errors) for auth, issues (analyse, duplicates, create, list, feed, get, patch, support, suggestions, assign, transition), users, locations, notifications, insights, CSV export and health; the realtime events; the one error shape; and a table mapping every functional requirement to endpoints or events.
- `docs/ARCHITECTURE.md`: Mermaid diagrams for the system, the report → assign → resolve → confirm sequence and the status machine, plus the layering rules, the realtime design, the security model and the offline queue.

## Key choices and why

- **One `/transition` endpoint plus `/assign`.** Every status change except assignment goes through `POST /issues/:id/transition { to }`, so the server has one code path that consults `utils/transitions.js`. Assignment is separate because it needs a technician id and smart suggestions.
- **404 for invisible resources.** Returning 403 would confirm that an issue exists. 404 leaks nothing.
- **Events are "something changed" hints.** Clients patch what they show or refetch, and always refetch after reconnecting. That makes the realtime layer simple and self-healing.
- **Analyse before create.** `POST /issues/analyse` returns the AI suggestion and duplicate candidates before anything is saved, so the student can choose "Me too" instead of creating a duplicate.

## Concepts from fundamentals

- **REST.** Resources (issues, users) are nouns in the URL; HTTP methods are the verbs (GET reads, POST creates or triggers an action, PATCH partially updates). Status codes carry the outcome.
- **Idempotency.** Doing an operation twice has the same effect as doing it once. The `clientRequestId` makes `POST /issues` idempotent for retries.
- **State machine.** A fixed set of states and allowed transitions between them; anything not in the table is rejected. It makes workflows predictable and testable.
- **Sequence diagram.** Shows who talks to whom, in what order, over time.

## Checks

All 26 functional requirements in SPEC section 7 are mapped to at least one endpoint or event (script compared the FR ids in SPEC.md with the mapping table: 26/26, none missing).

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **Why return 404 instead of 403 when a student requests someone else's issue?** 403 would reveal that the issue exists. 404 treats "not yours" exactly like "does not exist", so nothing leaks.
2. **Why is there one transition endpoint instead of `/start`, `/resolve`, `/close`?** One code path checks every change against the single transition table, so the rules cannot drift between handlers, and testing every allowed and forbidden pair is straightforward.
3. **What makes the offline queue safe to retry?** Each report carries a client-generated UUID (`clientRequestId`) with a unique index on the server; a repeat POST returns the existing issue instead of creating a new one.
4. **Why do clients refetch after a socket reconnect?** Events sent while a client was disconnected are lost. Refetching the current view after reconnecting guarantees the screen is correct, whatever was missed.
5. **Why does the API return photo paths instead of URLs?** The same photo is reached through different origins (localhost on the web, 10.0.2.2 on the emulator, a LAN IP on a phone). Each client prefixes its own API origin, so stored data never needs rewriting.

</details>
