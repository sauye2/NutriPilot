# NutriPilot

NutriPilot is a full-stack nutrition app for people who already know what they want to cook and want help calculating, saving, and improving it. It combines meal building, recipe import, AI-assisted meal generation, grocery lists, saved goals, and daily logging in one calm workflow.

Live demo: [nutripilot-stannyauy402-3763s-projects.vercel.app](https://nutripilot-stannyauy402-3763s-projects.vercel.app)

## Screenshots

Add a few screenshots here before sharing the project widely:

- Meal Builder
- Lazy Mode
- Import Recipe
- Dashboard

## The Problem

Most nutrition apps are built around logging after the fact. NutriPilot takes a different angle:

- you already know what you want to make
- you want the numbers before you cook
- you want help nudging the meal closer to your goals without ruining the dish

That makes it useful for meal prep, home cooking, and day-to-day nutrition planning without feeling like a spreadsheet or a bodybuilding tracker.

## Features

- Manual meal builder with live calories and macros
- USDA FoodData Central ingredient matching and fallback logic
- Recipe import from a pasted URL
- AI-powered meal generation with revision and optimization suggestions
- Grocery list export and checklist
- Supabase Auth for real user accounts
- Saved meals and meal ingredients in PostgreSQL
- Saved nutrition goals per user
- Daily meal logging
- Dashboard with today’s totals, remaining targets, recent meals, and a 7-day view

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- OpenAI API
- USDA FoodData Central API
- Vercel
- GitHub Actions

## Cloud Architecture

User  
→ Next.js frontend on Vercel  
→ Next.js API routes / serverless functions  
→ Supabase Auth + PostgreSQL  
→ OpenAI API for meal generation and revision  
→ USDA FoodData Central API for nutrition data and ingredient matching

## Supabase Schema Summary

NutriPilot stores user-owned data in these tables:

- `profiles`: lightweight user profile tied to `auth.users`
- `nutrition_goals`: one goals row per user
- `meals`: saved manual, generated, and imported meals
- `meal_ingredients`: ingredient rows for each saved meal
- `imported_recipes`: saved recipe imports before or alongside builder use
- `daily_logs`: meal snapshots logged to a calendar date

The full schema, indexes, triggers, and RLS policies live in:

- [supabase/schema.sql](C:/Users/drago/Desktop/NutriPilot/supabase/schema.sql)

## API Routes

- `POST /api/meals`: save a meal and its ingredients
- `GET /api/meals`: load recent saved meals for the signed-in user
- `DELETE /api/meals/[id]`: delete a saved meal
- `GET /api/goals`: load the signed-in user’s goals
- `PUT /api/goals`: update the signed-in user’s goals
- `POST /api/daily-logs`: log a meal to a date
- `GET /api/dashboard/summary`: load dashboard-ready data in one request
- `POST /api/imported-recipes`: save an imported recipe

Existing public routes are still intact:

- `/meal-builder`
- `/generate-meal`
- `/import-recipe`
- `/shopping-list`
- `/dashboard`
- `/login`
- `/signup`

## Environment Variables

### Public

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Server only

- `OPENAI_API_KEY`
- `OPENAI_MEAL_MODEL`
- `USDA_FOODDATA_API_KEY`

## Local Setup

1. Clone the repo.
2. Install dependencies:

```bash
npm ci
```

3. Create a local `.env.local` file with the variables above.
4. Run the Supabase SQL schema in your project.
5. Start the app:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Supabase Setup

1. Open your Supabase project dashboard.
2. Go to the SQL Editor.
3. Run the contents of [supabase/schema.sql](C:/Users/drago/Desktop/NutriPilot/supabase/schema.sql).
4. In Authentication, enable email/password sign-in.
5. If you want email confirmation, leave it on. If you want faster local testing, you can disable email confirmation temporarily.

## Vercel Deployment Notes

- Add the same environment variables in Vercel that you use locally.
- The frontend only needs:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Keep these server-only in Vercel:
  - `OPENAI_API_KEY`
  - `OPENAI_MEAL_MODEL`
  - `USDA_FOODDATA_API_KEY`
- NutriPilot is already set up to deploy on Vercel with Next.js API routes.

## Testing

Run the main checks:

```bash
npm run lint -- src middleware.ts
npm run test:resolver
npm run build
```

The CI workflow runs the same checks in GitHub Actions.

## Future Improvements

- Password reset flow
- Saved recipe history page
- Better meal title editing for manual meals
- Calendar view for daily logs
- Shared saved meal collections
- Smarter dashboard charts once more usage data exists
- More explicit “log this meal” actions inside every meal flow

## Resume Bullet Examples

- Built a full-stack nutrition planning app with Next.js, Supabase Auth, PostgreSQL, OpenAI, and USDA FoodData Central
- Designed a cloud-backed meal workflow supporting saved meals, daily logs, user goals, recipe import, and AI meal generation
- Implemented row-level security policies in Supabase so each user can only access their own meals, goals, and logs
- Created a reusable ingredient normalization and nutrition pipeline that combines deterministic USDA data with AI-assisted meal generation
- Deployed the app to Vercel and added GitHub Actions CI for linting, tests, and production builds

## Why This Project Works Well In A Portfolio

NutriPilot shows a useful mix of product thinking and full-stack execution:

- polished consumer UI
- real auth and persistence
- external API integrations
- secure backend patterns
- practical domain logic
- cloud deployment and CI

It feels like an actual shipped product, not just a UI mockup or isolated coding exercise.
