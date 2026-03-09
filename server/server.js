const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  transports: ['websocket', 'polling']
});

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whispr';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB подключена'))
  .catch(err => console.error('❌ Ошибка MongoDB:', err));

// ══════════════════════════════════════════
//  СХЕМЫ
// ══════════════════════════════════════════
const userSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, lowercase: true },
  displayName: { type: String, required: true },
  password:    { type: String, required: true },
  isAdmin:     { type: Boolean, default: false },
  isBlocked:   { type: Boolean, default: false },
  avatar:      { type: String, default: null },
  contacts:    [{ type: String }],
  createdAt:   { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  chatId:    { type: String, required: true, index: true },
  from:      { type: String, required: true },
  to:        { type: String, required: true },
  text:      { type: String, default: '' },
  type:      { type: String, default: 'text' }, // text | voice
  audioData: { type: String, default: null },   // base64 для голосовых
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  read:      { type: Boolean, default: false },
  reactions: { type: Map, of: [String], default: {} } // emoji -> [usernames]
});

const adminLogSchema = new mongoose.Schema({
  admin:     { type: String, required: true },
  action:    { type: String, required: true },
  target:    { type: String },
  details:   { type: String },
  timestamp: { type: Date, default: Date.now }
});

const User     = mongoose.model('User', userSchema);
const Message  = mongoose.model('Message', messageSchema);
const AdminLog = mongoose.model('AdminLog', adminLogSchema);

// ══════════════════════════════════════════
//  СОЗДАЁМ ADMIN
// ══════════════════════════════════════════
mongoose.connection.once('open', async () => {
  const admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    await User.create({ username: 'admin', displayName: 'Администратор', password: 'admin123', isAdmin: true });
    console.log('👑 Admin создан: admin / admin123');
  }
});

const onlineUsers = new Map(); // socketId -> username
const userSockets = new Map(); // username -> socketId

function getChatId(u1, u2) { return [u1, u2].sort().join('_'); }

async function logAdminAction(admin, action, target, details) {
  await AdminLog.create({ admin, action, target, details });
}

