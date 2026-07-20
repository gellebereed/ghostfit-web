# 👻 GhostFit

> Beat your past self. Every rep. Every session.

GhostFit is a gamified PWA fitness app where your past 
performance becomes a ghost you compete against in every workout.

## Features
- 👻 You vs Ghost battle arena per exercise
- 🤖 AI-generated personalized workout plans (OpenAI)
- 📹 YouTube tutorial videos for every exercise
- 🏆 Character tier progression system
- 📱 Works on iOS and Android as a PWA
- 🔐 Email/password auth with Supabase
- 💾 Data syncs across all your devices

## Tech Stack
- React + TypeScript + Next.js
- Vanilla CSS
- Supabase (auth + database + storage)
- AI: Gemini 2.5 Flash (primary, incl. vision) with Qwen (DashScope) fallback and optional OpenAI last resort — unified in src/services/llm.ts with retries + output validation
- YouTube Data API v3
- Vercel (hosting)

## Setup

### 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/ghostfit-web.git
cd ghostfit-web

### 2. Install dependencies
npm install

### 3. Add environment variables
Create a .env.local file in the root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI providers — tried in this order: Gemini (primary) → Qwen (fallback) → OpenAI (optional last resort)
GEMINI_API_KEY=your_gemini_key            # aistudio.google.com — required
QWEN_API_KEY=your_dashscope_key           # dashscope international (Alibaba Cloud Model Studio) — fallback
OPENAI_API_KEY=your_openai_key            # optional extra fallback

YOUTUBE_API_KEY=your_youtube_key
```

### 4. Run locally
npm run dev

### 5. Deploy to Vercel
Push to GitHub then import the repo at vercel.com.
Add the same environment variables in Vercel dashboard.

## Install as App (PWA)
- iPhone: Open in Safari → Share → Add to Home Screen
- Android: Open in Chrome → Menu → Add to Home Screen

---

Built with 👻 by GhostFit
