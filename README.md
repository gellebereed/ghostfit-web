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
- OpenAI API (GPT-4o vision + GPT-4o-mini)
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
OPENAI_API_KEY=your_openai_key
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
