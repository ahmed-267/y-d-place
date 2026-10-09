# PreVisio

PreVisio is a browser-based operating system for cafés, bakeries, and quick-service kitchens. Owners, managers, and staff share one workspace for the till, menu, stock, team, and books — on a tablet, laptop, or phone you already have.

**Live app:** [https://radiant-mochi-5519d5.netlify.app](https://radiant-mochi-5519d5.netlify.app)

No new hardware. Open the site, create an account, or use **Try demo** to walk the owner, manager, and staff portals without signing up.

## What you can do

- **Till** — take walk-in, dine-in, and pre-orders; extras, notes, discounts, and cash or recorded card payments
- **Orders and tables** — kitchen board plus an optional floor plan
- **Menu and stock** — catalogue, recipes, ingredients, and low-stock alerts. Staff can view the menu and toggle items on or off
- **Team** — invite staff, plan a rota, and log hours. Staff see a week or month calendar with pay and leave
- **Finance** — expenses, receipt scan, and a regional tax estimate
- **Online pre-orders** — a public menu link that prices items on the server
- **Languages** — English, French, Dutch, Flemish, and more, per person

New businesses start a **14-day Pro trial**, then **$39/month**. Cancel anytime before the trial ends and you are not charged. Demo mode stays free and does not use billing.

## Tech

React, TypeScript, Vite, Tailwind, Supabase (auth and data), Netlify Functions, Stripe Billing, and OpenRouter for menu and receipt scanning.

## Run it locally

You need **Node.js 20+** and npm.

```bash
git clone git@gitlab.com:Ahmed267/y-d-place.git
cd y-d-place
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see below), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Typecheck with `tsc` |
| `npm run verify:rls` | Probe Supabase as the anon key (needs network) |

### Environment

Copy `.env.example` to `.env.local`. The app will not start without the two Supabase variables.

| Variable | Required | Used for |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anon key (safe in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | For invites, online orders, billing | Server only. Never prefix with `VITE_` |
| `OPENROUTER_API_KEY` | For AI menu and receipt scan | Server only |
| `VITE_OPENROUTER_MODEL` | No | Defaults to `openai/gpt-4o-mini` |
| `STRIPE_SECRET_KEY` | For subscriptions | Server only |
| `STRIPE_WEBHOOK_SECRET` | For subscriptions | Stripe signing secret |
| `STRIPE_PRICE_PRO` | For subscriptions | Monthly Pro price id (`price_...`) |
| `APP_URL` | For Stripe redirects | `http://localhost:3000` locally |

You can explore the product with **Try demo** before wiring Stripe or OpenRouter. Owner sign-up, staff invites, public orders, and billing need the matching keys and the SQL in `supabase/migrations/` applied in the Supabase SQL editor.

## Deployed version

The production site is on Netlify:

[https://radiant-mochi-5519d5.netlify.app](https://radiant-mochi-5519d5.netlify.app)

Builds run `npm run build` and publish `dist/`. API routes (`/api/ai`, staff invites, public menu and orders, Stripe checkout, portal, and webhooks) are Netlify Functions under `netlify/functions/`. Set the same environment variables in the Netlify project, then redeploy so `VITE_*` values are baked into the client bundle.
