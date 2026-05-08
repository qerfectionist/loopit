# Loopit MVP — Статус

_Последнее обновление: 2026-05-08_
_Supabase project: gleoaovlbiltiwcoxpes_
_Деплой: https://loopit-peach.vercel.app_
_E2E тест: **PASSED** (2026-05-08) — полный сценарий с двумя реальными Telegram пользователями_

---

## ✅ Что работает

| Компонент | Статус | Подтверждение |
|-----------|--------|---------------|
| Telegram Mini App — открывается в Telegram | ✅ | Ручной тест |
| Telegram auth через `auth-telegram` Edge Function | ✅ | HMAC-SHA256 верификация Telegram initData |
| Custom JWT (HS256, sub = public.users.id) | ✅ | auth.uid() работает в RLS |
| Supabase RLS — все таблицы защищены | ✅ | INSERT без JWT → 401 протестировано |
| Item CRUD (create / read / update / delete) | ✅ | Ручной тест в приложении |
| Supabase Storage upload | ✅ | item-images bucket, RLS по user UUID |
| item-images bucket | ✅ | Public bucket, 5MB limit, jpeg/png/webp |
| Photos saved in items.images[] | ✅ | URL в массиве после upload |
| Vercel deploy (auto из master) | ✅ | loopit-peach.vercel.app |
| ALLOW_DEV_AUTH=false (production secured) | ✅ | dev bypass → 401 подтверждено |
| **Full E2E flow** | ✅ | PASSED с двумя реальными Telegram пользователями |
| **Match → Conversation (атомарно)** | ✅ | upsert conv перед update status, idempotent |
| **Realtime chat с двумя пользователями** | ✅ | Сообщения без refresh, Realtime WebSocket |
| **Exchange completion via PostgreSQL RPC** | ✅ | confirm_exchange: SELECT FOR UPDATE, атомарно |
| **FTS поиск (title > author > description)** | ✅ | search_items() RPC, ts_rank_cd, GIN index |
| **Image compression** | ✅ | browser-image-compression, max 800KB перед upload |
| **Telegram Bot уведомления** | ✅ | notify-telegram Edge Function: new_match, match_accepted |
| **ISBN сканер** | ✅ | BarcodeDetector API + OpenLibrary автозаполнение |
| **Геолокация** | ✅ | Дистанция на карточках, сорт Nearest, users.location JSONB |

---

## 🔒 Что НЕ трогать без чёткой причины

| Файл / Компонент | Причина |
|-----------------|---------|
| `src/lib/supabase.ts` | Кастомный JWT inject — критичен для auth |
| `supabase/functions/auth-telegram/index.ts` | Auth логика, HMAC verification |
| `supabase/migrations/003_fix_rls.sql` | RLS политики — трогать только осознанно |
| `supabase/migrations/004_items_owner_select.sql` | RLS owner select |
| `supabase/migrations/005_storage_item_images.sql` | Storage bucket + policies |
| `supabase/migrations/007_confirm_exchange_rpc.sql` | Transaction logic — SELECT FOR UPDATE |
| `uploadItemImage` в `src/services/items.ts` | Работает, не трогать |
| `src/services/matches.ts` | Match atomicity исправлена, не трогать |
| `src/services/exchanges.ts` | RPC confirm flow, не трогать |
| Storage bucket настройки | Mime types, size limit настроены через Dashboard |
| `.env` / `.env.local` | Credentials нового проекта |

---

## 📋 Следующие фичи (по приоритету)

| Фича | Приоритет | Статус |
|------|-----------|--------|
| Wishlist-based matching | 🟠 Средний | Не начато |
| Profile trust / rating UI | 🟡 Низкий | Схема есть, UI нет |
| Exchange flow polish | 🟡 Низкий | Базовый flow работает |
| Code splitting / bundle optimization | 🟢 Низкий | Bundle 784KB — нужен lazy load |

---

## ⚠️ Известные ограничения

| Ограничение | Описание |
|-------------|--------------------------------------------|
| `ALLOW_DEV_AUTH=false` | ✅ Закрыто — dev bypass отключён в production |
| JWT срок — 7 дней | Нет auto-refresh |
| Bundle > 500KB | 784KB — нужен code splitting / lazy import |
| CORS `'*'` | Edge Function принимает запросы с любого Origin |
| BarcodeDetector | Не работает в Firefox, iOS < Safari 17 |
| Геолокация | Только если пользователь разрешил доступ к камере |

---

## 🏗️ Архитектура

```
Telegram initData
    → auth-telegram Edge Function (Supabase)
        → HMAC verify + upsert user
        → sign custom JWT (CUSTOM_JWT_SECRET = project JWT secret)
    → Frontend (Vercel)
        → store JWT in localStorage
        → inject Bearer token во все Supabase requests
    → Supabase PostgREST
        → verify JWT → auth.uid()
        → enforce RLS
    → Supabase Storage
        → RLS: upload только в свою папку (userId/*)
        → Public read (CDN)
```
