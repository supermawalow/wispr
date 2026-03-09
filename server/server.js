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
app.use(express.json({ limit: '10mb' }));

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

const groupSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  avatar:      { type: String, default: null },
  owner:       { type: String, required: true },
  admins:      [{ type: String }],
  members:     [{ type: String }],
  createdAt:   { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  chatId:    { type: String, required: true, index: true },
  chatType:  { type: String, default: 'direct' }, // direct | group
  from:      { type: String, required: true },
  to:        { type: String, default: '' },       // username для direct
  groupId:   { type: String, default: null },     // group id для group
  text:      { type: String, default: '' },
  type:      { type: String, default: 'text' },   // text | voice
  audioData: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  read:      { type: Boolean, default: false },
  reactions:     { type: Map, of: [String], default: {} },
  edited:        { type: Boolean, default: false },
  forwarded:     { type: Boolean, default: false },
  forwardedFrom: { type: String, default: null }
});

const adminLogSchema = new mongoose.Schema({
  admin:     { type: String, required: true },
  action:    { type: String, required: true },
  target:    { type: String },
  details:   { type: String },
  timestamp: { type: Date, default: Date.now }
});

const User     = mongoose.model('User', userSchema);
const Group    = mongoose.model('Group', groupSchema);
const Message  = mongoose.model('Message', messageSchema);
const AdminLog = mongoose.model('AdminLog', adminLogSchema);

// ══════════════════════════════════════════
//  ИНИЦИАЛИЗАЦИЯ ADMIN
// ══════════════════════════════════════════
mongoose.connection.once('open', async () => {
  const admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    await User.create({ username: 'admin', displayName: 'Администратор', password: 'mawadmin201223', isAdmin: true });
    console.log('👑 Admin создан');
  } else {
    // Обновляем пароль если уже существует
    await User.updateOne({ username: 'admin' }, { password: 'mawadmin201223' });
    console.log('👑 Admin пароль обновлён');
  }
});

const onlineUsers = new Map(); // socketId -> username
const userSockets = new Map(); // username -> socketId

