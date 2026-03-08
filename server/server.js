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

const userSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, lowercase: true },
  displayName: { type: String, required: true },
  password:    { type: String, required: true },
  isAdmin:     { type: Boolean, default: false },
  contacts:    [{ type: String }],
  createdAt:   { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  chatId:    { type: String, required: true, index: true },
  from:      { type: String, required: true },
  to:        { type: String, required: true },
  text:      { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read:      { type: Boolean, default: false }
});

const User    = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

mongoose.connection.once('open', async () => {
  const admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    await User.create({ username: 'admin', displayName: 'Администратор', password: 'admin123', isAdmin: true });
    console.log('👑 Admin создан: admin / admin123');
  }
});

const onlineUsers = new Map();
const userSockets = new Map();

function getChatId(u1, u2) { return [u1, u2].sort().join('_'); }

io.on('connection', (socket) => {
  console.log('🟢 Подключение:', socket.id);

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

  socket.on('login', async (data, cb) => {
    try {
      const { username, password } = data;
      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user) return cb({ success: false, error: 'Пользователь не найден' });
      if (user.password !== password) return cb({ success: false, error: 'Неверный пароль' });
      const oldSocket = userSockets.get(user.username);
      if (oldSocket) io.to(oldSocket).emit('force_disconnect', { reason: 'Новый вход с другого устройства' });
      onlineUsers.set(socket.id, user.username);
      userSockets.set(user.username, socket.id);
      const contactDocs = await User.find({ username: { $in: user.contacts } });
      const contacts = contactDocs.map(c => ({ username: c.username, displayName: c.displayName, isOnline: userSockets.has(c.username) }));
      io.emit('user_status_change', { username: user.username, isOnline: true });
      console.log(`✅ Вход: ${username}`);
      cb({ success: true, user: { ...user.toObject(), password: undefined }, contacts });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  socket.on('search_users', async (query, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const results = await User.find({ username: { $ne: me }, $or: [{ username: { $regex: query, $options: 'i' } }, { displayName: { $regex: query, $options: 'i' } }] }).limit(20);
      cb({ success: true, results: results.map(u => ({ username: u.username, displayName: u.displayName, isOnline: userSockets.has(u.username) })) });
    } catch (e) { cb({ success: false, error: 'Ошибка поиска' }); }
  });

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
      cb({ success: true, contact: { username: targetUser.username, displayName: targetUser.displayName, isOnline: userSockets.has(targetUser.username) } });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  socket.on('remove_contact', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      await User.updateOne({ username: me }, { $pull: { contacts: target.toLowerCase() } });
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  socket.on('load_chat', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const msgs = await Message.find({ chatId: getChatId(me, target.toLowerCase()) }).sort({ timestamp: 1 }).limit(200);
      cb({ success: true, messages: msgs });
    } catch (e) { cb({ success: false, error: 'Ошибка загрузки' }); }
  });

  socket.on('send_message', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { to, text } = data;
      const msg = await Message.create({ chatId: getChatId(me, to.toLowerCase()), from: me, to: to.toLowerCase(), text });
      socket.emit('new_message', msg);
      const recvSocket = userSockets.get(to.toLowerCase());
      if (recvSocket) io.to(recvSocket).emit('new_message', msg);
      cb({ success: true, message: msg });
    } catch (e) { cb({ success: false, error: 'Ошибка отправки' }); }
  });

  socket.on('typing', (target) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    const s = userSockets.get(target.toLowerCase());
    if (s) io.to(s).emit('user_typing', { from: me });
  });

  socket.on('admin_get_stats', async (cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const [totalUsers, totalMessages, chats] = await Promise.all([User.countDocuments(), Message.countDocuments(), Message.distinct('chatId')]);
      cb({ success: true, stats: { totalUsers, onlineUsers: onlineUsers.size, totalMessages, totalChats: chats.length } });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_get_users', async (cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const users = await User.find();
      cb({ success: true, users: users.map(u => ({ username: u.username, displayName: u.displayName, isAdmin: u.isAdmin, contactsCount: u.contacts.length, createdAt: u.createdAt, isOnline: userSockets.has(u.username) })) });
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
      if (s) io.to(s).emit('force_disconnect', { reason: 'Аккаунт удалён' });
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
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

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

app.get('/health', async (req, res) => {
  res.json({ status: 'ok', users: await User.countDocuments().catch(()=>0), online: onlineUsers.size, messages: await Message.countDocuments().catch(()=>0), uptime: process.uptime() });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Whispr Server on port ${PORT}`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
