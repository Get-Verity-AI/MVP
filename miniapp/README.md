# Verity MiniApp

React + Vite frontend to run Verity interviews.

## Setup

```bash
cd miniapp
pnpm install

Env

Create .env with:

VITE_BACKEND_URL=http://localhost:8000


Restart pnpm dev after edits.

Run
pnpm dev
# shows Local: http://localhost:5173 (or 5174)

Usage

Start with a valid session_id:

http://localhost:5173/?session_id=<UUID>


Fetches script from backend /script.

Renders steps one by one.

Posts answers to /responses.

Ends with a thank-you message.

Troubleshooting

Blank page + import error → use type-only import for Step in src/App.tsx:

import { fetchScript, postResponse } from "./lib/api";
import type { Step } from "./lib/api";


CORS error → enable CORSMiddleware in backend app.main.