function getChatId(u1, u2) { return [u1, u2].sort().join('_'); }
function getGroupChatId(groupId) { return `group_${groupId}`; }

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
        username: c.username, displayName: c.displayName,
        avatar: c.avatar, isOnline: userSockets.has(c.username), isBlocked: c.isBlocked
      }));

      // Группы пользователя
      const groups = await Group.find({ members: user.username });

      await Message.updateMany({ to: user.username, delivered: false }, { delivered: true });
      io.emit('user_status_change', { username: user.username, isOnline: true });

      cb({ success: true, user: { ...user.toObject(), password: undefined }, contacts, groups });
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
        avatar: u.avatar, isOnline: userSockets.has(u.username), isBlocked: u.isBlocked
      }))});
    } catch (e) { cb({ success: false, error: 'Ошибка поиска' }); }
  });

  // ── КОНТАКТЫ ──
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
        avatar: targetUser.avatar, isOnline: userSockets.has(targetUser.username), isBlocked: targetUser.isBlocked
      }});
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

  // ── ЛИЧНЫЙ ЧАТ ──
  socket.on('load_chat', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const msgs = await Message.find({ chatId: getChatId(me, target.toLowerCase()), chatType: 'direct' })
        .sort({ timestamp: 1 }).limit(200);
      await Message.updateMany({ chatId: getChatId(me, target.toLowerCase()), to: me, read: false }, { read: true });
      const senderSocket = userSockets.get(target.toLowerCase());
      if (senderSocket) io.to(senderSocket).emit('messages_read', { by: me });
      cb({ success: true, messages: msgs });
    } catch (e) { cb({ success: false, error: 'Ошибка загрузки' }); }
  });

  // ── ОТПРАВИТЬ СООБЩЕНИЕ (личное) ──
  socket.on('send_message', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { to, text, type, audioData } = data;
      const recipientSocket = userSockets.get(to.toLowerCase());
      const msg = await Message.create({
        chatId: getChatId(me, to.toLowerCase()), chatType: 'direct',
        from: me, to: to.toLowerCase(),
        text: text || '', type: type || 'text', audioData: audioData || null,
        delivered: !!recipientSocket, read: false
      });
      socket.emit('new_message', msg);
      if (recipientSocket) io.to(recipientSocket).emit('new_message', msg);
      cb({ success: true, message: msg });
    } catch (e) { cb({ success: false, error: 'Ошибка отправки' }); }
  });

  // ══════════════════════════════════════════
  //  ГРУППЫ
  // ══════════════════════════════════════════

  // Создать группу
  socket.on('create_group', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { name, description, members } = data;
      if (!name?.trim()) return cb({ success: false, error: 'Название обязательно' });
      const allMembers = [...new Set([me, ...(members || [])])];
      const group = await Group.create({
        name: name.trim(), description: description || '',
        owner: me, admins: [me], members: allMembers
      });
      // Уведомляем всех участников
      for (const member of allMembers) {
        const s = userSockets.get(member);
        if (s) io.to(s).emit('group_created', group);
      }
      cb({ success: true, group });
    } catch (e) { cb({ success: false, error: 'Ошибка создания' }); }
  });

  // Загрузить сообщения группы
  socket.on('load_group_chat', async (groupId, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Группа не найдена' });
      if (!group.members.includes(me)) return cb({ success: false, error: 'Нет доступа' });
      const msgs = await Message.find({ chatId: getGroupChatId(groupId), chatType: 'group' })
        .sort({ timestamp: 1 }).limit(200);
      cb({ success: true, messages: msgs, group });
    } catch (e) { cb({ success: false, error: 'Ошибка загрузки' }); }
  });

  // Отправить в группу
  socket.on('send_group_message', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { groupId, text, type, audioData } = data;
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Группа не найдена' });
      if (!group.members.includes(me)) return cb({ success: false, error: 'Нет доступа' });
      const msg = await Message.create({
        chatId: getGroupChatId(groupId), chatType: 'group',
        from: me, to: '', groupId,
        text: text || '', type: type || 'text', audioData: audioData || null,
        delivered: true, read: false
      });
      // Рассылаем всем участникам группы
      for (const member of group.members) {
        const s = userSockets.get(member);
        if (s) io.to(s).emit('new_group_message', { ...msg.toObject(), groupId });
      }
      cb({ success: true, message: msg });
    } catch (e) { cb({ success: false, error: 'Ошибка отправки' }); }
  });

  // Добавить участника в группу
  socket.on('group_add_member', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { groupId, username } = data;
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Группа не найдена' });
      if (!group.admins.includes(me)) return cb({ success: false, error: 'Нет прав' });
      if (group.members.includes(username)) return cb({ success: false, error: 'Уже в группе' });
      group.members.push(username);
      await group.save();
      const s = userSockets.get(username);
      if (s) io.to(s).emit('group_created', group);
      io.to(userSockets.get(me)).emit('group_updated', group);
      cb({ success: true, group });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  // Покинуть группу
  socket.on('leave_group', async (groupId, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Группа не найдена' });
      group.members = group.members.filter(m => m !== me);
      group.admins  = group.admins.filter(a => a !== me);
      if (group.owner === me && group.members.length > 0) group.owner = group.members[0];
      if (group.members.length === 0) { await Group.deleteOne({ _id: groupId }); }
      else await group.save();
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  // Обновить инфо группы
  socket.on('update_group', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { groupId, name, description, avatar } = data;
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Группа не найдена' });
      if (!group.admins.includes(me)) return cb({ success: false, error: 'Нет прав' });
      if (name) group.name = name;
      if (description !== undefined) group.description = description;
      if (avatar !== undefined) group.avatar = avatar;
      await group.save();
      for (const member of group.members) {
        const s = userSockets.get(member);
        if (s) io.to(s).emit('group_updated', group);
      }
      cb({ success: true, group });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  // ── РЕАКЦИИ ──
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
        reactions.set(emoji, users.filter(u => u !== me));
        if (reactions.get(emoji).length === 0) reactions.delete(emoji);
      } else {
        reactions.set(emoji, [...users, me]);
      }
      msg.reactions = reactions;
      await msg.save();
      const reactionUpdate = { messageId, reactions: Object.fromEntries(msg.reactions) };
      if (msg.chatType === 'group') {
        const group = await Group.findById(msg.groupId);
        if (group) {
          for (const member of group.members) {
            const s = userSockets.get(member);
            if (s) io.to(s).emit('reaction_updated', reactionUpdate);
          }
        }
      } else {
        const otherUser = msg.from === me ? msg.to : msg.from;
        socket.emit('reaction_updated', reactionUpdate);
        const otherSocket = userSockets.get(otherUser);
        if (otherSocket) io.to(otherSocket).emit('reaction_updated', reactionUpdate);
      }
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

  socket.on('group_typing', async (groupId) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    try {
      const group = await Group.findById(groupId);
      if (!group) return;
      for (const member of group.members) {
        if (member === me) continue;
        const s = userSockets.get(member);
        if (s) io.to(s).emit('group_user_typing', { from: me, groupId });
      }
    } catch (e) {}
  });

  // ── АВАТАР ──
  socket.on('update_avatar', async (avatarData, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      await User.updateOne({ username: me }, { avatar: avatarData });
      io.emit('avatar_updated', { username: me, avatar: avatarData });
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
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
      const [totalUsers, totalMessages, chats, blockedUsers, totalGroups] = await Promise.all([
        User.countDocuments(), Message.countDocuments(),
        Message.distinct('chatId'), User.countDocuments({ isBlocked: true }),
        Group.countDocuments()
      ]);
      cb({ success: true, stats: {
        totalUsers, onlineUsers: onlineUsers.size,
        totalMessages, totalChats: chats.length, blockedUsers, totalGroups
      }});
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_get_users', async (data, cb) => {
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
        contactsCount: u.contacts.length, createdAt: u.createdAt,
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

  socket.on('admin_demote_user', async (target, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      if (target === 'admin') return cb({ success: false, error: 'Нельзя разжаловать главного админа' });
      if (target === me) return cb({ success: false, error: 'Нельзя разжаловать себя' });
      const t = await User.findOneAndUpdate({ username: target.toLowerCase() }, { isAdmin: false });
      if (!t) return cb({ success: false, error: 'Пользователь не найден' });
      await logAdminAction(me, 'DEMOTE_USER', target, `${target} разжалован из администраторов`);
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });


  // ── РЕДАКТИРОВАТЬ СООБЩЕНИЕ ──
  socket.on('edit_message', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { messageId, newText } = data;
      const msg = await Message.findById(messageId);
      if (!msg) return cb({ success: false, error: 'Сообщение не найдено' });
      if (msg.from !== me) return cb({ success: false, error: 'Нет прав' });
      if (!newText?.trim()) return cb({ success: false, error: 'Текст пустой' });
      msg.text = newText.trim();
      msg.edited = true;
      await msg.save();
      const update = { messageId, newText: msg.text, edited: true };
      if (msg.chatType === 'group') {
        const group = await Group.findById(msg.groupId);
        if (group) group.members.forEach(m => { const s = userSockets.get(m); if (s) io.to(s).emit('message_edited', update); });
      } else {
        socket.emit('message_edited', update);
        const other = userSockets.get(msg.to === me ? msg.from : msg.to);
        if (other) io.to(other).emit('message_edited', update);
      }
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  // ── УДАЛИТЬ СООБЩЕНИЕ ──
  socket.on('delete_message', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { messageId, deleteFor } = data; // deleteFor: 'me' | 'all'
      const msg = await Message.findById(messageId);
      if (!msg) return cb({ success: false, error: 'Сообщение не найдено' });
      if (deleteFor === 'all' && msg.from !== me) return cb({ success: false, error: 'Нет прав' });
      if (deleteFor === 'all') {
        await Message.deleteOne({ _id: messageId });
        const update = { messageId };
        if (msg.chatType === 'group') {
          const group = await Group.findById(msg.groupId);
          if (group) group.members.forEach(m => { const s = userSockets.get(m); if (s) io.to(s).emit('message_deleted', update); });
        } else {
          socket.emit('message_deleted', update);
          const other = userSockets.get(msg.to === me ? msg.from : msg.to);
          if (other) io.to(other).emit('message_deleted', update);
        }
      } else {
        socket.emit('message_deleted', { messageId });
      }
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  // ── ПЕРЕСЛАТЬ СООБЩЕНИЕ ──
  socket.on('forward_message', async (data, cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return cb({ success: false, error: 'Не авторизован' });
    try {
      const { messageId, toUsername } = data;
      const original = await Message.findById(messageId);
      if (!original) return cb({ success: false, error: 'Сообщение не найдено' });
      const recipientSocket = userSockets.get(toUsername.toLowerCase());
      const msg = await Message.create({
        chatId: getChatId(me, toUsername.toLowerCase()), chatType: 'direct',
        from: me, to: toUsername.toLowerCase(),
        text: original.text, type: original.type, audioData: original.audioData,
        forwarded: true, forwardedFrom: original.from,
        delivered: !!recipientSocket, read: false
      });
      socket.emit('new_message', msg);
      if (recipientSocket) io.to(recipientSocket).emit('new_message', msg);
      cb({ success: true, message: msg });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  // ══════════════════════════════════════════
  //  АУДИО ЗВОНКИ (WebRTC сигнализация)
  // ══════════════════════════════════════════

  // Инициатор -> вызываемый
  socket.on('call_offer', (data) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    const { to, offer } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('incoming_call', { from: me, offer });
    else socket.emit('call_failed', { reason: 'Пользователь не в сети' });
  });

  // Вызываемый принял -> отправляем answer инициатору
  socket.on('call_answer', (data) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    const { to, answer } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('call_answered', { from: me, answer });
  });

  // ICE кандидаты
  socket.on('ice_candidate', (data) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    const { to, candidate } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('ice_candidate', { from: me, candidate });
  });

  // Завершить звонок
  socket.on('call_end', (data) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    const { to } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('call_ended', { from: me });
  });

  // Отклонить звонок
  socket.on('call_reject', (data) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    const { to } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('call_rejected', { from: me });
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
    groups: await Group.countDocuments().catch(() => 0),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Whispr Server v3 on port ${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));

// ══════════════════════════════════════════
// ПАТЧ v4: редактирование, удаление, пересылка, звонки
// ══════════════════════════════════════════
