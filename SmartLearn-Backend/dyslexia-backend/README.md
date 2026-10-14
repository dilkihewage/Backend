# Dyslexia Backend

Express and MongoDB backend for the dyslexia module.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file from `.env.example` and set `MONGODB_URI`.

3. Start the server:
   ```bash
   npm run dev
   ```

## Endpoints

- `GET /health`
- `GET /api/dyslexia/overview`
- `GET /api/dyslexia/catalog`
- `POST /api/dyslexia/sessions`
- `GET /api/dyslexia/sessions`
- `GET /api/dyslexia/sessions/:sessionId`
- `POST /api/dyslexia/sessions/:sessionId/attempts`
- `POST /api/dyslexia/sessions/:sessionId/complete`
- `GET /api/dyslexia/progress/:userId`

## Vercel deployment and environment

Set the Vercel project's Root Directory to `SmartLearn-Backend/dyslexia-backend`.
Use Vercel's Express framework detection and its default build settings. The existing
`src/app.js` now default-exports the Express instance; `src/server.js` re-exports that
same instance and starts a listener only outside Vercel. No `api/index.js` or
`vercel.json` is required for this configuration. There is no checked-in Vercel
configuration in this repository; verify the project's dashboard settings and remove
obsolete build/output overrides if they conflict with Express detection.

This follows [Vercel's Express deployment documentation](https://vercel.com/docs/frameworks/backend/express).

Configure these variables for Production (and Preview separately if needed):

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | `https://r26-it-114-jflg.vercel.app`; additional exact origins separated by commas |
| `MONGODB_URI` | Existing MongoDB connection string stored in Vercel, never committed |
| `MONGODB_DB_NAME` | Existing application database name; optional in code if already specified in the URI |

Vercel supplies `VERCEL` automatically. `PORT` is only needed to override the local
default of 5000. Existing `.env` files are not changed. The named production frontend
and HTTP localhost/127.0.0.1 origins are allowed; other browser origins receive 403.
Credentials and Authorization, Content-Type, and X-User-Id preflight headers are supported.
No wildcard is used. CORS is not an authentication mechanism.

MongoDB-dependent controllers connect before querying. Connections are reused in a
warm instance and concurrent calls share an in-flight promise. Failed promises are
cleared so a subsequent request can retry. Connection and server-selection timeouts
are 5 seconds, socket inactivity timeout is 10 seconds, and the pool is limited to 5.
There is no application-level retry loop within a request. See
[Mongoose connection timeout documentation](https://mongoosejs.com/docs/connections.html).

## Tests and local startup

From the backend directory:

```powershell
npm ci
npm test
npm run check
npm start
```

The tests use Node's test runner and Supertest. Database queries/connections are
mocked where needed; they never use the configured real database. For a restricted
environment that prevents launching test workers, Node 24 also supports:

```powershell
node --test --test-isolation=none test/app.test.js test/serverless.test.js
```

## Findings and remaining production checks

Confirmed in source: database routes previously relied on local startup to connect;
the connection helper could spend about 95 seconds retrying; empty CLIENT_ORIGIN
reflected arbitrary origins; database health errors were not forwarded to Express;
and the detected Express entrypoint lacked a default export. Assessment requests
without an assessment object also bypassed legacy score validation because of an
empty-object default; that is corrected. Dashboard queries use string userId values
(including Firebase UIDs), not MongoDB ObjectIds, and retain the existing filters
and response shape. Missing user data returns an empty dashboard with HTTP 200.
Blank/control-character IDs and the literal `:userId` placeholder return HTTP 400.

No Firebase authentication middleware exists in this service's current source.
Existing behavior is preserved; any frontend or external authentication must be
verified in its own deployment.

On October 14, 2026, read-only requests to the existing deployment's `/`, `/health`,
`/health/db`, and `/dashboard/:userId` returned HTTP 500 without Access-Control-Allow-Origin.
The `/health` response identified Vercel's `FUNCTION_INVOCATION_FAILED` error.
Even database-independent endpoints failed. This suggests a deployment/startup
failure; it does not establish the exact exception. The local changes have not been
deployed, and these checks do not demonstrate a production fix. Vercel runtime logs,
project settings, and MongoDB credentials/network access still need verification.

Commit/push the backend changes to the connected deployment branch, confirm the root
directory and variables above, then redeploy through the Vercel dashboard with the
updated source. Environment changes require a new deployment.

After redeployment, replace `ACTUAL_FIREBASE_UID` below with a real test child's UID;
do not send the literal route placeholder. Add an Authorization bearer token if
required by your existing external authentication layer.

```powershell
$backendUrl = 'https://backend-six-red-45.vercel.app'
$frontendOrigin = 'https://r26-it-114-jflg.vercel.app'
curl.exe -i "$backendUrl/health" -H "Origin: $frontendOrigin"
curl.exe -i "$backendUrl/"
curl.exe -i "$backendUrl/health/db" -H "Origin: $frontendOrigin"
curl.exe -i -X OPTIONS "$backendUrl/dashboard/ACTUAL_FIREBASE_UID" -H "Origin: $frontendOrigin" -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization,content-type'
curl.exe -i "$backendUrl/dashboard/ACTUAL_FIREBASE_UID" -H "Origin: $frontendOrigin"
curl.exe -i "$backendUrl/api/dyslexia/dashboard/ACTUAL_FIREBASE_UID" -H "Origin: $frontendOrigin"
curl.exe -i "$backendUrl/health" -H 'Origin: https://unapproved.example'
```

Expect `/` and `/health` to return 200, preflight to return 204 with the exact allowed
origin and credentials headers, and both dashboard paths to return the same JSON
structure. `/health/db` returns 200 with connected state and counts, or a controlled
503 if connection/count queries fail. Unapproved origins return 403 without an allow
origin header. Application-generated failures for allowed origins retain CORS headers;
Vercel errors before Express executes cannot be fixed by Express CORS middleware.
Then verify the React dashboard in the browser Network panel. Do not share child data,
tokens or database connection strings when collecting diagnostic logs.
