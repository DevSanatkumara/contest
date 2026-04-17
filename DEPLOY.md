# Запуск, настройка и деплой

## Локальный стек

Проект состоит из двух частей:
- **Backend** (`server/server.js`) + **БД** — запускаются в Docker через `docker-compose.yml`.
- **Frontend** (`contest.jsx` + `ui/`) — Vite dev-сервер на 5173, либо собранный бандл из `ui/dist`, который бэкенд отдаёт статикой.

Порты:
- `3001` — API и (при наличии `ui/dist`) статика UI.
- `5173` — Vite dev-сервер (hot reload при локальной разработке).
- `5433` — Postgres в контейнере (наружу, чтобы не конфликтовать с системной БД).

## Настройка

1. Скопировать `env.example` → `.env`, при желании поменять `ADMIN_PASSWORD` и `DB_PASSWORD`.
2. Запустить стек: `docker compose up -d`.
3. (Опционально, для разработки) запустить Vite: `cd ui && npm install && npm run dev`.

## ВАЖНО: правило пересборки контейнера

Бэкенд крутится в Docker-образе, куда `server.js` и `schema.sql` **вкомпилированы через `COPY . .`** в Dockerfile. Обычный `docker compose restart` НЕ подтянет изменения в коде — контейнер перезапустится со старым образом.

**После любой правки `server/server.js` или `schema.sql` нужно пересобрать образ:**

```bash
docker compose up -d --build server
```

Команда пересоберёт образ и пересоздаст контейнер. Схема БД обновится через `initDb` при старте (там `CREATE TABLE IF NOT EXISTS` и `ALTER TABLE ADD COLUMN IF NOT EXISTS` — идемпотентно).

Признак того, что контейнер крутит старый код: новые поля или эндпоинты не появляются в ответах API, хотя файл на диске правильный. Решение — пересобрать.

Фронтенд (`contest.jsx`, `ui/`) тоже копируется в образ (multi-stage build в Dockerfile собирает UI и кладёт в `ui/dist`). Если меняешь фронт и хочешь, чтобы он раздавался с бэкенда, — тоже нужен `--build`. Для локальной разработки проще держать Vite dev-сервер на 5173 с hot reload.

## Полная пересборка с нуля

Если что-то застряло (кривой образ, битый volume, мусорный контейнер):

```bash
docker compose down          # остановить контейнеры (volume с БД остаётся)
docker compose down -v       # + удалить volume БД (данные пропадут!)
docker compose up -d --build # собрать всё заново
```

## Логи

```bash
docker compose logs -f server   # лог бэкенда
docker compose logs -f db       # лог Postgres
```

## Деплой (Render)

Конфиг в `render.yaml`. Отличается от локального:
- БД — managed Postgres от Render (не Docker).
- Backend — запускается напрямую через `node server/server.js` (без Docker).
- UI — статический сайт, собирается из `ui/` и хостится отдельно.
- `VITE_API_URL` указывает фронту, куда ходить за API.

При правках `server.js`/`schema.sql` пересборки не требуется — Render сам пересобирает при пуше в main. Миграции схемы по-прежнему через `initDb` на старте.
