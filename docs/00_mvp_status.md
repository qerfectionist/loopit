# Loopit MVP — Статус

_Последнее обновление: 2026-05-08_
_Supabase project: gleoaovlbiltiwcoxpes_
_Деплой: https://loopit-peach.vercel.app_

---

## ✅ Что работает

| Компонент | Статус |
|-----------|--------|
| Telegram Mini App | ✅ |
| Telegram auth (HMAC-SHA256) | ✅ |
| Custom JWT → RLS via auth.uid() | ✅ |
| Supabase RLS — все таблицы | ✅ |
| Item CRUD | ✅ |
| Supabase Storage (item-images) | ✅ |
| Image compression (max 800KB) | ✅ |
| Vercel deploy | ✅ |
| Full E2E flow (2 реальных пользователя) | ✅ |
| Match → Conversation (атомарно) | ✅ |
| Realtime chat | ✅ |
| Exchange RPC (SELECT FOR UPDATE) | ✅ |
| FTS поиск (search_items RPC) | ✅ |
| Telegram Bot уведомления (pg_net trigger) | ✅ |
| ISBN сканер + persistence (items.isbn) | ✅ |
| Геолокация + дистанция (~1km precision) | ✅ |
| Sentry error tracking | ✅ |
| Typing presence (participant guard) | ✅ |
| Optimistic UI (chat) | ✅ |
| Genre фильтры (Explore + AddBookPage) | ✅ |
| Exchange meetup UI (место + время) | ✅ |
| Profile rating UI (ReviewPage + ProfilePage) | ✅ |

---

## 🔒 Что НЕ трогать

| Файл | Причина |
|------|---------|
| `src/lib/supabase.ts` | Custom JWT inject |
| `supabase/functions/auth-telegram/` | HMAC verification |
| `supabase/migrations/003_fix_rls.sql` | RLS политики |
| `supabase/migrations/007_confirm_exchange_rpc.sql` | Transaction logic |
| `src/services/matches.ts` | Match atomicity |
| `src/services/exchanges.ts` | RPC confirm flow |

---

## 📋 Что осталось

| Фича | Приоритет |
|------|-----------|
| Lazy loading (framer-motion, AddBookPage) | 🟠 Средний |
| Wishlist-based matching | 🟡 Низкий |
| User search | 🟡 Низкий |
| pgvector / семантический поиск | 🔵 Будущее |

---

## ⚠️ Ограничения

| | |
|-|-|
| Bundle | 869KB minified / ~260KB gzip |
| BarcodeDetector | Нет в Firefox, iOS < Safari 17 |
| CORS | `'*'` в Edge Functions |

---

## 🏗️ Архитектура

```
Telegram initData
  → auth-telegram Edge Function
      → HMAC verify + upsert user
      → sign custom JWT
  → Frontend (Vercel)
      → JWT в localStorage
      → Bearer inject в Supabase requests
  → Supabase PostgREST → RLS
  → Supabase Storage → RLS (userId/*)
  → DB trigger → pg_net → notify-telegram → Telegram Bot
```
