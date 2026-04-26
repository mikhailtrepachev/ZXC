# ZXC Bank Frontend

Next.js frontend for the ZXC Bank application.

## Scripts

```powershell
npm install
npm run dev
npm run build
npm run start
npm run lint
```

The app expects the backend to be available at `http://localhost:8080` in local development.
Set `BACKEND_URL` to override the API, OpenAPI, and SignalR proxy target.

## Routes

The frontend uses the Next.js App Router under `src/app`.
Existing screen components live in `src/screens`, shared widgets in `src/widgets`, and backend rewrites are configured in `next.config.mjs`.
