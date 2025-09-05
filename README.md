# Sparky Screen Recording App

A web-based screen recording application with Vimeo integration, user management, and customer data organization.

## Features

- 🎥 Screen recording with audio
- 📤 Direct upload to Vimeo
- 👥 User authentication via Supabase
- 📊 Customer data management
- 🔒 Secure video storage

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase
- **Video Storage**: Vimeo
- **Deployment**: Vercel

## Deploy to Vercel

### Manual Deployment Steps

1. **Clone and Push to GitHub**
   ```bash
   git clone your-repo
   cd your-repo
   npm install
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect this as a Vite app

3. **Set Environment Variables in Vercel**
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VIMEO_CLIENT_ID=your_vimeo_client_id
   VIMEO_CLIENT_SECRET=your_vimeo_client_secret
   VIMEO_ACCESS_TOKEN=your_vimeo_access_token
   ```

4. **Deploy**
   - Vercel will automatically build and deploy
   - Your app will be live at `https://your-app.vercel.app`

## Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VIMEO_CLIENT_ID` | Vimeo app client ID | Yes |
| `VIMEO_CLIENT_SECRET` | Vimeo app client secret | Yes |
| `VIMEO_ACCESS_TOKEN` | Vimeo personal access token | Yes |

## API Endpoints

- `POST /api/upload` - Upload recorded video to Vimeo

## Architecture

```
Frontend (React)
    ↓
Vercel API Routes (/api/upload)
    ↓
Vimeo API (video storage)
    ↓
Supabase (user data & metadata)
```
    ...reactDom.configs.recommended.rules,
  },
})
```
