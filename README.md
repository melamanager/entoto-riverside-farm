# 🍓 ENTOTO Riverside Farm

A complete UI/UX demo for a real Ethiopian strawberry farm. Manages valves, raised beds, farmers, harvest tracking, disease reports, AI-driven crop pathology, and an interactive farm map.

> **Demo-ready.** All data lives in `lib/data.ts` as an in-memory seeded store. Swap that file with a real DB (Postgres / Supabase / Prisma) and the rest of the app keeps working.

## ✨ What's inside

- **Dashboard** — overview cards, live alerts, harvest trend, valve leaderboard, top farmers
- **Interactive 2D Farm Map** — SVG, click any bed, colored by health, harvest icons
- **Valve & Bed pages** — drill into any zone, full bed profile with stage timeline, harvest history, disease history, QR sticker
- **Farmers** — performance score, attendance, assignments, task counts
- **Diseases** — open reports, AI suggested treatments, telegram/sms notification stubs
- **Harvest** — log harvests, see recent activity, ranked
- **Reports** — daily / weekly / monthly tabs, smart Q&A
- **AI Detect** — toggle between instant **Demo** mode and **Live** mode (Gemini Vision or OpenAI gpt-4o-mini)
- **QR codes** — printable per-bed QR that opens the bed profile

## 🚀 Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## 🔑 Live AI mode (optional)

Demo mode works without any keys. For real AI vision, create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_key   # preferred (free tier available)
# or
OPENAI_API_KEY=your_openai_key
```

> ⚠️ **Never commit `.env.local`.** It's gitignored by default.

## 🚢 Deploy to Vercel

```bash
npx vercel
```

Then add the same env vars in the Vercel project settings.

## 🏗 Tech stack

- Next.js 16 (App Router, RSC, Turbopack)
- React 19
- Tailwind CSS 4 + shadcn/ui
- Recharts for analytics
- lucide-react icons
- qrcode.react for stickers
- Google Generative AI SDK / OpenAI REST for vision