// ══════════════════════════════════════════
//  SOCKET.IO
// ══════════════════════════════════════════
io.on('connection', (socket) => {
  console.log('🟢 Подключение:', socket.id);

  // ── РЕГИСТРАЦИЯ ──
  socket.on('register', async (data, cb) => {
    try {
      const { username, displayName, password } = data;
      if (!username || !displayName || !password) return cb({ success: false, error: 'Все поля обязательны' });
      if (await User.findOne({ username: username.toLowerCase() })) return cb({ success: false, error: 'Username уже занят' });
      const user = await User.create({ username: username.toLowerCase(), displayName, password });
      console.log(`👤 Зарегистрирован: ${username}`);
      cb({ success: true, user: { ...user.toObject(), password: undefined } });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ВХОД ──
  socket.on('login', async (data, cb) => {
    try {
      const { username, password } = data;
      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user) return cb({ success: false, error: 'Пользователь не найден' });
      if (user.password !== password) return cb({ success: false, error: 'Неверный пароль' });
      if (user.isBlocked) return cb({ success: false, error: 'Аккаунт заблокирован' });

      const oldSocket = userSockets.get(user.username);
      if (oldSocket) io.to(oldSocket).emit('force_disconnect', { reason: 'Новый вход с другого устройства' });

      onlineUsers.set(socket.id, user.username);
      userSockets.set(user.username, socket.id);

      const contactDocs = await User.find({ username: { $in: user.contacts } });
      const contacts = contactDocs.map(c => ({
        username: c.username,
        displayName: c.displayName,
        isOnline: userSockets.has(c.username),
        isBlocked: c.isBlocked
      }));

      // Помечаем все непрочитанные сообщения как доставленные
      await Message.updateMany(
        { to: user.username, delivered: false },
        { delivered: true }
      );

      io.emit('user_status_change', { username: user.username, isOnline: true });
      console.log(`✅ Вход: ${username}`);
      cb({ success: true, user: { ...user.toObject(), password: undefined }, contacts });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ПОИСК ──
  socket.on('search_users', async (query, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const results = await User.find({
        username: { $ne: me },
        $or: [{ username: { $regex: query, $options: 'i' } }, { displayName: { $regex: query, $options: 'i' } }]
      }).limit(20);
      cb({ success: true, results: results.map(u => ({
        username: u.username, displayName: u.displayName,
        isOnline: userSockets.has(u.username), isBlocked: u.isBlocked
      }))});
    } catch (e) { cb({ success: false, error: 'Ошибка поиска' }); }
  });

  // ── ДОБАВИТЬ КОНТАКТ ──
  socket.on('add_contact', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      const targetUser = await User.findOne({ username: target.toLowerCase() });
      if (!targetUser) return cb({ success: false, error: 'Пользователь не найден' });
      if (user.contacts.includes(target.toLowerCase())) return cb({ success: false, error: 'Уже в контактах' });
      user.contacts.push(target.toLowerCase());
      await user.save();
      cb({ success: true, contact: {
        username: targetUser.username, displayName: targetUser.displayName,
        isOnline: userSockets.has(targetUser.username), isBlocked: targetUser.isBlocked
      }});
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── УДАЛИТЬ КОНТАКТ ──
  socket.on('remove_contact', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      await User.updateOne({ username: me }, { $pull: { contacts: target.toLowerCase() } });
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ИСТОРИЯ ЧАТА ──
  socket.on('load_chat', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const msgs = await Message.find({ chatId: getChatId(me, target.toLowerCase()) })
        .sort({ timestamp: 1 }).limit(200);
      
      // Помечаем как прочитанные
      await Message.updateMany(
        { chatId: getChatId(me, target.toLowerCase()), to: me, read: false },
        { read: true }
      );

      // Уведомляем отправителя что сообщения прочитаны
      const senderSocket = userSockets.get(target.toLowerCase());
      if (senderSocket) {
        io.to(senderSocket).emit('messages_read', { by: me, chatWith: me });
      }

      cb({ success: true, messages: msgs });
    } catch (e) { cb({ success: false, error: 'Ошибка загрузки' }); }
  });

  // ── ОТПРАВИТЬ СООБЩЕНИЕ ──
  socket.on('send_message', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { to, text, type, audioData } = data;
      const recipientSocket = userSockets.get(to.toLowerCase());
      const delivered = !!recipientSocket;

      const msg = await Message.create({
        chatId: getChatId(me, to.toLowerCase()),
        from: me, to: to.toLowerCase(),
        text: text || '',
        type: type || 'text',
        audioData: audioData || null,
        delivered,
        read: false
      });

      socket.emit('new_message', msg);
      if (recipientSocket) io.to(recipientSocket).emit('new_message', msg);

      cb({ success: true, message: msg });
    } catch (e) { cb({ success: false, error: 'Ошибка отправки' }); }
  });

  // ── РЕАКЦИЯ НА СООБЩЕНИЕ ──
  socket.on('add_reaction', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { messageId, emoji } = data;
      const msg = await Message.findById(messageId);
      if (!msg) return cb({ success: false, error: 'Сообщение не найдено' });

      const reactions = msg.reactions || new Map();
      const users = reactions.get(emoji) || [];

      if (users.includes(me)) {
        // Убираем реакцию
        reactions.set(emoji, users.filter(u => u !== me));
        if (reactions.get(emoji).length === 0) reactions.delete(emoji);
      } else {
        reactions.set(emoji, [...users, me]);
      }

      msg.reactions = reactions;
      await msg.save();

      // Уведомляем обоих участников чата
      const otherUser = msg.from === me ? msg.to : msg.from;
      const otherSocket = userSockets.get(otherUser);
      
      const reactionUpdate = { messageId, reactions: Object.fromEntries(msg.reactions) };
      socket.emit('reaction_updated', reactionUpdate);
      if (otherSocket) io.to(otherSocket).emit('reaction_updated', reactionUpdate);

      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка реакции' }); }
  });

  // ── ПЕЧАТАЕТ ──
  socket.on('typing', (target) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    const s = userSockets.get(target.toLowerCase());
    if (s) io.to(s).emit('user_typing', { from: me });
  });

  // ══════════════════════════════════════════
  //  АДМИН
  // ══════════════════════════════════════════

  socket.on('admin_get_stats', async (cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const [totalUsers, totalMessages, chats, blockedUsers] = await Promise.all([
        User.countDocuments(),
        Message.countDocuments(),
        Message.distinct('chatId'),
        User.countDocuments({ isBlocked: true })
      ]);
      cb({ success: true, stats: {
        totalUsers, onlineUsers: onlineUsers.size,
        totalMessages, totalChats: chats.length, blockedUsers
      }});
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_get_users', async (data, cb) => {
    // Поддержка как старого формата (без data) так и нового (с поиском)
    if (typeof data === 'function') { cb = data; data = {}; }
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });

      const query = data.search
        ? { $or: [{ username: { $regex: data.search, $options: 'i' } }, { displayName: { $regex: data.search, $options: 'i' } }] }
        : {};

      const users = await User.find(query).limit(100);
      cb({ success: true, users: users.map(u => ({
        username: u.username, displayName: u.displayName,
        isAdmin: u.isAdmin, isBlocked: u.isBlocked,
        contactsCount: u.contacts.length,
        createdAt: u.createdAt,
        isOnline: userSockets.has(u.username)
      }))});
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_get_logs', async (cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const logs = await AdminLog.find().sort({ timestamp: -1 }).limit(50);
      cb({ success: true, logs });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_delete_user', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      if (target === 'admin') return cb({ success: false, error: 'Нельзя удалить админа' });
      await User.deleteOne({ username: target.toLowerCase() });
      const s = userSockets.get(target.toLowerCase());
      if (s) io.to(s).emit('force_disconnect', { reason: 'Аккаунт удалён администратором' });
      await logAdminAction(me, 'DELETE_USER', target, `Пользователь ${target} удалён`);
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_block_user', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const { target, block } = data;
      if (target === 'admin') return cb({ success: false, error: 'Нельзя заблокировать админа' });
      await User.updateOne({ username: target.toLowerCase() }, { isBlocked: block });
      if (block) {
        const s = userSockets.get(target.toLowerCase());
        if (s) io.to(s).emit('force_disconnect', { reason: 'Ваш аккаунт заблокирован администратором' });
      }
      await logAdminAction(me, block ? 'BLOCK_USER' : 'UNBLOCK_USER', target, `Пользователь ${target} ${block ? 'заблокирован' : 'разблокирован'}`);
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_promote_user', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const t = await User.findOneAndUpdate({ username: target.toLowerCase() }, { isAdmin: true });
      if (!t) return cb({ success: false, error: 'Пользователь не найден' });
      await logAdminAction(me, 'PROMOTE_USER', target, `${target} стал администратором`);
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });


  // ── ОБНОВИТЬ АВАТАР ──
  socket.on('update_avatar', async (avatarData, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      await User.updateOne({ username: me }, { avatar: avatarData });
      io.emit('avatar_updated', { username: me, avatar: avatarData });
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ОТКЛЮЧЕНИЕ ──
  socket.on('disconnect', () => {
    const username = onlineUsers.get(socket.id);
    if (username) {
      onlineUsers.delete(socket.id);
      userSockets.delete(username);
      io.emit('user_status_change', { username, isOnline: false });
      console.log(`🔴 ${username} отключился`);
    }
  });
});

// ══════════════════════════════════════════
//  REST API
// ══════════════════════════════════════════
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    users: await User.countDocuments().catch(() => 0),
    online: onlineUsers.size,
    messages: await Message.countDocuments().catch(() => 0),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Whispr Server v2 on port ${PORT}`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
