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
- `POST /api/delhivery/shipment/update`
- `POST /api/delhivery/tracking`
- `POST /api/delhivery/label`
- `POST /api/delhivery/pickup`
- `POST /api/delhivery/ndr`
- `POST /api/delhivery/warehouse/create`
- `GET /api/delhivery/waybill`
- `GET /api/delhivery/tat`
- `GET /api/delhivery/rate`
- `GET /api/delhivery/serviceability/:pincode`

Delhivery tokens are **never** used in the browser.

## Fulfillment flow

Order → Admin opens order → Confirm/Create shipment → AWB saved → Label → Pickup → Tracking → Delivered
