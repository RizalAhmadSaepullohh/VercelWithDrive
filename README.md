# I‑Speak: Automated Speech Assessment System

> **Web-based English speaking proficiency assessment powered by AI**

I-Speak adalah sistem penilaian otomatis untuk kemampuan berbicara bahasa Inggris berbasis web. Sistem ini menggunakan teknologi ASR (Automatic Speech Recognition), NLP (Natural Language Processing), dan Machine Learning untuk menganalisis audio speaking dan memberikan skor CEFR (Common European Framework of Reference) dari A1 hingga C2.

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Teknologi Stack](#-teknologi-stack)
- [Quick Start](#-quick-start)
- [Instalasi Detail](#-instalasi-detail)
- [Konfigurasi](#-konfigurasi)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Alur Penilaian](#-alur-penilaian)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## ✨ Fitur Utama

### Assessment Features
- **7 Subconstruct Scoring**: Fluency, Pronunciation, Prosody, Coherence & Cohesion, Topic Relevance, Complexity, Accuracy
- **CEFR Leveling**: Automatic classification dari A1 (Beginner) hingga C2 (Proficient)
- **Real-time Transcription**: ASR menggunakan Whisper Web (WASM) yang berjalan di browser
- **Detailed Analytics**: 39+ fitur linguistik dan akustik yang diekstrak otomatis
- **Multi-task Assessment**: Mendukung 6 tugas speaking dengan kategori berbeda

### Technical Features
- **Client-side Processing**: ASR dan feature extraction di browser (privacy-first)
- **Server-side Inference**: Model ML berjalan di server untuk akurasi tinggi
- **Real-time Feedback**: Progress tracking dan status update real-time
- **Audio Storage**: Upload dan penyimpanan audio ke Supabase Storage
- **Dashboard Admin**: Manajemen mahasiswa, rekaman, dan hasil assessment

## 🛠 Teknologi Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18, Tailwind CSS
- **ASR**: Whisper Web (@remotion/whisper-web) - WASM-based
- **NLP**: compromise.js, @xenova/transformers
- **Audio**: Web Audio API, MediaRecorder API, Meyda (MFCC extraction)

### Backend
- **Runtime**: Node.js 18+
- **API**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth

### Machine Learning
- **Models**: RandomForest (converted to JavaScript via m2cgen)
- **Scaler**: StandardScaler (mean/scale normalization)
- **Features**: 39 numerical features extracted from audio + transcript
- **Output**: 7 subconstruct scores (0-5) → CEFR level (A1-C2)

## 🚀 Quick Start

### Prerequisites
- **Node.js**: 18.x atau 20.x LTS (recommended)
- **Package Manager**: npm, yarn, pnpm, atau bun
- **Browser**: Chrome/Edge 90+ (untuk Web Audio API dan WASM support)
- **Supabase Account**: Untuk database dan storage (gratis tier available)

### Installation

1. **Clone repository**
```bash
git clone https://github.com/afinmh/I-Speak.git
cd I-Speak
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Setup environment variables**
```bash
cp .env.example .env.local
# Edit .env.local dengan credentials Supabase Anda
```

4. **Run development server**
```bash
npm run dev
```

5. **Open browser**
```
http://localhost:3000
```

### First Run Behavior
- ⏳ **Splash screen** akan muncul saat pertama kali dibuka (loading Whisper model ~50MB)
- 📊 **Progress bar** menunjukkan download progress model
- ✅ Model akan di-cache di browser untuk loading berikutnya lebih cepat
- 🔄 Hot reload aktif untuk development

## 📦 Instalasi Detail

### 1. Setup Firebase (Paket Spark Gratis)

#### A. Membuat Proyek di Firebase Console
1. Buka dan masuk ke [console.firebase.google.com](https://console.firebase.google.com/) menggunakan akun Google Anda.
2. Klik tombol **Buat Proyek** (Create Project), beri nama (misalnya: `ispeak-vercel-host`).
3. Nonaktifkan Google Analytics (opsional, agar setup lebih cepat), lalu klik **Buat Proyek**.

#### B. Mengaktifkan Firestore Database
1. Di bilah menu kiri, pilih **Firestore Database**, lalu klik **Buat Database**.
2. Pada aturan lokasi, pilih region terdekat dengan Indonesia (contoh: **`asia-southeast1` (Singapura)** atau **`asia-southeast2` (Jakarta)**).
3. Pilih mode **Mulai dalam Mode Uji (Start in Test Mode)**, yang mengizinkan pembacaan dan penulisan publik secara lancar untuk 30 hari ke depan selama masa pengumpulan data.
4. Klik **Berikutnya / Selesai**.

#### C. Mengaktifkan Firebase Storage (Penyimpanan Audio)
1. Di bilah menu kiri, klik **Storage**, lalu klik **Mulai (Get Started)**.
2. Pilih mode **Mulai dalam Mode Uji (Start in Test Mode)**, lalu pilih lokasi server yang sama dengan Firestore.
3. Setelah *bucket* penyimpanan Anda tercipta, masuk ke tab **Rules (Aturan)** di Storage dan pastikan kodenya seperti berikut agar file WebM dari responden dapat di-upload tanpa kendala autentikasi:
   ```text
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   Lalu klik **Publikasikan (Publish)**.

#### D. Mengambil Kredensial Objek Konfigurasi (firebaseConfig)
1. Buka ikon **Roda Gigi (Project Settings)** di kiri atas.
2. Gulir ke bawah pada bagian **Aplikasi Anda (Your apps)**, lalu klik ikon **Web (`</>`)**.
3. Beri nama julukan aplikasi (misal: `ISpeak Vercel Client`), lalu klik **Daftarkan Aplikasi**.
4. Anda akan melihat blok kode berisi objek `firebaseConfig`. Salin nilai kunci-kunci tersebut.

---

### 2. Konfigurasi Environment Variables

Buat file `.env.local` di direktori utama Anda saat menjalankan di komputer lokal, atau masukkan kunci ini ke dasbor pengaturan **Environment Variables** di Vercel:

```env
# Firebase Configuration Client Keys
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy_GANTI_DENGAN_API_KEY_ANDA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ispeak-vercel-host.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ispeak-vercel-host
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ispeak-vercel-host.appspot.com

# Site Configuration (Optional)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Production (will be auto-set by Vercel)
# VERCEL_URL=your-app.vercel.app
```

**⚠️ Security Notes:**
- `NEXT_PUBLIC_*` variables dapat diakses di browser
- `SUPABASE_SERVICE_ROLE` **JANGAN PERNAH** di-expose ke client
- Gunakan RLS untuk keamanan data di Supabase

### 3. Build for Production

```bash
# Build optimized production bundle
npm run build

# Start production server
npm start

# Or use PM2 for production
pm2 start npm --name "i-speak" -- start
```

## ⚙️ Konfigurasi

### Environment Variables Reference

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | ✅ | Supabase anonymous key (safe for browser) |
| `SUPABASE_URL` | Private | ✅ | Supabase URL for server-side |
| `SUPABASE_SERVICE_ROLE` | Private | ✅ | Service role key (full access, server only) |
| `SUPABASE_BUCKET` | Private | ❌ | Storage bucket name (default: `recordings`) |
| `NEXT_PUBLIC_SITE_URL` | Public | ❌ | Your site URL for model loading fallback |
| `VERCEL_URL` | Public | ❌ | Auto-set by Vercel deployment |

### Model Configuration

Model files terletak di `public/model_js/`:

```
public/model_js/
├── Fluency_rf_model.js          # Fluency prediction model
├── Fluency_scaler.json          # Scaler (mean/scale) untuk Fluency
├── Pronunciation_rf_model.js    # Pronunciation model
├── Pronunciation_scaler.json    # Scaler untuk Pronunciation
├── Prosody_rf_model.js          # Prosody model
├── Prosody_scaler.json          # Scaler untuk Prosody
├── Coherence_and_Cohesion_rf_model.js
├── Coherence_and_Cohesion_scaler.json
├── Topic_Relevance_rf_model.js
├── Topic_Relevance_scaler.json
├── Complexity_rf_model.js
├── Complexity_scaler.json
├── Accuracy_rf_model.js
├── Accuracy_scaler.json
├── CEFR_rf_model.js            # Final CEFR classification
├── English_CEFR_Words.csv      # CEFR word level reference
├── idioms_english.csv          # English idioms database
└── inference_pipeline_info.txt # Pipeline documentation
```

**Scaler Format** (JSON):
```json
{
  "mean": [136.97, 71.05, 1.18, ...],  // Mean dari training data
  "scale": [59.57, 29.88, 0.49, ...],  // Standard deviation
  "var": [3548.97, 893.23, 0.24, ...]  // Variance (optional)
}
```

**Model Loading**:
1. Models di-load on-demand saat API dipanggil
2. Scaler otomatis dimuat dari file JSON
3. Feature standardization: `(value - mean) / scale`
4. Cached di memory untuk performa optimal

## 🏗 Arsitektur Sistem

### Project Structure

```
I-Speak/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (Server-side)
│   │   ├── _utils/              # API utilities
│   │   │   ├── makeRoute.js     # Route factory untuk model endpoints
│   │   │   └── respond.js       # Response helpers
│   │   ├── accuracy/route.js    # Accuracy scoring endpoint
│   │   ├── cefr/route.js       # CEFR classification endpoint
│   │   ├── coherence/route.js  # Coherence scoring
│   │   ├── complexity/route.js # Complexity scoring
│   │   ├── fluency/route.js    # Fluency scoring
│   │   ├── pronunciation/route.js
│   │   ├── prosody/route.js
│   │   ├── topic-relevance/route.js
│   │   ├── dashboard/          # Admin dashboard APIs
│   │   ├── data/               # Data endpoints (bundles, idioms, etc)
│   │   ├── mahasiswa/          # Student management
│   │   ├── rekaman/            # Recording management
│   │   ├── score/              # Score storage
│   │   └── tugas/              # Task management
│   ├── assessment/              # Assessment flow page
│   │   └── page.jsx            # Main assessment interface
│   ├── components/              # React components
│   │   ├── AssessmentFlow.jsx  # Full assessment workflow
│   │   ├── PreloadWhisper.jsx  # Whisper model preloader
│   │   └── ...                 # Other UI components
│   ├── dashboard/               # Admin dashboard
│   │   ├── page.js             # Student list
│   │   ├── [id]/page.js        # Student detail
│   │   ├── tugas/page.js       # Task management
│   │   └── images/page.js      # Image management
│   ├── dataset/                 # Dataset viewer (dev tool)
│   ├── model/                   # Quick test page
│   ├── test/                    # Testing page
│   ├── layout.js               # Root layout
│   ├── page.js                 # Home page
│   └── globals.css             # Global styles
├── hooks/
│   └── useAssessment.js        # Assessment logic hook (39 features)
├── lib/                         # Core utilities
│   ├── datasets.js             # Dataset loaders
│   ├── featureMapping.js       # Feature vector mapping
│   ├── globalWhisperState.js   # Whisper state management
│   ├── interpretation.js       # Score interpretation
│   ├── lexicalBundles.js       # N-gram bundles
│   ├── modelLoader.js          # ML model loader + scaler
│   ├── serverEmbeddings.js     # Server-side embeddings
│   ├── supabaseClient.js       # Supabase client (browser)
│   ├── supabaseServer.js       # Supabase client (server)
│   ├── whisperCppClient.js     # Whisper C++ wrapper
│   ├── whisperSelfTest.js      # Whisper testing utility
│   └── whisperWebClient.js     # Whisper Web (WASM) client
├── public/
│   ├── model_js/               # ML models + scalers + data
│   └── hasil.json              # Sample results
├── .env.local                  # Environment variables (gitignored)
├── .env.example                # Example env file
├── next.config.mjs             # Next.js configuration
├── tailwind.config.js          # Tailwind CSS config
├── package.json                # Dependencies
├── FEATURE_PARITY.md           # Python vs JS feature comparison
└── README.md                   # This file
```

### Component Architecture

```
┌─────────────────────────────────────────────────┐
│               Browser (Client)                  │
├─────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐      │
│  │     UI Components (React)            │      │
│  │  - AssessmentFlow                    │      │
│  │  - PreloadWhisper                    │      │
│  │  - Dashboard                         │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│  ┌──────────────▼───────────────────────┐      │
│  │   useAssessment Hook                 │      │
│  │  - Audio Recording                   │      │
│  │  - Feature Extraction (39 features)  │      │
│  │  - Whisper Transcription (WASM)      │      │
│  └──────────────┬───────────────────────┘      │
│                 │ Fetch API                     │
└─────────────────┼─────────────────────────────┘
                  │
┌─────────────────▼─────────────────────────────┐
│            Server (Next.js API)               │
├───────────────────────────────────────────────┤
│  ┌────────────────────────────────────┐       │
│  │   API Routes                       │       │
│  │  /api/fluency                      │       │
│  │  /api/pronunciation                │       │
│  │  /api/prosody                      │       │
│  │  /api/coherence                    │       │
│  │  /api/topic-relevance              │       │
│  │  /api/complexity                   │       │
│  │  /api/accuracy                     │       │
│  │  /api/cefr ← (uses 7 scores)      │       │
│  └────────────┬───────────────────────┘       │
│               │                                │
│  ┌────────────▼───────────────────────┐       │
│  │   modelLoader.js                   │       │
│  │  - Load ML models (.js files)      │       │
│  │  - Load scalers (.json files)      │       │
│  │  - Apply standardization           │       │
│  │  - Run predictions                 │       │
│  └────────────┬───────────────────────┘       │
│               │                                │
│  ┌────────────▼───────────────────────┐       │
│  │   ML Models (RandomForest → JS)    │       │
│  │  - Feature scaling                 │       │
│  │  - Tree ensemble prediction        │       │
│  │  - Return scores (0-5 or A1-C2)    │       │
│  └────────────────────────────────────┘       │
└───────────────────────────────────────────────┘
                  │
┌─────────────────▼─────────────────────────────┐
│              Supabase                         │
├───────────────────────────────────────────────┤
│  - PostgreSQL Database                        │
│    • mahasiswa, tugas, rekaman, score         │
│  - Storage (Audio files)                      │
│  - Authentication (optional)                  │
│  - RLS (Row Level Security)                   │
└───────────────────────────────────────────────┘
```

### Data Flow

1. **Recording** → MediaRecorder API captures audio
2. **Upload** → Audio sent to Supabase Storage
3. **Transcription** → Whisper Web (WASM) generates transcript
4. **Feature Extraction** → 39 numerical features computed
5. **Scoring** → 7 API calls to subconstruct endpoints
6. **Standardization** → Features scaled using JSON scalers
7. **Prediction** → RandomForest models predict scores (0-5)
8. **CEFR** → 7 scores → CEFR model → Final level (A1-C2)
9. **Storage** → Results saved to Supabase `score` table

## 🎯 Alur Penilaian

### Complete Assessment Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Student Registration                                 │
│    • Input: Nama, NIM                                   │
│    • Create/Find student in database                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 2. Task Selection (6 tasks)                             │
│    • Category: Personal, Academic, Opinion              │
│    • Preparation time: 30-45 seconds                    │
│    • Recording time: 60-120 seconds                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 3. Audio Recording                                      │
│    • MediaRecorder API captures audio                   │
│    • Real-time visualization (waveform)                 │
│    • Countdown timer                                    │
│    • Format: WebM/MP4 (browser dependent)               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 4. Audio Upload                                         │
│    • Upload to Supabase Storage (bucket: recordings)    │
│    • Generate public URL                                │
│    • Store metadata in rekaman table                    │
│    • Rekaman ID returned for tracking                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 5. Transcription (ASR)                                  │
│    • Whisper Web (WASM) runs in browser                 │
│    • Model: tiny.en (~50MB, cached)                     │
│    • Output: Full transcript + word segments            │
│    • Processing time: ~2-5 seconds per 60s audio        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 6. Feature Extraction (Client-side)                     │
│    ┌────────────────────────────────────────────────┐   │
│    │ Audio Features (24)                            │   │
│    │  • Duration, MFCC%, Pause Frequency            │   │
│    │  • Pitch (mean/std/range), Energy (mean/std)   │   │
│    │  • Prosody prominences (peaks/distance)        │   │
│    │  • Articulation Rate, MLR, WPM, WPS            │   │
│    │  • Long Pause duration                         │   │
│    └────────────────────────────────────────────────┘   │
│    ┌────────────────────────────────────────────────┐   │
│    │ Text Features (15)                             │   │
│    │  • Token/Type Count, TTR                       │   │
│    │  • Linking words, Discourse markers            │   │
│    │  • Filled pauses, Grammar errors               │   │
│    │  • Synonym variations, Tree depth              │   │
│    │  • Idioms, N-grams (bi/tri/four)               │   │
│    │  • CEFR word distribution (A1-C2/Unknown)      │   │
│    │  • Semantic coherence, Topic similarity        │   │
│    └────────────────────────────────────────────────┘   │
│    Total: 39 numerical features                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 7. Subconstruct Scoring (Server-side)                   │
│    • POST /api/fluency          → Score (0-5)           │
│    • POST /api/pronunciation    → Score (0-5)           │
│    • POST /api/prosody          → Score (0-5)           │
│    • POST /api/coherence        → Score (0-5)           │
│    • POST /api/topic-relevance  → Score (0-5)           │
│    • POST /api/complexity       → Score (0-5)           │
│    • POST /api/accuracy         → Score (0-5)           │
│    ─────────────────────────────────────────────────    │
│    Each endpoint:                                       │
│    1. Receives feature subset (per subconstruct)        │
│    2. Loads scaler JSON (mean/scale)                    │
│    3. Standardizes: (value - mean) / scale              │
│    4. Runs RandomForest model (JavaScript)              │
│    5. Returns numeric score 0-5                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 8. CEFR Classification (Server-side)                    │
│    • POST /api/cefr                                     │
│    • Input: 7 subconstruct scores [0-5, 0-5, ...]      │
│    • No scaling needed (scores already normalized)      │
│    • CEFR RandomForest model predicts final level       │
│    • Output: A1, A2, B1, B2, C1, or C2                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 9. Result Storage                                       │
│    • POST /api/score/batch                              │
│    • Saves to score table:                              │
│      - rekaman_id (FK to rekaman)                       │
│      - fluency, pronunciation, prosody, ...             │
│      - cefr (final level)                               │
│      - features (JSONB with all 39 features)            │
│      - created_at                                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 10. UI Display                                          │
│    • Show CEFR level (large, prominent)                 │
│    • Show 7 subconstruct scores with labels             │
│    • Display transcript with highlights                 │
│    • Audio playback controls                            │
│    • Detailed feature breakdown (collapsible)           │
└─────────────────────────────────────────────────────────┘
```

### Key Components

**Client-side** (`hooks/useAssessment.js`):
- `decodeFileToAudioBuffer()` - Convert audio file to AudioBuffer
- `computeEnergyFeatures()` - Extract RMS energy per frame
- `computeProsodyFeatures()` - Pitch, energy, prominences
- `computeMFCCFeatures()` - MFCC extraction using Meyda
- `computeGrammarErrors()` - Enhanced heuristic grammar checking
- `computeSemanticCoherence()` - Sentence embedding similarity
- `embedSentences()` - Use Xenova transformers for embeddings
- `mfccFramesFromTTS()` - TTS reference for pronunciation

**Server-side** (`lib/modelLoader.js`):
- `loadModel()` - Load RandomForest JS model + scaler
- `loadScaler()` - Read scaler JSON (mean/scale)
- `scaleVector()` - Apply standardization
- `predict()` - Run model inference

## 📡 API Documentation

### Model Endpoints

All model endpoints accept `POST` request with JSON body containing `features` object.

#### Base URL
```
http://localhost:3000/api  (development)
https://your-app.vercel.app/api  (production)
```

### Subconstruct Scoring APIs

#### 1. Fluency Score
```http
POST /api/fluency
Content-Type: application/json

{
  "features": {
    "Durasi (s)": number,
    "Pause Freq": number,
    "Articulation Rate": number,
    "MLR": number,
    "WPM": number,
    "Total Words": number,
    "Long Pause (s)": number
  }
}
```

**Response:**
```json
{
  "model": "Fluency",
  "featureOrder": ["Durasi (s)", "Pause Freq", ...],
  "inputVector": [12.5, 0.18, 3.4, ...],
  "result": 3.2
}
```

#### 2. Pronunciation Score
```http
POST /api/pronunciation
Content-Type: application/json

{
  "features": {
    "Articulation Rate": number,
    "Pitch Range (Hz)": number,
    "MFCC (%)": number
  }
}
```

#### 3. Prosody Score
```http
POST /api/prosody

{
  "features": {
    "Mean Pitch": number,
    "Stdev Pitch": number,
    "Num Prominences": number,
    "Prominence Dist Mean": number,
    "Pitch Range (Hz)": number,
    "MFCC (%)": number,
    "WPS": number
  }
}
```

#### 4. Coherence & Cohesion Score
```http
POST /api/coherence

{
  "features": {
    "Semantic Coherence (%)": number,
    "Linking Count": number,
    "Discourse Count": number
  }
}
```

#### 5. Topic Relevance Score
```http
POST /api/topic-relevance

{
  "features": {
    "Topic Similarity (%)": number
  }
}
```

#### 6. Complexity Score
```http
POST /api/complexity

{
  "features": {
    "Idioms Found": number,
    "Bigram Count": number,
    "Trigram Count": number,
    "Fourgram Count": number,
    "Synonym Variations": number,
    "CEFR A1": number,
    "CEFR A2": number,
    "CEFR B1": number,
    "CEFR B2": number,
    "CEFR C1": number,
    "CEFR C2": number,
    "CEFR UNKNOWN": number,
    "Avg Tree Depth": number,
    "Max Tree Depth": number,
    "Durasi (s)": number,
    "Token Count": number,
    "TTR": number
  }
}
```

#### 7. Accuracy Score
```http
POST /api/accuracy

{
  "features": {
    "Grammar Errors": number
  }
}
```

### CEFR Classification API

**Special**: This endpoint automatically calculates all 7 subconstruct scores internally.

```http
POST /api/cefr
Content-Type: application/json

{
  "features": {
    // All 39 features required
    "Durasi (s)": 12.5,
    "MFCC (%)": 65.3,
    "Semantic Coherence (%)": 72.1,
    "Pause Freq": 0.18,
    "Token Count": 125,
    "Type Count": 85,
    "TTR": 0.68,
    "Pitch Range (Hz)": 112.4,
    "Articulation Rate": 3.45,
    "MLR": 5.2,
    "Mean Pitch": 182.5,
    "Stdev Pitch": 26.3,
    "Mean Energy": 0.125,
    "Stdev Energy": 0.032,
    "Num Prominences": 8,
    "Prominence Dist Mean": 0.42,
    "Prominence Dist Std": 0.09,
    "WPM": 125,
    "WPS": 2.08,
    "Total Words": 150,
    "Linking Count": 6,
    "Discourse Count": 3,
    "Filled Pauses": 4,
    "Long Pause (s)": 0.85,
    "Topic Similarity (%)": 68.2,
    "Grammar Errors": 3,
    "Idioms Found": 2,
    "CEFR A1": 12,
    "CEFR A2": 18,
    "CEFR B1": 35,
    "CEFR B2": 28,
    "CEFR C1": 6,
    "CEFR C2": 1,
    "CEFR UNKNOWN": 5,
    "Bigram Count": 22,
    "Trigram Count": 12,
    "Fourgram Count": 6,
    "Synonym Variations": 15,
    "Avg Tree Depth": 2.3,
    "Max Tree Depth": 7
  }
}
```

**Response:**
```json
{
  "model": "CEFR",
  "inputVector": [3.2, 3.5, 3.8, 3.1, 3.6, 3.4, 4.1],
  "result": "B2",
  "meta": {
    "subconstructOrder": [
      "Fluency",
      "Pronunciation", 
      "Prosody",
      "Coherence and Cohesion",
      "Topic Relevance",
      "Complexity",
      "Accuracy"
    ],
    "subconstructVectors": { ... },
    "subconstructRaw": {
      "Fluency": 3.2,
      "Pronunciation": 3.5,
      "Prosody": 3.8,
      "Coherence and Cohesion": 3.1,
      "Topic Relevance": 3.6,
      "Complexity": 3.4,
      "Accuracy": 4.1
    }
  }
}
```

### Data Endpoints

#### Get CEFR Word Distribution
```http
POST /api/data/cefr
Content-Type: application/json

{
  "text": "Your transcript here..."
}
```

**Response:**
```json
{
  "distribution": {
    "A1": 15,
    "A2": 20,
    "B1": 35,
    "B2": 18,
    "C1": 8,
    "C2": 2,
    "UNKNOWN": 12
  },
  "wordLevels": {
    "hello": "A1",
    "university": "B1",
    "sophisticated": "C1"
  }
}
```

#### Find Idioms
```http
POST /api/data/idioms

{
  "text": "Break the ice and piece of cake are idioms."
}
```

**Response:**
```json
{
  "count": 2,
  "idioms": [
    "break the ice",
    "piece of cake"
  ]
}
```

#### Find Lexical Bundles
```http
POST /api/data/bundles

{
  "text": "In my opinion, it is important to note that..."
}
```

**Response:**
```json
{
  "bigram_count": 15,
  "trigram_count": 8,
  "fourgram_count": 3,
  "bigram_matches": ["in my", "my opinion", ...],
  "trigram_matches": ["in my opinion", ...],
  "fourgram_matches": ["it is important to"]
}
```

#### Calculate Topic Similarity
```http
POST /api/data/topic-similarity

{
  "text": "Student response text...",
  "reference": "Topic prompt or reference text..."
}
```

**Response:**
```json
{
  "similarityPercent": 72.5
}
```

### Error Response Format

All endpoints return errors in consistent format:

```json
{
  "error": true,
  "message": "Error description",
  "details": { ... }
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing/invalid features)
- `404` - Not Found
- `500` - Internal Server Error (model loading/prediction failed)

## 🗄 Database Schema

### Tables

#### 1. `mahasiswa` (Students)
```sql
CREATE TABLE mahasiswa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  nim TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `nama` | TEXT | Student name |
| `nim` | TEXT | Student ID (unique) |
| `created_at` | TIMESTAMPTZ | Registration timestamp |

#### 2. `tugas` (Tasks)
```sql
CREATE TABLE tugas (
  id SERIAL PRIMARY KEY,
  judul TEXT NOT NULL,
  kategori TEXT NOT NULL,
  teks TEXT NOT NULL,
  prep_time INTEGER DEFAULT 30,
  record_time INTEGER DEFAULT 60
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `judul` | TEXT | Task title |
| `kategori` | TEXT | Category (Personal, Academic, Opinion) |
| `teks` | TEXT | Task prompt/question |
| `prep_time` | INTEGER | Preparation time (seconds) |
| `record_time` | INTEGER | Recording time (seconds) |

#### 3. `rekaman` (Recordings)
```sql
CREATE TABLE rekaman (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mahasiswa_id UUID REFERENCES mahasiswa(id) ON DELETE CASCADE,
  tugas_id INTEGER REFERENCES tugas(id),
  audio_url TEXT,
  durasi REAL,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `mahasiswa_id` | UUID | Foreign key to mahasiswa |
| `tugas_id` | INTEGER | Foreign key to tugas |
| `audio_url` | TEXT | Supabase Storage URL |
| `durasi` | REAL | Audio duration (seconds) |
| `transcript` | TEXT | Whisper transcription |
| `created_at` | TIMESTAMPTZ | Recording timestamp |

#### 4. `score` (Assessment Results)
```sql
CREATE TABLE score (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rekaman_id UUID REFERENCES rekaman(id) ON DELETE CASCADE,
  fluency REAL,
  pronunciation REAL,
  prosody REAL,
  coherence_cohesion REAL,
  topic_relevance REAL,
  complexity REAL,
  accuracy REAL,
  cefr TEXT,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `rekaman_id` | UUID | Foreign key to rekaman |
| `fluency` | REAL | Fluency score (0-5) |
| `pronunciation` | REAL | Pronunciation score (0-5) |
| `prosody` | REAL | Prosody score (0-5) |
| `coherence_cohesion` | REAL | Coherence score (0-5) |
| `topic_relevance` | REAL | Topic relevance score (0-5) |
| `complexity` | REAL | Complexity score (0-5) |
| `accuracy` | REAL | Accuracy score (0-5) |
| `cefr` | TEXT | CEFR level (A1-C2) |
| `features` | JSONB | All 39 features (for debugging) |
| `created_at` | TIMESTAMPTZ | Assessment timestamp |

### Relationships

```
mahasiswa (1) ──────< (N) rekaman
                          │
                          │
                          └──────< (N) score
                          
tugas (1) ──────< (N) rekaman
```

### Storage Buckets

#### `recordings` bucket
- **Purpose**: Store audio files
- **Access**: Public or authenticated (configurable via RLS)
- **Path format**: `{mahasiswa_id}/{rekaman_id}.webm`
- **Max size**: Configurable (recommended: 10MB per file)

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect Repository**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

2. **Configure Environment Variables**
- Go to Vercel Dashboard → Project Settings → Environment Variables
- Add all variables from `.env.local`

3. **Build Configuration**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Build and Run:**
```bash
docker build -t i-speak .
docker run -p 3000:3000 --env-file .env.local i-speak
```

### Environment Variables for Production

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`

**Optional but Recommended:**
- `NEXT_PUBLIC_SITE_URL` (for model loading fallback)
- `SUPABASE_BUCKET` (default: recordings)

### Performance Optimization

1. **Enable caching** for model files:
```javascript
// next.config.mjs
export default {
  async headers() {
    return [
      {
        source: '/model_js/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

2. **CDN Configuration**:
- Model files (~50MB total) should be served from CDN
- Audio files served from Supabase Storage (with CDN)
- Static assets cached at edge

3. **Database Indexes**:
```sql
CREATE INDEX idx_rekaman_mahasiswa ON rekaman(mahasiswa_id);
CREATE INDEX idx_score_rekaman ON score(rekaman_id);
CREATE INDEX idx_rekaman_created ON rekaman(created_at DESC);
```

## 📊 Feature Parity

### Python vs Next.js Implementation

Lihat dokumen lengkap: **[FEATURE_PARITY.md](./FEATURE_PARITY.md)**

#### Summary Status

| Feature | Python | Next.js | Status |
|---------|--------|---------|:------:|
| ASR (Whisper) | PyTorch | WASM | 🟡 Different engines |
| Semantic Coherence | SBERT | Xenova | ✅ Equivalent |
| MFCC (%) | Librosa | Meyda + TTS | ✅ Equivalent |
| Prosody Features | Librosa | Web Audio API | ✅ Equivalent |
| Grammar Errors | TextBlob | Enhanced Heuristics | ✅ Improved |
| Feature Scaling | StandardScaler | JSON Scalers | ✅ Complete |
| CEFR Pipeline | 7 scores → RF | 7 scores → RF | ✅ Complete |
| Lexical Bundles | NLTK | Custom regex | ✅ Equivalent |
| Idioms Detection | List matching | List matching | ✅ Equivalent |

**Key Achievements:**
- ✅ All 39 features implemented
- ✅ Feature scaling from training data (JSON scalers)
- ✅ 7 subconstruct models with proper standardization
- ✅ CEFR model using 7 scores (no placeholder)
- ✅ Enhanced grammar checking (10+ rules)
- ✅ Complete assessment pipeline

**Known Differences:**
- ASR engine: Whisper Web (WASM) vs PyTorch (slightly different segmentation)
- Embeddings: Xenova transformers vs sentence-transformers (conceptually equivalent)
- Performance: Client-side feature extraction (privacy-first)

## 🐛 Troubleshooting

### Common Issues

#### 1. Whisper Model Loading Failed

**Symptoms:**
- Splash screen stuck at loading
- Console error: "Failed to load Whisper model"

**Solutions:**
```bash
# Clear browser cache
# Chrome: DevTools → Application → Clear Storage

# Check network tab for model download
# Model size: ~50MB (tiny.en)

# Try different browser (Chrome/Edge recommended)
```

**Requirements:**
- WebAssembly support (Chrome 90+, Edge 90+, Firefox 89+)
- Sufficient memory (~200MB RAM for tiny.en model)
- Stable internet connection for first download

#### 2. Model Files Not Found (404)

**Symptoms:**
- API returns 500 error
- Console: "Failed to load model from /model_js/..."

**Solutions:**
```bash
# Check if files exist
ls public/model_js/

# Verify NEXT_PUBLIC_SITE_URL in production
echo $NEXT_PUBLIC_SITE_URL

# For Vercel, ensure public folder is included in deployment
# Check vercel.json or .vercelignore
```

#### 3. Supabase Connection Failed

**Symptoms:**
- "Invalid API key" error
- Database queries fail
- Upload audio fails

**Solutions:**
```bash
# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Check Supabase dashboard for correct keys
# Settings → API → Project API keys

# Test connection
curl https://your-project.supabase.co/rest/v1/
```

**Common mistakes:**
- Using service role key in client (security risk!)
- Wrong project URL (check subdomain)
- RLS policies blocking queries

#### 4. Audio Recording Not Working

**Symptoms:**
- "Permission denied" for microphone
- No audio captured
- MediaRecorder error

**Solutions:**
```javascript
// Check browser permissions
navigator.permissions.query({name: 'microphone'})
  .then(result => console.log(result.state));

// Ensure HTTPS in production (mic requires secure context)
// localhost is allowed for development

// Check supported formats
console.log(MediaRecorder.isTypeSupported('audio/webm'));
console.log(MediaRecorder.isTypeSupported('audio/mp4'));
```

#### 5. Feature Extraction Errors

**Symptoms:**
- NaN or Infinity in features
- MFCC extraction fails
- Pitch detection returns null

**Solutions:**
```javascript
// Check audio buffer
console.log('Sample rate:', audioBuffer.sampleRate);
console.log('Duration:', audioBuffer.duration);
console.log('Channels:', audioBuffer.numberOfChannels);

// Minimum audio length: 0.8 seconds
// Recommended: 10+ seconds for accurate features

// Check for silent audio (energy too low)
const rms = computeRMS(audioBuffer);
if (rms < 0.001) console.warn('Audio too quiet');
```

#### 6. Slow Performance

**Symptoms:**
- Assessment takes >30 seconds
- UI freezes during processing
- High memory usage

**Solutions:**
```javascript
// Use Web Workers for heavy computation (planned)
// Optimize feature extraction loops
// Reduce audio quality if needed (sample rate)

// Check browser performance
// DevTools → Performance → Record

// Monitor memory
// DevTools → Memory → Take heap snapshot
```

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('DEBUG', 'i-speak:*');

// Check logs
// Feature extraction timing
// Model loading status
// API call responses
```

### Getting Help

1. **Check logs**:
   - Browser console (F12)
   - Server logs (`npm run dev`)
   - Vercel deployment logs

2. **GitHub Issues**: [Report bugs](https://github.com/afinmh/I-Speak/issues)

3. **Documentation**: Read [FEATURE_PARITY.md](./FEATURE_PARITY.md)

## 🧪 Testing

### Manual Testing

```bash
# Run dev server
npm run dev

# Open test page
http://localhost:3000/test

# Quick model test
http://localhost:3000/model
```

### API Testing

```bash
# Test fluency endpoint
curl -X POST http://localhost:3000/api/fluency \
  -H "Content-Type: application/json" \
  -d '{"features": {"Durasi (s)": 10, "Pause Freq": 0.2, ...}}'

# Test CEFR endpoint
curl -X POST http://localhost:3000/api/cefr \
  -H "Content-Type: application/json" \
  -d '{"features": {...39 features...}}'
```

### Database Testing

```sql
-- Check student count
SELECT COUNT(*) FROM mahasiswa;

-- Check recent recordings
SELECT * FROM rekaman ORDER BY created_at DESC LIMIT 5;

-- Check score distribution
SELECT cefr, COUNT(*) FROM score GROUP BY cefr;
```

## 🤝 Contributing

### Development Workflow

1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Style

- **Format**: Use Prettier (auto-format on save)
- **Linting**: ESLint rules in `eslint.config.mjs`
- **Naming**: camelCase for functions, PascalCase for components
- **Comments**: JSDoc for public APIs

## 🙏 Acknowledgments

- **Whisper**: OpenAI's ASR model
- **Remotion**: Whisper Web (WASM) implementation
- **Xenova**: Transformers.js for embeddings
- **Supabase**: Backend infrastructure
- **Next.js**: React framework
- **Vercel**: Hosting platform

---

**I-Speak** - Automated Speech Assessment System  
Built with ❤️ using Next.js, AI, and Modern Web Technologies

For technical details, see [FEATURE_PARITY.md](./FEATURE_PARITY.md)
