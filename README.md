# My Language Dojo

My Language Dojo is an AI-powered language learning platform that helps users master languages through immersive video content, personalized study guides, and interactive exercises.

## Features

- **Video Learning**: Watch YouTube videos with dual subtitles and interactive transcripts.
- **AI Study Guides**: Automatically generated vocabulary lists, grammar explanations, and quizzes based on video content (powered by Google Gemini).
- **Personalized Experience**: Track XP, level up, and customize your learning profile (themes, goals).
- **Multi-language Support**: Learn English, Spanish, French, German, and more.
- **Voice Recorder**: Practice pronunciation with built-in voice recording.
- **Dictionary**: Instant word lookups with translations and definitions.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication & Database**: [Supabase](https://supabase.com/)
- **AI**: Google Gemini API
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/naki0227/my-language-dojo.git
   cd my-language-dojo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory and add the following:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GOOGLE_GEMINI_KEY=your_gemini_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## License

[MIT](LICENSE)
