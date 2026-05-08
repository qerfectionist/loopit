# Loopit MVP — Статус

_Последнее обновление: 2026-05-08_
_Supabase project: gleoaovlbiltiwcoxpes (новый, после миграции)_
_Деплой: https://loopit-peach.vercel.app_

---

## ✅ Что работает

| Компонент | Статус | Подтверждение |
|-----------|--------|---------------|
| Telegram Mini App — открывается в Telegram | ✅ | Ручной тест |
| Авторизация через `auth-telegram` Edge Function | ✅ | HMAC-SHA256 верификация Telegram initData |
| Custom JWT (HS256, sub = public.users.id) | ✅ | auth.uid() работает в RLS |
| Supabase RLS — все таблицы защищены | ✅ | INSERT без JWT → 401 протестировано |
| Item insert под JWT | ✅ | Ручной тест в приложении |
| Item insert без JWT — заблокирован | ✅ | PowerShell тест → 401 |
| Владелец видит свои неактивные книги | ✅ | RLS политика `Owner read own items` |
| JWT expiry check на клиенте | ✅ | `src/services/auth.ts` декодирует exp |
| Frontend deploy на Vercel (auto из master) | ✅ | loopit-peach.vercel.app |
| Edge Function задеплоена в Supabase | ✅ | auth-telegram активна |
| Загрузка фото книг (Supabase Storage upload) | ✅ | item-images bucket, RLS по user UUID |
| npm run build | ✅ | 0 ошибок |
| npm run lint | ✅ | 0 ошибок |

---

## ❌ Что НЕ реализовано

| Фича | Приоритет |
|------|-----------|
| ~~Загрузка фото книг~~ | ~~Высокий~~ → ✅ Готово |
| Realtime чат (WebSocket / Supabase Realtime) | Высокий |
| Реальный поиск книг (полнотекстовый или по фильтрам) | Высокий |
| Матчинг на основе wishlists | Средний |
| Push-уведомления (Telegram Bot API) | Средний |
| Нагрузочное тестирование | Низкий |
| Локализация (мультиязычность) | Низкий |

---

## ⚠️ Известные ограничения

| Ограничение | Описание |
|-------------|---------|
| `ALLOW_DEV_AUTH` | В production должен быть `false`. Если `true` — любой может авторизоваться как dev_local |
| JWT срок — 7 дней | Нет auto-refresh. После истечения пользователь авторизуется повторно при следующем открытии |
| Bundle size > 500KB | Vite предупреждает. Влияет на TTI в медленных сетях |
| CORS `'*'` | Edge Function принимает запросы с любого Origin |

---

## 🏗️ Архитектура (кратко)

```
Telegram initData
    → auth-telegram Edge Function (Supabase)
        → HMAC verify + upsert user
        → sign custom JWT
    → Frontend (Vercel)
        → store JWT in localStorage
        → inject Bearer token in all Supabase requests
    → Supabase PostgREST
        → verify JWT → auth.uid()
        → enforce RLS
```

---

## 📋 Честный статус

> **Loopit MVP готов к закрытому тестированию.**
>
> Авторизация, безопасность БД и базовые функции работают в реальном Telegram.
>
> **Не готов к публичному масштабному запуску** — отсутствуют: загрузка фото, чат, реальный поиск, нагрузочное тестирование.

---

## 🔒 Файлы, которые НЕ трогаем без объяснения причины

- `supabase/functions/auth-telegram/index.ts` — auth логика
- `src/lib/supabase.ts` — JWT inject
- `supabase/migrations/003_fix_rls.sql` — RLS политики
- `supabase/migrations/004_items_owner_select.sql` — RLS owner select
