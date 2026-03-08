const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());

// База данных в памяти (для продакшена используй MongoDB или PostgreSQL)
const users = new Map(); // username -> { id, username, displayName, password, isAdmin, contacts: [], blockedUsers: [] }
const onlineUsers = new Map(); // socketId -> username
const messages = new Map(); // chatId -> [messages]
const userSockets = new Map(); // username -> socketId

// Создаём admin аккаунт по умолчанию
users.set('admin', {
  id: 'admin-001',
  username: 'admin',
  displayName: 'Администратор',
  password: 'mawadmin', // В продакшене ОБЯЗАТЕЛЬНО хешировать!
  isAdmin: true,
  contacts: [],
  blockedUsers: [],
  createdAt: new Date().toISOString()
});

// Функции для работы с чатами
function getChatId(user1, user2) {
  return [user1, user2].sort().join('_');
}

function getChatMessages(chatId) {
  if (!messages.has(chatId)) {
    messages.set(chatId, []);
  }
  return messages.get(chatId);
}

io.on('connection', (socket) => {
  console.log('🟢 Новое подключение:', socket.id);

  // Регистрация нового пользователя
  socket.on('register', (data, callback) => {
    const { username, displayName, password } = data;
    
    if (!username || !displayName || !password) {
      return callback({ success: false, error: 'Все поля обязательны' });
    }

    if (users.has(username.toLowerCase())) {
      return callback({ success: false, error: 'Username уже занят' });
    }

    const newUser = {
      id: `user-${Date.now()}`,
      username: username.toLowerCase(),
      displayName: displayName,
      password: password, // В продакшене хешировать!
      isAdmin: false,
      contacts: [],
      blockedUsers: [],
      createdAt: new Date().toISOString()
    };

    users.set(username.toLowerCase(), newUser);
    
    console.log(`👤 Новый пользователь зарегистрирован: ${username}`);
    callback({ success: true, user: { ...newUser, password: undefined } });
  });

  // Вход существующего пользователя
  socket.on('login', (data, callback) => {
    const { username, password } = data;
    
    const user = users.get(username.toLowerCase());
    
    if (!user) {
      return callback({ success: false, error: 'Пользователь не найден' });
    }

    if (user.password !== password) {
      return callback({ success: false, error: 'Неверный пароль' });
    }

    // Отключаем предыдущую сессию если есть
    const oldSocket = userSockets.get(username.toLowerCase());
    if (oldSocket) {
      io.to(oldSocket).emit('force_disconnect', { reason: 'Новый вход с другого устройства' });
    }

    onlineUsers.set(socket.id, username.toLowerCase());
    userSockets.set(username.toLowerCase(), socket.id);

    // Отправляем данные пользователя
    const userData = { ...user, password: undefined };
    
    // Отправляем список контактов с их статусами
    const contactsWithStatus = user.contacts.map(contactUsername => {
      const contact = users.get(contactUsername);
      return {
        username: contactUsername,
        displayName: contact?.displayName || contactUsername,
        isOnline: Array.from(onlineUsers.values()).includes(contactUsername)
      };
    });

    // Уведомляем всех о новом онлайн пользователе
    io.emit('user_status_change', { 
      username: username.toLowerCase(), 
      isOnline: true 
    });

    console.log(`✅ Вход: ${username}`);
    callback({ 
      success: true, 
      user: userData,
      contacts: contactsWithStatus 
    });
  });

  // Поиск пользователей
  socket.on('search_users', (query, callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const results = Array.from(users.values())
      .filter(u => 
        u.username !== currentUser && 
        (u.username.includes(query.toLowerCase()) || 
         u.displayName.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, 20)
      .map(u => ({
        username: u.username,
        displayName: u.displayName,
        isOnline: Array.from(onlineUsers.values()).includes(u.username)
      }));

    callback({ success: true, results });
  });

  // Добавить в контакты
  socket.on('add_contact', (targetUsername, callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const user = users.get(currentUser);
    const targetUser = users.get(targetUsername.toLowerCase());

    if (!targetUser) {
      return callback({ success: false, error: 'Пользователь не найден' });
    }

    if (user.contacts.includes(targetUsername.toLowerCase())) {
      return callback({ success: false, error: 'Уже в контактах' });
    }

    user.contacts.push(targetUsername.toLowerCase());

    callback({ 
      success: true, 
      contact: {
        username: targetUser.username,
        displayName: targetUser.displayName,
        isOnline: Array.from(onlineUsers.values()).includes(targetUser.username)
      }
    });

    console.log(`📇 ${currentUser} добавил ${targetUsername} в контакты`);
  });

  // Удалить из контактов
  socket.on('remove_contact', (targetUsername, callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const user = users.get(currentUser);
    user.contacts = user.contacts.filter(c => c !== targetUsername.toLowerCase());

    callback({ success: true });
    console.log(`📇 ${currentUser} удалил ${targetUsername} из контактов`);
  });

  // Загрузить историю чата
  socket.on('load_chat', (targetUsername, callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const chatId = getChatId(currentUser, targetUsername.toLowerCase());
    const chatMessages = getChatMessages(chatId);

    callback({ success: true, messages: chatMessages });
  });

  // Отправить личное сообщение
  socket.on('send_message', (data, callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const { to, text } = data;
    const chatId = getChatId(currentUser, to.toLowerCase());
    
    const message = {
      id: Date.now(),
      from: currentUser,
      to: to.toLowerCase(),
      text: text,
      timestamp: new Date().toISOString(),
      read: false
    };

    getChatMessages(chatId).push(message);

    // Отправляем отправителю
    socket.emit('new_message', message);

    // Отправляем получателю если онлайн
    const recipientSocket = userSockets.get(to.toLowerCase());
    if (recipientSocket) {
      io.to(recipientSocket).emit('new_message', message);
    }

    callback({ success: true, message });
    console.log(`💬 ${currentUser} -> ${to}: ${text.substring(0, 30)}...`);
  });

  // Печатает...
  socket.on('typing', (targetUsername) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return;

    const recipientSocket = userSockets.get(targetUsername.toLowerCase());
    if (recipientSocket) {
      io.to(recipientSocket).emit('user_typing', { from: currentUser });
    }
  });

  // АДМИН: Получить статистику
  socket.on('admin_get_stats', (callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const user = users.get(currentUser);
    if (!user?.isAdmin) {
      return callback({ success: false, error: 'Нет прав администратора' });
    }

    const stats = {
      totalUsers: users.size,
      onlineUsers: onlineUsers.size,
      totalMessages: Array.from(messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
      totalChats: messages.size
    };

    callback({ success: true, stats });
  });

  // АДМИН: Получить список всех пользователей
  socket.on('admin_get_users', (callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const user = users.get(currentUser);
    if (!user?.isAdmin) {
      return callback({ success: false, error: 'Нет прав администратора' });
    }

    const usersList = Array.from(users.values()).map(u => ({
      username: u.username,
      displayName: u.displayName,
      isAdmin: u.isAdmin,
      contactsCount: u.contacts.length,
      createdAt: u.createdAt,
      isOnline: Array.from(onlineUsers.values()).includes(u.username)
    }));

    callback({ success: true, users: usersList });
  });

  // АДМИН: Удалить пользователя
  socket.on('admin_delete_user', (targetUsername, callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const user = users.get(currentUser);
    if (!user?.isAdmin) {
      return callback({ success: false, error: 'Нет прав администратора' });
    }

    if (targetUsername === 'admin') {
      return callback({ success: false, error: 'Нельзя удалить админа' });
    }

    users.delete(targetUsername.toLowerCase());

    // Отключаем пользователя если онлайн
    const targetSocket = userSockets.get(targetUsername.toLowerCase());
    if (targetSocket) {
      io.to(targetSocket).emit('force_disconnect', { reason: 'Аккаунт удалён администратором' });
    }

    callback({ success: true });
    console.log(`⚠️ ADMIN удалил пользователя: ${targetUsername}`);
  });

  // АДМИН: Сделать пользователя админом
  socket.on('admin_promote_user', (targetUsername, callback) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return callback({ success: false, error: 'Не авторизован' });

    const user = users.get(currentUser);
    if (!user?.isAdmin) {
      return callback({ success: false, error: 'Нет прав администратора' });
    }

    const targetUser = users.get(targetUsername.toLowerCase());
    if (!targetUser) {
      return callback({ success: false, error: 'Пользователь не найден' });
    }

    targetUser.isAdmin = true;
    callback({ success: true });
    console.log(`👑 ${targetUsername} теперь администратор`);
  });

  // Отключение
  socket.on('disconnect', () => {
    const username = onlineUsers.get(socket.id);
    
    if (username) {
      onlineUsers.delete(socket.id);
      userSockets.delete(username);

      // Уведомляем всех об офлайне
      io.emit('user_status_change', { 
        username: username, 
        isOnline: false 
      });

      console.log(`🔴 ${username} отключился`);
    }
  });
});

// REST API
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    users: users.size,
    online: onlineUsers.size,
    chats: messages.size,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   🚀 Whispr Pro Server Running!      ║
  ║   📡 Port: ${PORT}                      ║
  ║   🌐 http://localhost:${PORT}          ║
  ║                                       ║
  ║   👑 Admin Login:                    ║
  ║   Username: admin                    ║
  ║   Password: admin123                 ║
  ╚═══════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, closing server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
