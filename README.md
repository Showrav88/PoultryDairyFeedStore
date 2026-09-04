# Poultry & Dairy Feed Store SaaS

Multi-tenant SaaS for poultry and dairy feed shops in Bangladesh. Supports full-bag inventory, khugra (fractional) selling, purchases, wallet, analytics, and Bangla/English UI.

## Tech Stack

- **Next.js 16** (App Router)
- **Prisma 7** + PostgreSQL (Neon)
- **Tailwind CSS 4**
- **JWT Auth** (shop-scoped multi-tenancy)
- **Bangla/English** i18n toggle
- **Light / Dark / Night** theme modes

## Getting Started

```bash
cp .env.example .env   # Add your DATABASE_URL
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Khugra (Fractional Bag) Inventory Solution

### The Problem

Shops buy feed in **big bags** (e.g. 50 kg) but also sell in **small quantities** (khugra): 100g, 250g, 500g, 1 kg. The system must track:

1. How many **sealed bags** remain in stock
2. How much is left in the **currently open bag**
3. Automatically **open a new bag** when the open bag runs out during a khugra sale

### The Solution: Three-Field Inventory Model

Every product tracks stock in the **smallest unit** (grams for weight, ml for volume):

| Field | Description | Example (50kg bag) |
|-------|-------------|-------------------|
| `stockInSmallestUnit` | Total stock in grams | 100,000g (2 bags) |
| `closedPackages` | Unopened full bags | 2 |
| `openPackageRemaining` | Left in open bag | 0 (none open) |

### Sale Flow

```
Sell 250g khugra:
  1. If openBag >= 250g → deduct from open bag
  2. Else → open 1 sealed bag, add 50,000g to open bag, then deduct 250g
  3. Update total stock -= 250g
```

### Engine Location

`src/lib/inventory/khugra.ts` — pure functions, fully unit-tested (7 tests).

## Features Built (Phase 1)

| Module | Status |
|--------|--------|
| Shop registration & login | ✅ |
| Multi-tenant data isolation | ✅ |
| Product catalogue (name, image, weight units, khugra presets) | ✅ |
| Auto product ID (NAME-000001, up to 60M) | ✅ |
| Buyer management with search | ✅ |
| Purchases (multi-product, cost per item, DUE/PAID/PARTIAL) | ✅ |
| Sell counter (product cards, khugra units, cart) | ✅ |
| Wallet (deposit, withdraw, expense categories) | ✅ |
| Analytics (day/month/year, top/low products) | ✅ |
| History / audit log with timestamps | ✅ |
| Bangla/English toggle | ✅ |
| Light/Dark/Night themes | ✅ |
| Confirm dialogs before all CRUD | ✅ |

## Roadmap (Phase 2)

- [ ] Cloudinary image upload integration
- [ ] Edit manual entries with wallet balance reconciliation
- [ ] Sale/purchase edit with inventory rollback
- [ ] PWA / offline support
- [ ] Receipt printing
- [ ] SMS notifications for due payments

## Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Project Structure

```
src/
├── app/
│   ├── api/          # REST API routes
│   ├── dashboard/    # Protected pages
│   ├── login/
│   └── register/
├── components/       # UI components
├── lib/
│   ├── inventory/    # Khugra engine
│   ├── i18n/         # Bangla/English
│   ├── auth.ts
│   └── db.ts
└── generated/prisma/ # Prisma client
```
