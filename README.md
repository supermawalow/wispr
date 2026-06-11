# 💎 Whispr Pro - Продвинутый мессенджер

Полноценный мессенджер в стиле Telegram с системой контактов, поиском пользователей и админ-панелью.

## ✨ Возможности

### 👤 Система пользователей
- ✅ Регистрация с уникальным username
- ✅ Вход с паролем
- ✅ Отображаемое имя (display name)
- ✅ Статус онлайн/офлайн в реальном времени

### 📇 Контакты
- ✅ Поиск пользователей по username или имени
- ✅ Добавление в контакты
- ✅ Удаление из контактов
- ✅ Список контактов с индикацией онлайн-статуса

### 💬 Личные чаты
- ✅ Приватные сообщения 1-на-1
- ✅ История сообщений для каждого чата
- ✅ Индикатор "печатает..."
- ✅ Временные метки сообщений

### 👑 Админ-панель
- ✅ Статистика сервера (пользователи, сообщения, чаты)
- ✅ Список всех пользователей
- ✅ Удаление пользователей
- ✅ Назначение администраторов
- ✅ Просмотр онлайн-статуса

### 🎨 Дизайн Liquid Glass
- ✅ Современный интерфейс с эффектами прозрачности
- ✅ Плавные анимации
- ✅ Адаптивный дизайн
- ✅ Темная тема с градиентами

## 🚀 Быстрый старт

### Локальный запуск

#### 1. Запусти сервер

```bash
cd server
npm install
npm start
```

Сервер запустится на `http://localhost:3001`

**Админ аккаунт по умолчанию:**
- Username: `admin`
- Password: `admin123`

#### 2. Запусти клиент (новый терминал)

```bash
cd client
npm install
npm run dev
```

Клиент откроется на `http://localhost:3000`

### Первый запуск

1. **Открой** `http://localhost:3000` в браузере
2. **Зарегистрируй** нового пользователя или войди как админ
3. **Найди** других пользователей через поиск
4. **Добавь** их в контакты
5. **Начни** переписку!

## 📱 Как использовать

### Регистрация нового пользователя

1. На экране входа нажми "Нет аккаунта? Регистрация"
2. Введи:
   - **Username** (уникальный, латиница)
   - **Имя для отображения** (как тебя будут видеть другие)
   - **Пароль**
3. Нажми "Зарегистрироваться"

### Поиск и добавление контактов

1. Нажми кнопку "Найти пользователей" в боковой панели
2. Введи username или имя
3. Нажми "Добавить" рядом с нужным пользователем
4. Пользователь появится в твоих контактах

### Отправка сообщений

1. Кликни на контакт в списке
2. Открывается чат
3. Пиши сообщение в нижнем поле
4. Нажми Enter или кнопку отправки

### Админ-панель

1. Войди как администратор (admin / admin123)
2. Нажми иконку щита в правом верхнем углу
3. Доступны:
   - **Статистика** - общая информация о сервере
   - **Список пользователей** - все зарегистрированные
   - **Удаление** - кнопка мусорки рядом с пользователем
   - **Назначение админа** - кнопка короны

## 🏗️ Архитектура

### Backend (Node.js + Socket.io)

**Основные события:**
- `register` - регистрация нового пользователя
- `login` - вход существующего пользователя
- `search_users` - поиск по username/имени
- `add_contact` - добавление в контакты
- `remove_contact` - удаление из контактов
- `send_message` - отправка сообщения
- `load_chat` - загрузка истории чата
- `typing` - индикатор печати
- `admin_*` - админские команды

**Хранилище данных (в памяти):**
- `users` - Map всех пользователей
- `messages` - Map чатов и сообщений
- `onlineUsers` - Map онлайн пользователей
- `userSockets` - Map username → socketId

### Frontend (React)

**Компоненты:**
- Экран авторизации (вход/регистрация)
- Боковая панель с контактами
- Область чата с сообщениями
- Модальное окно поиска
- Админ-панель

## 🔐 Безопасность

⚠️ **ВАЖНО для продакшена:**

