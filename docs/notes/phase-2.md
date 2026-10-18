# Phase 2: Server foundation and auth

## What was built

- **Configuration** (`config/env.js`): every variable is parsed by a zod schema; a missing or invalid value stops the server with a list of problems. In tests, `MONGODB_URI_TEST` is mandatory and its database name must contain "test", because the test setup drops that database.
- **Database** (`config/db.js`): one mongoose connection, `strictQuery` on, 5 s server-selection timeout so a stopped MongoDB fails quickly with a clear error.
- **Security middleware**: helmet (security headers; cross-origin resource policy relaxed so the web app can show `/uploads` photos), CORS restricted to `CLIENT_ORIGIN`, a 100 kB JSON body limit, morgan request logs in development, and per-IP rate limits on login and register.
- **`validate`** (zod), **`auth`** (verify JWT → load the user from the database → reject deactivated accounts), **`requireRole`**, **`notFound`** and **`errorHandler`**. The error handler turns every known error into `{ error: { code, message, details? } }`: zod → 400 with field details, duplicate key (`E11000`) → 409, malformed JSON → 400, multer limits → 400, unknown errors → 500 without a stack trace (stacks only in development).
- **User model**: unique lowercase email, `passwordHash` with `select: false`, roles, skills (technician categories), FCM tokens (hidden), `isActive`.
- **Auth**: register (always `student`; a `role` in the body is stripped by zod), login, me, logout (removes this device's FCM token), save FCM token.
- **Admin users** (pulled forward from phase 3 because the 403 check needs an admin route): list with filters and pagination, create technician/admin, update and deactivate (not yourself).
- **Tests**: 35 vitest + supertest tests against the `fixit_test` database.

## Key choices and why

- **Reload the user on every request.** The token says *who* you are; the database says what you may do *now*. A deactivated user or a changed role takes effect immediately, and a forged `role` claim in a token is ignored (tested).
- **Same 401 for unknown email and wrong password**, with a dummy bcrypt compare for unknown emails, so attackers cannot discover which emails are registered by message or timing.
- **Login to a deactivated account is 403; a token of a deactivated account is 401.** The 401 makes clients clear the token and return to Login.
- **bcryptjs** (pure JavaScript), so Windows needs no native build tools.
- **`req.valid`**: Express 5 made `req.query` a read-only getter, so parsed values are stored separately and controllers read from `req.valid`.

## Concepts from fundamentals

- **Password hashing.** bcrypt is a slow, salted, one-way function. The database stores `$2b$10$<salt><hash>`; login re-hashes the attempt with the same salt and compares. Cost 10 means 2¹⁰ rounds, slow enough to make brute force expensive.
- **JWT.** A signed token `header.payload.signature`. The server signs `{ sub, role, exp }` with `JWT_SECRET` (HMAC-SHA256); anyone can read the payload, but nobody can change it without the secret. `exp` makes tokens expire (FR-03). Logging out on a stateless JWT means the client deletes it.
- **Middleware chain.** Express runs functions in order; each either calls `next()`, or ends the response, or calls `next(err)` to jump to the error handler. Express 5 forwards rejected promises from async handlers automatically.
- **Rate limiting.** A counter per IP per time window; above the limit the server answers 429 without doing the expensive bcrypt work.
- **CORS.** Browsers block JavaScript from reading responses from another origin unless the server sends `Access-Control-Allow-Origin`. Only the web app's origin gets it. CORS does not protect against non-browser clients; that is the job of authentication.

## Checks

```text
> server@1.0.0 test
> vitest run
 Test Files  2 passed (2)
      Tests  35 passed (35)
```

Covers: validation 400 with field details, malformed JSON 400, duplicate email 409, wrong password 401, unknown email 401, deactivated login 403, no token 401, expired token 401, forged token 401, deactivated token 401, student and technician on admin routes 403, forged admin role claim ignored, role escalation on register ignored, bcrypt hash stored, rate limit 429, CORS allow-list, pagination bounds. `npm run lint -w server` is clean.

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **Why reload the user from the database instead of trusting the role in the JWT?** Tokens live for days. Reloading means deactivation and role changes apply instantly, and even a token with a forged role claim cannot grant more rights than the database records.
2. **How does the server stop someone registering as an admin?** The register schema has no `role` field, so zod strips it, and the service always sets `role: 'student'`. Staff accounts are created only through the admin-only `/api/users`.
3. **Why does a duplicate email return 409 and not 400?** The request is valid; it conflicts with the current state of the server (an existing account). 409 Conflict expresses exactly that.
4. **What is the difference between authentication and authorisation here?** Authentication (`auth` middleware) proves who you are using the JWT. Authorisation (`requireRole`, service-level visibility rules) decides what you may do. Failing the first is 401, failing the second is 403 (or 404 for hidden resources).
5. **Why are stack traces hidden outside development?** They reveal file paths, library versions and internal logic that help an attacker; users get a generic message and the server logs the details.

</details>
