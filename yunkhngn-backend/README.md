<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="64" alt="NestJS Logo" />
</p>

# yunkhngn-be

> Backend API for [yunkhngn.dev](https://yunkhngn.dev) — a personal portfolio, blog, and photography platform.

Built with **NestJS 11**, **Prisma**, **SQL Server**, and a **modular repository-pattern architecture**.

---

## Architecture

```
src/
├── common/                        # Shared utilities
│   ├── decorators/                # Custom decorators (@Roles, @User)
│   ├── filters/                   # Exception filters (HttpException, AllExceptions)
│   ├── guards/                    # Auth guards (Firebase, API Key, Roles)
│   ├── interceptors/              # Logging & Transform interceptors
│   └── encryption.service.ts      # AES encryption for settings
├── config/                        # App, database, redis, firebase config
├── database/
│   └── prisma/                    # PrismaService & PrismaModule
├── modules/
│   ├── ai/                        # Gemini AI — text gen, blog drafts, chat
│   ├── album/                     # Photo album management
│   ├── auth/                      # Firebase Auth strategy & decorators
│   ├── blog/                      # Blog posts (CRUD, views, SEO)
│   ├── chat/                      # WebSocket real-time chat
│   ├── comments/                  # Comments with votes, reports, moderation
│   ├── contact/                   # Contact form, AI email composition
│   ├── gallery/                   # Photo gallery with EXIF, blurhash, tags
│   ├── health/                    # Health check endpoint
│   ├── integrations/
│   │   ├── cloudflare/            # Cloudflare analytics
│   │   ├── cloudinary/            # Image upload & management
│   │   ├── email/                 # Resend email service
│   │   ├── github/                # GitHub API integration
│   │   ├── lastfm/                # Last.fm now playing
│   │   └── newsletter/            # Subscriber management & bulk send
│   ├── journal/                   # Short-form journal entries with reactions
│   ├── letter/                    # Handwritten letter sharing (with AI processing)
│   ├── media/                     # Cloudinary media browser
│   ├── notifications/             # In-app admin notifications
│   ├── photo-reactions/           # Photo emoji reactions (heart, fire, etc.)
│   ├── project/                   # Project portfolio (CRUD, tech stack)
│   ├── settings/                  # Encrypted key-value settings store
│   ├── shortlink/                 # URL shortener with click tracking
│   ├── system/                    # System stats (CPU, memory, DB)
│   └── user/                      # User management via Firebase
└── main.ts                        # Bootstrap, CORS, Swagger, Firebase init
```

### Design Patterns

- **Repository Pattern** — Every domain module uses an interface (`domain/`) and a Prisma implementation (`infrastructure/`), injected via NestJS DI with `Symbol` tokens.
- **Modular Architecture** — Each feature is a self-contained NestJS module with its own controller, service, DTOs, and repository.
- **Guards & Interceptors** — `FirebaseAuthGuard`, `RolesGuard`, `ApiKeyGuard` for auth; `LoggingInterceptor`, `TransformInterceptor` globally.

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Framework | NestJS 11 |
| Language | TypeScript 5.7 |
| ORM | Prisma 5 |
| Database | SQL Server (Azure SQL Edge) |
| Cache | Redis via `cache-manager` |
| Auth | Firebase Admin SDK |
| AI | Google Gemini (`@google/generative-ai`) |
| Email | Resend |
| Storage | Cloudinary |
| Docs | Swagger (`@nestjs/swagger`) |
| WebSocket | Socket.IO |
| Testing | Jest + ts-jest |

---

## Getting Started

### Prerequisites

- Node.js 20+
- SQL Server or Azure SQL Edge
- Redis
- Firebase project (service account JSON)
- Cloudinary account

### Installation

```bash
# Clone
git clone https://github.com/yunkhngn/yunkhngn-be.git
cd yunkhngn-be

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start development server
npm run start:dev
```

### Environment Variables

```env
# Database
DATABASE_URL="sqlserver://localhost:1433;database=blogdb;user=sa;password=...;encrypt=false"

# Server
PORT=3001
REDIS_HOST=localhost
CORS_ORIGIN=http://localhost:3000

# Firebase Admin SDK
FIREBASE_CREDENTIALS="./firebase-admin-sdk.json"

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# External Services
FRONTEND_URL=http://localhost:3000
LETTER_AI_URL=http://localhost:8000
```

---

## API Documentation

Swagger UI is available at `/api/docs` when the server is running.

All controllers are tagged for easy navigation:

| Tag | Endpoints | Auth |
|:----|:----------|:-----|
| Blog | `/blogs` | Public read, Admin write |
| Project | `/projects` | Public read, Admin write |
| Gallery | `/gallery` | Public read, Admin write |
| Album | `/albums` | Public read, Admin write |
| Comments | `/comments` | Firebase auth for write |
| Contact | `/contact` | Public submit, Admin manage |
| Journal | `/journals` | Public read, Admin write |
| Letter | `/letters` | Public access via code, Admin manage |
| Shortlink | `/shortlinks` | Admin only |
| Newsletter | `/newsletter` | Public subscribe, Admin send |
| Photo Reactions | `/photo-reactions` | Firebase auth |
| AI | `/ai` | Firebase auth |
| Settings | `/settings` | Public read, Admin write |
| Notifications | `/notifications` | Admin only |
| Media | `/media` | Admin only |
| System | `/system` | Firebase auth |
| User | `/user` | Firebase auth |
| Cloudflare | `/admin/analytics` | Admin only |
| GitHub | `/github` | Public |
| LastFm | `/lastfm` | Public |
| Health | `/health` | Public |

---

## Scripts

```bash
npm run build          # Production build
npm run start:dev      # Dev server with hot reload
npm run start:prod     # Start production build
npm run test           # Run unit tests (79 tests)
npm run test:cov       # Run tests with coverage
npm run lint           # ESLint
npm run format         # Prettier
```

---

## Testing

Unit tests use Jest with repository interface mocks (no database needed).

```bash
# Run all tests
npm run test

# Run specific module tests
npx jest src/modules/blog/blog.service.spec.ts

# Watch mode
npm run test:watch
```

**Test count:** 20 suites, 79 tests — all passing.

---

## Deployment

The backend is deployed as a Docker container via GitHub Actions CI/CD:

```dockerfile
# Built image pushed to ghcr.io/yunkhngn/yunkhngn-backend:latest
```

In production, it runs behind Caddy reverse proxy alongside Redis, SQL Server, and the AI microservice via Docker Compose.

---

## License

Private — All rights reserved.