1. **Пароли** - сейчас хранятся открытым текстом!
   - Используй `bcrypt` для хеширования:
   ```bash
   npm install bcrypt
   ```
   ```javascript
   const bcrypt = require('bcrypt');
   const hashedPassword = await bcrypt.hash(password, 10);
   const match = await bcrypt.compare(password, user.password);
   ```

2. **JWT токены** - добавь авторизацию по токенам
3. **Rate limiting** - ограничь частоту запросов
4. **Валидация данных** - проверяй все входные данные
5. **HTTPS** - используй только защищённое соединение
6. **База данных** - замени in-memory на MongoDB/PostgreSQL

## 💾 Подключение базы данных

### MongoDB (рекомендуется)

```bash
npm install mongoose
```

```javascript
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  displayName: String,
  password: String, // хешированный!
  isAdmin: Boolean,
  contacts: [String],
  createdAt: Date
});

const MessageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  timestamp: Date,
  read: Boolean
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);
```

### Supabase (PostgreSQL)

```bash
npm install @supabase/supabase-js
```

Создай таблицы:
```sql
CREATE TABLE users (
  username VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100),
  password VARCHAR(255),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contacts (
  user_username VARCHAR(50) REFERENCES users(username),
  contact_username VARCHAR(50) REFERENCES users(username),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_username, contact_username)
);

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  from_username VARCHAR(50) REFERENCES users(username),
  to_username VARCHAR(50) REFERENCES users(username),
  text TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT false
);
```

## 🌐 Деплой в интернет

### Backend → Railway

1. Иди на [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Выбери репозиторий
4. Root Directory: `server`
5. Скопируй URL

### Frontend → Vercel

1. Иди на [vercel.com](https://vercel.com)
2. Import Project
3. Root Directory: `client`
4. Environment Variables:
   ```
   VITE_SERVER_URL=https://твой-railway-url.up.railway.app
   ```
5. Deploy!

**Не забудь обновить `SERVER_URL` в `WhisprPro.jsx`:**
```javascript
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
```

## 📊 Структура проекта

```
whispr-pro/
├── server/
│   ├── server.js          # Backend с Socket.io
│   └── package.json
├── client/
│   ├── src/
│   │   ├── main.jsx
│   │   └── index.css
│   ├── WhisprPro.jsx      # Главный компонент
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🎯 Функции по сравнению с базовой версией

| Функция | Базовый Whispr | Whispr Pro |
|---------|----------------|------------|
| Общий чат | ✅ | ❌ |
| Личные чаты | ❌ | ✅ |
| Система контактов | ❌ | ✅ |
| Поиск пользователей | ❌ | ✅ |
| Регистрация | ❌ | ✅ |
| Админ-панель | ❌ | ✅ |
| История сообщений | Временная | Постоянная |
| Username система | ❌ | ✅ |

## 🔧 Дополнительные функции для расширения

Идеи что можно добавить:

- [ ] Групповые чаты
- [ ] Отправка файлов/изображений
- [ ] Эмодзи пикер
- [ ] Редактирование/удаление сообщений
- [ ] Прочитано/не прочитано
- [ ] Уведомления на десктопе
- [ ] Голосовые сообщения
- [ ] Видеозвонки (WebRTC)
- [ ] E2E шифрование
- [ ] Блокировка пользователей
- [ ] Тёмная/светлая тема
- [ ] Настройки профиля
- [ ] Аватары пользователей
- [ ] Стикеры

## 🐛 Troubleshooting

**Проблема:** Username уже занят  
**Решение:** Выбери другой username или войди с существующим

**Проблема:** Не могу найти пользователя  
**Решение:** Убедись что username написан правильно, регистр не важен

**Проблема:** Сообщения не приходят  
**Решение:** Проверь что оба пользователя онлайн и добавлены в контакты

**Проблема:** Нет доступа к админ-панели  
**Решение:** Войди как `admin` / `admin123`

## 📜 Лицензия

MIT - используй свободно!

## 🙏 Поддержка

Если понравилось - поставь ⭐ на GitHub!

---

**Сделано с ❤️ на React + Socket.io**
