# AssetPro v2 — Strong Built Asset Management

Full-stack asset management with role-based access, live sync, QR stickers, and an interactive dashboard.

---

## ⚡ Deploy in 15 Minutes

### Step 1 — Supabase Database (free)

1. Sign up at [supabase.com](https://supabase.com) → **New Project**
2. Wait ~2 min for it to provision
3. Go to **SQL Editor** → paste the full contents of `supabase-setup.sql` → **Run**
4. Go to **Settings → API** → copy:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ…`)
5. Go to **Authentication → Providers** → make sure **Email** is enabled

### Step 2 — Deploy to Netlify

**Drag & Drop:**
```bash
npm install
npm run build
# Drag the dist/ folder to netlify.com/drop
```

**Or via GitHub (auto-deploys on push):**
1. Push this folder to GitHub
2. Netlify → Import from Git → select repo
3. Build command: `npm run build` · Publish directory: `dist`

**Add environment variables in Netlify** (Site settings → Environment variables):
```
VITE_SUPABASE_URL       = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY  = eyJxxxx...
```
Then **Trigger redeploy**.

### Step 3 — Make yourself Admin

1. Visit your Netlify URL → Register an account
2. In Supabase → **SQL Editor** → run:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
   ```
3. Sign out and back in → you now have full Admin access ✅

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Admin** | Everything — users, permissions, fields, delete, stickers, import |
| **Moderator** | Configurable by Admin — can add/edit/print (no delete by default) |
| **User** | QR scan only — sees only the scanned asset's public page |

### How roles are assigned
- Everyone who registers starts as a **User**
- Admin assigns Moderator or Admin roles from the **Admin Panel → Users tab**
- Admin can deactivate accounts instantly

---

## 🔐 Permission System

Admins can control per-permission for Moderators:
- ✅ Add Assets
- ✅ Edit All Fields / Edit Location Only / Edit Status Only
- ✅ Delete Assets (off by default)
- ✅ Print Stickers
- ✅ Export Excel
- ✅ Import Excel

Admins can also:
- **Hide any field** globally (hidden from Mods and Users)
- **Control QR scan page** — choose which fields appear when a non-logged-in user scans a QR
- **Add custom fields** (text, number, date, dropdown) that appear on all assets

---

## 🏷️ Sticker Designer

- **A6 (105×74mm)** and **A8 (52×74mm)** sizes with live toggle
- **Fully customisable**: header colour, accent colour, body colour, text colours
- **Font size control**: asset code, field values, labels — all adjustable with sliders
- **Field visibility**: toggle which fields appear on the sticker
- **QR size control**: adjust QR code size on the sticker
- **Corner radius**: adjust rounded corners
- **Static QR codes**: generated once from the asset ID, **never change** even if you edit the asset
- QR links to `/scan/[asset-id]` — a public page requiring no login

---

## 📊 Dashboard

- Live asset count, active/repair/location stats
- Status breakdown pie chart
- Assets by category bar chart
- Top locations progress bars
- Recently added assets table
- All charts powered by Recharts

---

## 📋 All 14 Asset Fields

Asset Code · Asset Name · Make · Model No · Purchase Order No · Serial No · Capacity · Status · Category · Type Code · Purchase Date · Location · Notes · Added On

Plus unlimited **custom fields** (admin can add any time).

---

## 📁 Project Structure

```
src/
├── context/AuthContext.jsx     ← Auth + permissions + field definitions
├── lib/supabase.js             ← All DB functions
├── components/Layout.jsx       ← Sidebar + topbar
├── pages/
│   ├── LoginPage.jsx           ← Sign in / register
│   ├── Dashboard.jsx           ← Charts + stats
│   ├── AssetList.jsx           ← Table with filters
│   ├── AssetForm.jsx           ← Add / edit (role-aware)
│   ├── AssetDetail.jsx         ← Full detail + QR + audit
│   ├── StickerPage.jsx         ← Sticker designer + print
│   ├── ExcelImport.jsx         ← Bulk upload
│   ├── AdminPage.jsx           ← Users, permissions, custom fields
│   └── PublicAssetView.jsx     ← QR scan public page (no login)
└── index.css                   ← Design system CSS variables
```

---

## 🛠️ Local Development

```bash
cp .env.example .env
# Fill in your Supabase URL and anon key

npm install
npm run dev
# Opens at http://localhost:5173
```

---

*AssetPro v2 · Strong Built Engineering & Contracting*
