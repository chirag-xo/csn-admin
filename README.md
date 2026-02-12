# CSNWorld Admin Panel

A secure, role-based admin panel for managing CSNWorld users, roles, and chapters.

## Features

- **Authentication**: Email/password login with JWT sessions
- **Role-Based Access Control (RBAC)**: 5 roles with hierarchical permissions
- **User Management**: View, assign roles, verify, and deactivate users
- **Chapter Management**: Create chapters, manage members, assign presidents
- **Audit Logging**: Track all admin actions
- **Scope Filtering**: Automatic data filtering based on user role and location

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Authentication**: JWT with httpOnly cookies
- **Validation**: Zod
- **Styling**: Tailwind CSS

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"
NODE_ENV="development"
```

### 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates tables)
npm run db:migrate

# Seed database (creates SUPER_ADMIN and states)
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Default Credentials

After seeding, use these credentials to login:

- **Email**: `admin@csnworld.com`
- **Password**: `SuperAdmin@2026!`

⚠️ **IMPORTANT**: Change this password immediately after first login!

## Role Hierarchy

1. **SUPER_ADMIN**: Global access, can assign State Directors
2. **STATE_DIRECTOR**: Manages users in their state, can assign City Directors
3. **CITY_DIRECTOR**: Manages users in their city, can create chapters and assign Presidents
4. **PRESIDENT**: Manages their chapter members
5. **USER**: No admin privileges

## Permission Matrix

| Role | Can View | Can Assign |
|------|----------|------------|
| SUPER_ADMIN | All users | State Director |
| STATE_DIRECTOR | Users in same state | City Director (same state) |
| CITY_DIRECTOR | Users in same city | President (same city) |
| PRESIDENT | Own chapter members | None |
| USER | Self only | None |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users` - List users (scoped by role)
- `PATCH /api/users/[id]/role` - Assign role
- `PATCH /api/users/[id]/verify` - Verify/unverify user
- `PATCH /api/users/[id]/deactivate` - Deactivate user

### Chapters
- `GET /api/chapters` - List chapters (scoped by role)
- `POST /api/chapters` - Create chapter
- `POST /api/chapters/[id]/members` - Add member
- `PATCH /api/chapters/[id]/president` - Assign president
- `DELETE /api/chapters/[id]/members/[userId]` - Remove member

### Helpers
- `GET /api/states` - List all states
- `GET /api/cities?stateId=<id>` - List cities by state

## Database Schema

### Users Table (Extended)
- Extends existing CSN users table
- Adds: `role`, `state_id`, `city_id`, `is_active`, `is_verified`

### New Tables
- `states` - Indian states and UTs
- `cities` - Cities linked to states
- `chapters` - Local chapters
- `chapter_members` - Chapter membership with roles
- `audit_logs` - Admin action tracking

## Security Features

- ✅ httpOnly cookies (no JS access)
- ✅ Backend-only permission enforcement
- ✅ Automatic scope filtering
- ✅ No database credentials exposed to frontend
- ✅ Password hashing with bcrypt
- ✅ JWT expiration (24 hours)
- ✅ Security headers (X-Frame-Options, CSP, etc.)

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
4. Deploy

### Database Setup

1. Run migrations on production database
2. Run seed script to create SUPER_ADMIN
3. Add client as database owner (after approval)

## Project Structure

```
/app
  /api
    /auth          # Authentication endpoints
    /users         # User management
    /chapters      # Chapter management
    /states        # Helper endpoints
    /cities
  /dashboard       # Admin UI
    /users         # Users page
    /chapters      # Chapters page
  /login           # Login page
/components        # React components
/lib               # Utilities
  auth.ts          # JWT & session management
  permissions.ts   # RBAC logic
  validations.ts   # Zod schemas
  audit.ts         # Audit logging
  db.ts            # Prisma client
/prisma
  schema.prisma    # Database schema
  seed.ts          # Seed script
```

## Important Notes

- Users are NOT created through this admin panel (they exist in CSN database)
- Admin panel only assigns roles and manages hierarchy
- All permission checks happen on backend
- Frontend never filters data (backend auto-scopes)
- Audit logs are backend-only (no UI currently)

## Support

For issues or questions, contact the development team.
