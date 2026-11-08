# Ztalent Coder

Ztalent Coder website and API. The frontend is a React + Vite website, and the backend is an independent Express application.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- PostgreSQL for future database-backed features; the health endpoint does not connect to the database

## Project structure

```text
ztalent-coder/
|-- frontend/
|   |-- src/
|   |   |-- assets/
|   |   |-- components/
|   |   |   `-- common/
|   |   |-- context/
|   |   |-- hooks/
|   |   |-- layouts/
|   |   |-- pages/
|   |   |   |-- admin/
|   |   |   `-- public/
|   |   |-- routes/
|   |   |-- services/
|   |   `-- styles/
|   |-- index.html
|   |-- package.json
|   `-- vite.config.js
|-- backend/
|   |-- prisma/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   `-- validators/
|   `-- package.json
|-- .gitignore
`-- README.md
```

## Configure environment

From the project root, copy each example file to `.env`:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

The backend listens on port `3000` by default. Vite proxies `/api` requests and `/uploads` images to `http://localhost:3000`; set `VITE_API_PROXY_TARGET` if your backend uses a different local origin. Update `DATABASE_URL` when connecting Prisma to a local PostgreSQL database.

CMS image uploads are saved locally under `backend/uploads/images` and served
by the backend. This is suitable for local development. Production deployments
must mount persistent storage at `backend/uploads`; uploaded images can be lost
when the hosting filesystem is ephemeral. See
[backend setup notes](./backend/README.md#managed-cms-image-uploads) for details.

## Install and run

Open two terminals from the project root.

Frontend terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`.

Backend terminal:

```powershell
Set-Location backend
npm install
npm run dev
```

The API listens at `http://localhost:3000`. Test its health endpoint at `http://localhost:3000/api/health`; it returns `{"status":"ok"}`.

For a production-style API process, run `npm start` from `backend/`. To generate the Prisma client after installing backend dependencies, run `npm run prisma:generate` from `backend/`.
