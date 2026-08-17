# Tel-Aqua Admin Dashboard (PH02)

Shopify-style order & fulfillment admin for Tel-Aqua, connected to Hostinger.

## API base URL

```env
VITE_API_URL=https://lightpink-reindeer-561421.hostingersite.com
```

Configured in `.env.development` and `.env.production`. All requests go through `src/services/http.js`.

## Quick start

```bash
npm install
npm run dev
```

If PowerShell blocks npm:

```powershell
cmd /c "npm run dev"
```

## Integrated APIs

### Auth / Orders
- `POST /api/auth/login`
- `GET|PUT /api/auth/profile`
- `PUT /api/auth/change-password`
- `GET /api/orders`
- `GET|PUT|DELETE /api/orders/:id`

### Delhivery (via Hostinger only)
- `POST /api/delhivery/shipment/create`
- `POST /api/delhivery/create-shipment` (alias)

Delhivery tokens are **never** used in the browser.

## Fulfillment flow

Order → Admin opens order → Send to Delhivery → AWB saved in Neon → remaining logistics in Delhivery One
