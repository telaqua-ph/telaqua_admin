# Tel-Aqua Admin Dashboard (PH02)

Modern, responsive admin dashboard for Tel-Aqua PH02 — built with React (Vite), React Router, HTML, CSS, and JavaScript.

Connected to the live Tel-Aqua API at `https://telaqua-api.vercel.app`.

## Quick start

```bash
npm install
npm run dev
```

If PowerShell blocks npm:

```powershell
cmd /c "npm run dev"
```

Open the local URL shown in the terminal (usually `http://localhost:5173`).

## Login

Use your real admin credentials from the API.

On success the app stores:

- `token` — JWT
- `admin` — admin profile object

## Features

- JWT authentication with protected routes
- Dashboard summary cards derived from live orders
- Orders list (search, filter, pagination, delete)
- Order details (view + update `order_status` / `payment_status`)
- Settings profile + change password via API
- Products still use local dummy data (API returns 501)

## API layer

| File | Role |
|------|------|
| `src/services/http.js` | Base URL, Bearer token, 401 handling |
| `src/services/api.js` | Auth / orders / products domain methods |

## Project structure

```
src/
├── components/
├── pages/
├── data/
├── services/
│   ├── http.js
│   └── api.js
├── context/
├── routes/
├── App.jsx
└── main.jsx
```
