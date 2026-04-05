const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 50e6  // 50MB — для голосовых и видео сообщений
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
  username:     { type: String, required: true, unique: true, lowercase: true },
  displayName:  { type: String, required: true },
  password:     { type: String, required: true },
  isAdmin:      { type: Boolean, default: false },
  isBlocked:    { type: Boolean, default: false },
  verified:     { type: Boolean, default: false },
  avatar:       { type: String, default: null },
  contacts:     [{ type: String }],
  pinnedChats:  [{ type: String }], // NEW: pinned chat keys
  bio:          { type: String, default: '' },
  customStatus: { type: String, default: '' }, // NEW: emoji+text status
  status:       { type: String, default: 'online' },
  hideOnline:   { type: Boolean, default: false },
  lastSeen:     { type: Date, default: null }, // NEW
  blockedUsers: [{ type: String }],
  createdAt:    { type: Date, default: Date.now }
});

const groupSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  description:   { type: String, default: '' },
  avatar:        { type: String, default: null },
  owner:         { type: String, required: true },
  admins:        [{ type: String }],
  moderators:    [{ type: String }], // NEW: moderator role
  members:       [{ type: String }],
  pinnedMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  slowMode:      { type: Number, default: 0 }, // NEW: seconds between messages (0=off)
  slowModeTrack: { type: Map, of: Date, default: {} }, // NEW: username->lastSent
  createdAt:     { type: Date, default: Date.now }
});

const pollSchema = new mongoose.Schema({ // NEW: polls
  chatId:    { type: String, required: true },
  chatType:  { type: String, default: 'group' },
  groupId:   { type: String, default: null },
  from:      { type: String, required: true },
  question:  { type: String, required: true },
  options:   [{ text: String, votes: [String] }], // votes = array of usernames
  anonymous: { type: Boolean, default: false },
  closed:    { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  chatId:    { type: String, required: true, index: true },
  chatType:  { type: String, default: 'direct' },
  from:      { type: String, required: true },
  to:        { type: String, default: '' },
  groupId:   { type: String, default: null },
  text:      { type: String, default: '' },
  type:      { type: String, default: 'text' }, // text|voice|image|file|video|sticker|gif|poll
  audioData: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  read:      { type: Boolean, default: false },
  reactions:     { type: Map, of: [String], default: {} },
  edited:        { type: Boolean, default: false },
  forwarded:     { type: Boolean, default: false },
  forwardedFrom: { type: String, default: null },
  replyToId:     { type: String, default: null },
  replyFrom:     { type: String, default: null },
  replyText:     { type: String, default: null },
  fileName:      { type: String, default: null },
  fileMime:      { type: String, default: null },
  pollId:        { type: String, default: null }, // NEW
  linkPreview:   { type: Object, default: null }
});

const adminLogSchema = new mongoose.Schema({
  admin:     { type: String, required: true },
  action:    { type: String, required: true },
  target:    { type: String },
  details:   { type: String },
  timestamp: { type: Date, default: Date.now }
});


const channelSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  username:    { type: String, default: null, lowercase: true },
  description: { type: String, default: '' },
  avatar:      { type: String, default: null },
  owner:       { type: String, required: true },
  admins:      [{ type: String }],
  editors:     [{ type: String }], // NEW: can post but not manage
  subscribers: [{ type: String }],
  isPrivate:   { type: Boolean, default: false },
  isBlocked:   { type: Boolean, default: false },
  verified:    { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now }
});

const callLogSchema = new mongoose.Schema({
  from:      { type: String, required: true },
  to:        { type: String, required: true },
  type:      { type: String, default: 'audio' }, // audio | video
  status:    { type: String, default: 'missed' }, // missed | completed | cancelled
  duration:  { type: Number, default: 0 },        // секунды
  timestamp: { type: Date, default: Date.now }
});

const Channel  = mongoose.model('Channel', channelSchema);
const CallLog  = mongoose.model('CallLog', callLogSchema);
const User     = mongoose.model('User', userSchema);
const Group    = mongoose.model('Group', groupSchema);
const Message  = mongoose.model('Message', messageSchema);
const AdminLog = mongoose.model('AdminLog', adminLogSchema);
const Poll     = mongoose.model('Poll', pollSchema);

// ── DDoS / Rate limiting ──
const rateLimitMap = new Map(); // socketId -> { count, resetAt }
function rateLimit(socketId, max = 30, windowMs = 10000) {
  const now = Date.now();
  let entry = rateLimitMap.get(socketId);
  if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + windowMs };
  entry.count++;
  rateLimitMap.set(socketId, entry);
  return entry.count > max;
}
// Clean up rate limit map every minute
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap.entries()) if (now > v.resetAt) rateLimitMap.delete(k);
}, 60000);

// ══════════════════════════════════════════
//  ИНИЦИАЛИЗАЦИЯ ADMIN
// ══════════════════════════════════════════
mongoose.connection.once('open', async () => {
  // Пересоздаём индексы (защита после очистки коллекций в MongoDB Atlas)
  try { await Promise.all([Message.ensureIndexes(), User.ensureIndexes(), Group.ensureIndexes(), Channel.ensureIndexes()]); } catch(e) { console.warn('ensureIndexes:', e.message); }

  const admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    await User.create({ username: 'admin', displayName: 'Администратор', password: 'mawadmin201223', isAdmin: true });
    console.log('👑 Admin создан');
  } else {
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

  // DDoS protection: rate limit all events
  socket.use(([event], next) => {
    if (rateLimit(socket.id)) {
      console.warn(`⚠️ Rate limit exceeded: ${socket.id} on ${event}`);
      socket.emit('rate_limited', { event });
      return; // drop event
    }
    next();
  });

  const requireAuth = (cb) => {
    const me = onlineUsers.get(socket.id);
    if (!me) {
      socket.emit('session_expired');
      if (typeof cb === 'function') cb({ success: false, error: 'Не авторизован' });
      return null;
    }
    return me;
  };

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
        username: c.username, displayName: c.displayName, bio: c.bio||'',
        avatar: c.avatar, isOnline: userSockets.has(c.username), isBlocked: c.isBlocked,
        verified: c.verified||false,
        isBlockedByMe: (user.blockedUsers||[]).includes(c.username)
      }));

      // Группы пользователя
      const groups = await Group.find({ members: user.username });

      await Message.updateMany({ to: user.username, delivered: false }, { delivered: true });
      const statusEmit = user.hideOnline ? null : { username: user.username, isOnline: true, status: user.status || 'online' };
      if (statusEmit) io.emit('user_status_change', statusEmit);

      // Каналы пользователя
      const userChannels = await Channel.find({ subscribers: user.username });
      cb({ success: true, user: { ...user.toObject(), password: undefined }, contacts, groups, channels: userChannels, pinnedChats: user.pinnedChats||[] });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ПОИСК ──
  socket.on('search_users', async (query, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const [results, channels] = await Promise.all([
        User.find({
          username: { $ne: me },
          $or: [{ username: { $regex: query, $options: 'i' } }, { displayName: { $regex: query, $options: 'i' } }]
        }).limit(15),
        Channel.find({
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { username: { $regex: query, $options: 'i' } }
          ]
        }).limit(10)
      ]);
      cb({ success: true,
        results: results.map(u => ({
          username: u.username, displayName: u.displayName, bio: u.bio||'',
          avatar: u.avatar, isOnline: userSockets.has(u.username), isBlocked: u.isBlocked
        })),
        channels: channels.map(ch => ({
          _id: ch._id, name: ch.name, username: ch.username,
          description: ch.description, avatar: ch.avatar,
          isPrivate: ch.isPrivate, subscriberCount: ch.subscribers.length,
          isSubscribed: ch.subscribers.includes(me)
        }))
      });
    } catch (e) { cb({ success: false, error: 'Ошибка поиска' }); }
  });

  // ── КОНТАКТЫ ──
  socket.on('add_contact', async (target, cb) => {
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
    try {
      await User.updateOne({ username: me }, { $pull: { contacts: target.toLowerCase() } });
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ЛИЧНЫЙ ЧАТ ──
  socket.on('load_chat', async (target, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const chatId = getChatId(me, target.toLowerCase());
      const msgs = await Message.find({ chatId, chatType: 'direct' })
        .sort({ timestamp: 1 }).limit(200);
      // Mark as read and collect IDs
      const unreadIds = msgs.filter(m => m.to === me && !m.read).map(m => m._id.toString());
      await Message.updateMany({ chatId, to: me, read: false }, { read: true });
      const senderSocket = userSockets.get(target.toLowerCase());
      if (senderSocket && unreadIds.length > 0) io.to(senderSocket).emit('messages_read', { by: me, messageIds: unreadIds });
      // Добавить историю звонков как виртуальные сообщения
      const callLogs = await CallLog.find({
        $or: [{ from: me, to: target.toLowerCase() }, { from: target.toLowerCase(), to: me }]
      }).sort({ timestamp: 1 }).limit(50);
      const callMsgs = callLogs.map(log => ({
        _id: `call_${log._id}`, chatId, type: 'call_log',
        callSubtype: log.type, callStatus: log.status,
        callDuration: log.duration, from: log.from,
        to: log.to, timestamp: log.timestamp, text: ''
      }));
      const all = [...msgs.map(m => m.toObject()), ...callMsgs]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      cb({ success: true, messages: all });
    } catch (e) { console.error(e); cb({ success: false, error: 'Ошибка загрузки' }); }
  });

  // ── ОТПРАВИТЬ СООБЩЕНИЕ (личное) ──
  socket.on('send_message', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const { to, text, type, audioData, replyToId, replyFrom, replyText } = data;
      const meUser = await User.findOne({ username: me });
      if (!meUser) { socket.emit('session_expired'); return cb({ success: false, error: 'Пользователь не найден' }); }
      if (meUser.blockedUsers?.includes(to.toLowerCase())) return cb({ success: false, error: 'Вы заблокировали этого пользователя' });
      const toUser = await User.findOne({ username: to.toLowerCase() });
      if (toUser?.blockedUsers?.includes(me)) return cb({ success: false, error: 'Вы заблокированы этим пользователем' });
      const recipientSocket = userSockets.get(to.toLowerCase());
      const msg = await Message.create({
        chatId: getChatId(me, to.toLowerCase()), chatType: 'direct',
        from: me, to: to.toLowerCase(),
        text: text || '', type: type || 'text', audioData: audioData || null,
        delivered: !!recipientSocket, read: false,
        replyToId: replyToId || null, replyFrom: replyFrom || null, replyText: replyText || null,
        fileName: data.fileName || null, fileMime: data.fileMime || null
      });
      // Send to recipient; also echo back to sender for immediate display
      if (recipientSocket) io.to(recipientSocket).emit('new_message', msg);
      socket.emit('new_message', msg); // sender echo
      cb({ success: true, message: msg.toObject() });
    } catch (e) { console.error('send_message error:', e); cb({ success: false, error: 'Ошибка отправки: ' + e.message }); }
  });

  // ══════════════════════════════════════════
  //  ГРУППЫ
  // ══════════════════════════════════════════

  // Создать группу
  socket.on('create_group', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
    try {
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Группа не найдена' });
      if (!group.members.includes(me)) return cb({ success: false, error: 'Нет доступа' });
      const msgs = await Message.find({ chatId: getGroupChatId(groupId), chatType: 'group' })
        .sort({ timestamp: 1 }).limit(200);
      cb({ success: true, messages: msgs, group });
    } catch (e) { cb({ success: false, error: 'Ошибка загрузки' }); }
  });

  socket.on('send_group_message', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const { groupId, text, type, audioData, replyToId, replyFrom, replyText } = data;
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Группа не найдена' });
      if (!group.members.includes(me)) return cb({ success: false, error: 'Нет доступа' });
      // Slow mode check (skip for admins/moderators)
      const isPrivileged = group.owner===me || group.admins.includes(me) || group.moderators?.includes(me);
      if (group.slowMode > 0 && !isPrivileged) {
        const lastSent = group.slowModeTrack?.get(me);
        if (lastSent && (Date.now() - new Date(lastSent).getTime()) < group.slowMode * 1000) {
          const wait = Math.ceil(group.slowMode - (Date.now() - new Date(lastSent).getTime()) / 1000);
          return cb({ success: false, error: `Медленный режим: подожди ещё ${wait} сек.` });
        }
        group.slowModeTrack = group.slowModeTrack || new Map();
        group.slowModeTrack.set(me, new Date());
        await group.save();
      }
      const msg = await Message.create({
        chatId: getGroupChatId(groupId), chatType: 'group',
        from: me, to: '', groupId,
        text: text || '', type: type || 'text', audioData: audioData || null,
        replyToId: replyToId || null, replyFrom: replyFrom || null, replyText: replyText || null,
        fileName: data.fileName || null, fileMime: data.fileMime || null,
        delivered: true, read: false
      });
      for (const member of group.members) {
        const s = userSockets.get(member);
        if (s) io.to(s).emit('new_group_message', { ...msg.toObject(), groupId });
      }
      cb({ success: true, message: msg });
    } catch (e) { console.error('send_group_message error:', e); cb({ success: false, error: 'Ошибка отправки: ' + e.message }); }
  });

  // Добавить участника в группу
  socket.on('group_add_member', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
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
    const me = onlineUsers.get(socket.id); if (!me) return;
    const s = userSockets.get(target.toLowerCase());
    if (s) io.to(s).emit('user_typing', { from: me });
  });

  socket.on('group_typing', async (groupId) => {
    const me = onlineUsers.get(socket.id); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
    try {
      await User.updateOne({ username: me }, { avatar: avatarData });
      io.emit('avatar_updated', { username: me, avatar: avatarData });
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ОБНОВИТЬ ПРОФИЛЬ (ник, юзернейм, аватар) ──
  socket.on('update_profile', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const { displayName, newUsername, avatar, bio, hideOnline, status } = data;
      const user = await User.findOne({ username: me });
      if (!user) return cb({ success: false, error: 'Пользователь не найден' });

      // Смена юзернейма
      if (newUsername && newUsername.toLowerCase() !== me) {
        const taken = await User.findOne({ username: newUsername.toLowerCase() });
        if (taken) return cb({ success: false, error: 'Username уже занят' });
        if (!/^[a-z0-9_]{3,20}$/.test(newUsername.toLowerCase()))
          return cb({ success: false, error: 'Username: 3-20 символов, только буквы/цифры/_' });

        const oldUsername = me;
        const nu = newUsername.toLowerCase();

        // Обновляем само имя пользователя
        user.username = nu;

        // Обновляем контакты у других пользователей
        await User.updateMany({ contacts: oldUsername }, { $set: { 'contacts.$': nu } });

        // Обновляем сообщения
        await Message.updateMany({ from: oldUsername }, { from: nu });
        await Message.updateMany({ to: oldUsername }, { to: nu });
        // Пересчитываем chatId ТОЛЬКО для сообщений этого пользователя
        const msgs = await Message.find({ chatType: 'direct', $or: [{ from: nu }, { to: nu }] });
        for (const msg of msgs) {
          msg.chatId = [msg.from, msg.to].sort().join('_');
          await msg.save();
        }

        // Обновляем группы
        await Group.updateMany({ members: oldUsername }, { $set: { 'members.$': nu } });
        await Group.updateMany({ admins: oldUsername }, { $set: { 'admins.$': nu } });
        await Group.updateMany({ owner: oldUsername }, { owner: nu });

        // Обновляем маппинги сокетов
        onlineUsers.set(socket.id, nu);
        userSockets.delete(oldUsername);
        userSockets.set(nu, socket.id);
      }

      if (displayName) user.displayName = displayName.trim();
      if (avatar !== undefined) user.avatar = avatar;
      if (bio !== undefined) user.bio = bio.slice(0, 200);
      if (hideOnline !== undefined) user.hideOnline = hideOnline;
      if (status && ['online','away','dnd'].includes(status)) user.status = status;
      await user.save();

      if (avatar !== undefined) io.emit('avatar_updated', { username: user.username, avatar });

      const updatedUser = user.toObject();
      delete updatedUser.password;
      cb({ success: true, user: updatedUser });
    } catch (e) { console.error(e); cb({ success: false, error: 'Ошибка сервера' }); }
  });


  // ── ОБНОВИТЬ СТАТУС ──
  socket.on('set_status', async (status, cb) => {
    const me = requireAuth(cb); if (!me) return;
    const allowed = ['online','away','dnd'];
    if (!allowed.includes(status)) return cb && cb({ success: false, error: 'Неверный статус' });
    try {
      await User.updateOne({ username: me }, { status });
      const user = await User.findOne({ username: me });
      if (!user.hideOnline) {
        // Уведомить ВСЕХ онлайн пользователей у кого есть этот контакт
        for (const [username, sid] of userSockets.entries()) {
          if (username === me) continue;
          const u = await User.findOne({ username });
          if (u && u.contacts.includes(me)) {
            io.to(sid).emit('user_status_change', { username: me, isOnline: status !== 'dnd', status });
          }
        }
      }
      if (cb) cb({ success: true });
    } catch (e) { if (cb) cb({ success: false }); }
  });

  // ── СКРЫТЬ ОНЛАЙН / ПОКАЗАТЬ ──
  socket.on('set_hide_online', async (hide, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      await User.updateOne({ username: me }, { hideOnline: hide });
      // Если скрываем — сказать всем что оффлайн, если показываем — онлайн
      for (const [username, sid] of userSockets.entries()) {
        if (username === me) continue;
        const u = await User.findOne({ username });
        if (u && u.contacts.includes(me)) {
          io.to(sid).emit('user_status_change', { username: me, isOnline: !hide, status: hide ? 'hidden' : 'online' });
        }
      }
      if (cb) cb({ success: true });
    } catch (e) { if (cb) cb({ success: false }); }
  });

  // ── ЗАБЛОКИРОВАТЬ / РАЗБЛОКИРОВАТЬ ПОЛЬЗОВАТЕЛЯ (личная блокировка) ──
  socket.on('block_user', async ({ target, block }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      if (block) {
        await User.updateOne({ username: me }, { $addToSet: { blockedUsers: target } });
      } else {
        await User.updateOne({ username: me }, { $pull: { blockedUsers: target } });
      }
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ПОЛУЧИТЬ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ──
  socket.on('get_user_profile', async (username, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user) return cb({ success: false, error: 'Не найден' });
      const meUser = await User.findOne({ username: me });
      const isOnline = userSockets.has(user.username);
      cb({ success: true, profile: {
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio || '',
        verified: user.verified || false,
        status: user.hideOnline ? 'hidden' : (isOnline ? (user.status || 'online') : 'offline'),
        createdAt: user.createdAt,
        isOnline: user.hideOnline ? false : isOnline,
        isBlockedByMe: (meUser?.blockedUsers||[]).includes(user.username),
      }});
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ПОИСК ПО СООБЩЕНИЯМ В ЧАТЕ ──
  socket.on('search_messages', async ({ chatKey, query }, cb) => {
    const me = requireAuth(cb); if (!me || !query || query.length < 2) return cb({ success: false, results: [] });
    try {
      let filter = { text: { $regex: query, $options: 'i' }, type: 'text' };
      if (chatKey.startsWith('group_')) {
        filter.groupId = chatKey.replace('group_', '');
        filter.chatType = 'group';
      } else {
        filter.chatType = 'direct';
        filter.chatId = [me, chatKey].sort().join('_');
      }
      const msgs = await Message.find(filter).sort({ timestamp: -1 }).limit(30);
      cb({ success: true, results: msgs });
    } catch (e) { cb({ success: false, results: [] }); }
  });

  // ── ЗАКРЕПИТЬ СООБЩЕНИЕ В ГРУППЕ ──
  socket.on('pin_message', async ({ groupId, messageId }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Группа не найдена' });
      if (!group.admins.includes(me) && group.owner !== me) return cb({ success: false, error: 'Нет прав' });
      group.pinnedMessage = messageId || null;
      await group.save();
      // Уведомить всех участников
      for (const member of group.members) {
        const sid = userSockets.get(member);
        if (sid) io.to(sid).emit('message_pinned', { groupId, messageId, pinnedBy: me });
      }
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  // ── ПОЛУЧИТЬ ЗАКРЕПЛЁННОЕ СООБЩЕНИЕ ──
  socket.on('get_pinned_message', async (groupId, cb) => {
    try {
      const group = await Group.findById(groupId);
      if (!group?.pinnedMessage) return cb({ success: true, message: null });
      const msg = await Message.findById(group.pinnedMessage);
      cb({ success: true, message: msg });
    } catch (e) { cb({ success: false, message: null }); }
  });


  // ══════════════════════════════════════════
  //  КАНАЛЫ
  // ══════════════════════════════════════════
  socket.on('create_channel', async (data, cb) => {
    console.log('create_channel called by', onlineUsers.get(socket.id), data?.name);
    const me = requireAuth(cb); if (!me) return;
    try {
      const { name, username, description } = data;
      if (!name?.trim()) return cb({ success: false, error: 'Нужно название' });
      // Проверить уникальность username
      if (username) {
        const taken = await Channel.findOne({ username: username.toLowerCase() });
        if (taken) return cb({ success: false, error: 'Username канала уже занят' });
        if (!/^[a-z0-9_]{3,32}$/.test(username.toLowerCase()))
          return cb({ success: false, error: 'Username: 3-32 символа, только a-z, 0-9, _' });
      }
      const channel = await Channel.create({
        name: name.trim(), username: username?.toLowerCase() || null,
        description: description || '', isPrivate: false,
        owner: me, admins: [me], subscribers: [me]
      });
      cb({ success: true, channel });
    } catch(e) { console.error(e); cb({ success: false, error: 'Ошибка сервера' }); }
  });

  socket.on('search_channels', async (query, cb) => {
    try {
      const channels = await Channel.find({

        $or: [
          { name: { $regex: query, $options: 'i' } },
          { username: { $regex: query, $options: 'i' } }
        ]
      }).limit(15);
      cb({ success: true, channels });
    } catch(e) { cb({ success: false, channels: [] }); }
  });

  socket.on('subscribe_channel', async (channelId, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const ch = await Channel.findByIdAndUpdate(channelId, { $addToSet: { subscribers: me } }, { new: true });
      if (!ch) return cb({ success: false, error: 'Канал не найден' });
      cb({ success: true, channel: ch });
    } catch(e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('unsubscribe_channel', async (channelId, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      await Channel.findByIdAndUpdate(channelId, { $pull: { subscribers: me } });
      cb({ success: true });
    } catch(e) { cb({ success: false }); }
  });

  socket.on('update_channel', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const { channelId, name, username, description, avatar } = data;
      const ch = await Channel.findById(channelId);
      if (!ch) return cb({ success: false, error: 'Не найден' });
      if (ch.owner !== me && !ch.admins.includes(me)) return cb({ success: false, error: 'Нет прав' });
      if (username && username !== ch.username) {
        const taken = await Channel.findOne({ username: username.toLowerCase() });
        if (taken) return cb({ success: false, error: 'Username занят' });
      }
      if (name) ch.name = name.trim();
      if (username !== undefined) ch.username = username?.toLowerCase() || null;
      if (description !== undefined) ch.description = description;
      if (avatar !== undefined) ch.avatar = avatar;
      ch.isPrivate = false; // Каналы всегда публичные
      await ch.save();
      // Уведомить подписчиков
      for (const sub of ch.subscribers) {
        const sid = userSockets.get(sub);
        if (sid) io.to(sid).emit('channel_updated', ch);
      }
      cb({ success: true, channel: ch });
    } catch(e) { cb({ success: false, error: 'Ошибка сервера' }); }
  });

  socket.on('send_channel_message', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const { channelId, text, type, audioData, videoData } = data;
      const ch = await Channel.findById(channelId);
      if (!ch) return cb({ success: false, error: 'Канал не найден' });
      if (!ch.admins.includes(me) && ch.owner !== me && !(ch.editors||[]).includes(me)) return cb({ success: false, error: 'Только администраторы могут писать' });
      const msg = await Message.create({
        chatId: `channel_${channelId}`, chatType: 'channel',
        from: me, groupId: channelId, text: text || '', type: type || 'text',
        audioData: audioData || null,
      });
      for (const sub of ch.subscribers) {
        const sid = userSockets.get(sub);
        if (sid) io.to(sid).emit('new_channel_message', { ...msg.toObject(), channelId, channelName: ch.name });
      }
      cb({ success: true, message: msg });
    } catch(e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('load_channel_chat', async (channelId, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const msgs = await Message.find({ chatId: `channel_${channelId}`, chatType: 'channel' }).sort({ timestamp: 1 }).limit(100);
      cb({ success: true, messages: msgs });
    } catch(e) { cb({ success: false, messages: [] }); }
  });

  socket.on('delete_channel', async (channelId, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const ch = await Channel.findById(channelId);
      if (!ch || ch.owner !== me) return cb({ success: false, error: 'Нет прав' });
      await Channel.findByIdAndDelete(channelId);
      await Message.deleteMany({ chatId: `channel_${channelId}` });
      for (const sub of ch.subscribers) {
        const sid = userSockets.get(sub);
        if (sid) io.to(sid).emit('channel_deleted', { channelId });
      }
      cb({ success: true });
    } catch(e) { cb({ success: false }); }
  });

  // ══════════════════════════════════════════
  //  АДМИН
  // ══════════════════════════════════════════
  socket.on('admin_get_stats', async (cb) => {
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const query = data.search
        ? { $or: [{ username: { $regex: data.search, $options: 'i' } }, { displayName: { $regex: data.search, $options: 'i' } }] }
        : {};
      const users = await User.find(query).limit(100);
      cb({ success: true, users: users.map(u => ({
        username: u.username, displayName: u.displayName,
        isAdmin: u.isAdmin, isBlocked: u.isBlocked, verified: u.verified||false,
        contactsCount: u.contacts.length, createdAt: u.createdAt,
        isOnline: userSockets.has(u.username)
      }))});
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_get_logs', async (cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const logs = await AdminLog.find().sort({ timestamp: -1 }).limit(50);
      cb({ success: true, logs });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_delete_user', async (target, cb) => {
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
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

  socket.on('admin_verify_user', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const { target, verify } = data;
      await User.updateOne({ username: target.toLowerCase() }, { verified: verify });
      await logAdminAction(me, verify ? 'VERIFY_USER' : 'UNVERIFY_USER', target, `${target} ${verify ? 'верифицирован' : 'снята верификация'}`);
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_get_channels', async (cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const channels = await Channel.find({}).limit(100).lean();
      console.log(`admin_get_channels: found ${channels.length} channels`);
      cb({ success: true, channels: channels.map(ch => ({
        _id: ch._id, name: ch.name, username: ch.username,
        owner: ch.owner, subscriberCount: (ch.subscribers||[]).length,
        isBlocked: ch.isBlocked||false, verified: ch.verified||false, createdAt: ch.createdAt
      }))});
    } catch (e) { console.error('admin_get_channels error:', e); cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_block_channel', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const { channelId, block } = data;
      const ch = await Channel.findByIdAndUpdate(channelId, { isBlocked: block }, { new: true });
      if (!ch) return cb({ success: false, error: 'Канал не найден' });
      await logAdminAction(me, block ? 'BLOCK_CHANNEL' : 'UNBLOCK_CHANNEL', ch.name, `Канал ${ch.name} ${block ? 'заблокирован' : 'разблокирован'}`);
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });

  socket.on('admin_verify_channel', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const user = await User.findOne({ username: me });
      if (!user?.isAdmin) return cb({ success: false, error: 'Нет прав' });
      const { channelId, verify } = data;
      const ch = await Channel.findByIdAndUpdate(channelId, { verified: verify }, { new: true });
      if (!ch) return cb({ success: false, error: 'Канал не найден' });
      await logAdminAction(me, verify ? 'VERIFY_CHANNEL' : 'UNVERIFY_CHANNEL', ch.name, `Канал ${ch.name} ${verify ? 'верифицирован' : 'снята верификация'}`);
      cb({ success: true });
    } catch (e) { cb({ success: false, error: 'Ошибка' }); }
  });


  // ── РЕДАКТИРОВАТЬ СООБЩЕНИЕ ──
  socket.on('edit_message', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
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
    const me = requireAuth(cb); if (!me) return;
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
  socket.on('call_offer', async (data) => {
    const me = onlineUsers.get(socket.id); if (!me) return;
    const { to, offer, callType = 'audio' } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) {
      io.to(s).emit('incoming_call', { from: me, offer, callType });
    } else {
      try { await CallLog.create({ from: me, to: to.toLowerCase(), type: callType, status: 'missed', duration: 0 }); } catch(e) {}
      socket.emit('call_failed', { reason: `${to} сейчас не в сети. Звонок записан как пропущенный.` });
    }
  });

  // Вызываемый принял -> отправляем answer инициатору
  socket.on('call_answer', (data) => {
    const me = onlineUsers.get(socket.id); if (!me) return;
    const { to, answer } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('call_answered', { from: me, answer });
  });

  // ICE кандидаты
  socket.on('ice_candidate', (data) => {
    const me = onlineUsers.get(socket.id); if (!me) return;
    const { to, candidate } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('ice_candidate', { from: me, candidate });
  });

  // Завершить звонок
  socket.on('call_end', async (data) => {
    const me = onlineUsers.get(socket.id); if (!me) return;
    const { to, duration = 0, callType = 'audio' } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('call_ended', { from: me });
    try {
      const status = duration > 0 ? 'completed' : 'cancelled';
      await CallLog.create({ from: me, to: to.toLowerCase(), type: callType, status, duration });
    } catch(e) { console.error('CallLog save error:', e); }
  });

  // Отклонить звонок
  socket.on('call_reject', async (data) => {
    const me = onlineUsers.get(socket.id); if (!me) return;
    const { to, callType = 'audio' } = data;
    const s = userSockets.get(to.toLowerCase());
    if (s) io.to(s).emit('call_rejected', { from: me });
    try {
      await CallLog.create({ from: to.toLowerCase(), to: me, type: callType, status: 'missed', duration: 0 });
    } catch(e) {}
  });

  // Получить историю звонков
  socket.on('get_call_history', async ({ withUser }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const logs = await CallLog.find({
        $or: [{ from: me, to: withUser }, { from: withUser, to: me }]
      }).sort({ timestamp: -1 }).limit(20);
      cb({ success: true, logs });
    } catch(e) { cb({ success: false, logs: [] }); }
  });

  // ── ОТКЛЮЧЕНИЕ ──
  // ── ЗАКРЕПЛЁННЫЕ ЧАТЫ ──
  socket.on('pin_chat', async ({ chatKey, pin }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      if (pin) await User.updateOne({ username: me }, { $addToSet: { pinnedChats: chatKey } });
      else      await User.updateOne({ username: me }, { $pull: { pinnedChats: chatKey } });
      cb({ success: true });
    } catch(e) { cb({ success: false }); }
  });

  // ── LAST SEEN ──
  socket.on('get_last_seen', async (username, cb) => {
    try {
      const u = await User.findOne({ username }, 'lastSeen hideOnline');
      if (!u) return cb({ success: false });
      const isOnline = userSockets.has(username);
      cb({ success: true, isOnline, lastSeen: u.hideOnline ? null : u.lastSeen });
    } catch(e) { cb({ success: false }); }
  });

  // ── ОПРОСЫ ──
  socket.on('create_poll', async (data, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const { groupId, question, options, anonymous } = data;
      if (!question?.trim() || !options?.length) return cb({ success: false, error: 'Неверные данные' });
      const group = await Group.findById(groupId);
      if (!group || !group.members.includes(me)) return cb({ success: false, error: 'Нет доступа' });
      const poll = await Poll.create({
        chatId: getGroupChatId(groupId), chatType: 'group', groupId,
        from: me, question: question.trim(),
        options: options.map(t => ({ text: t, votes: [] })),
        anonymous: !!anonymous
      });
      const msg = await Message.create({
        chatId: getGroupChatId(groupId), chatType: 'group',
        from: me, groupId, type: 'poll', text: question,
        pollId: poll._id.toString(), delivered: true
      });
      const payload = { ...msg.toObject(), groupId, poll: poll.toObject() };
      for (const member of group.members) {
        const s = userSockets.get(member);
        if (s) io.to(s).emit('new_group_message', payload);
      }
      cb({ success: true, poll, message: msg });
    } catch(e) { cb({ success: false, error: e.message }); }
  });

  socket.on('vote_poll', async ({ pollId, optionIndex }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const poll = await Poll.findById(pollId);
      if (!poll || poll.closed) return cb({ success: false, error: 'Опрос закрыт' });
      // Remove previous vote
      poll.options.forEach(o => { o.votes = o.votes.filter(v => v !== me); });
      if (optionIndex >= 0 && optionIndex < poll.options.length) poll.options[optionIndex].votes.push(me);
      await poll.save();
      // Broadcast update
      if (poll.groupId) {
        const group = await Group.findById(poll.groupId);
        if (group) for (const m of group.members) { const s = userSockets.get(m); if (s) io.to(s).emit('poll_updated', poll); }
      }
      cb({ success: true, poll });
    } catch(e) { cb({ success: false, error: e.message }); }
  });

  socket.on('close_poll', async (pollId, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const poll = await Poll.findById(pollId);
      if (!poll) return cb({ success: false });
      const group = await Group.findById(poll.groupId);
      if (!group) return cb({ success: false });
      const canClose = poll.from === me || group.admins.includes(me) || group.owner === me;
      if (!canClose) return cb({ success: false, error: 'Нет прав' });
      poll.closed = true; await poll.save();
      for (const m of group.members) { const s = userSockets.get(m); if (s) io.to(s).emit('poll_updated', poll); }
      cb({ success: true });
    } catch(e) { cb({ success: false }); }
  });

  // ── РОЛИ В ГРУППАХ ──
  socket.on('group_set_role', async ({ groupId, username, role }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false, error: 'Не найдена' });
      if (group.owner !== me && !group.admins.includes(me)) return cb({ success: false, error: 'Нет прав' });
      if (role === 'admin') {
        if (!group.admins.includes(username)) group.admins.push(username);
        group.moderators = (group.moderators||[]).filter(m => m !== username);
      } else if (role === 'moderator') {
        if (!group.moderators) group.moderators = [];
        if (!group.moderators.includes(username)) group.moderators.push(username);
        group.admins = group.admins.filter(m => m !== username);
      } else { // member
        group.admins = group.admins.filter(m => m !== username);
        group.moderators = (group.moderators||[]).filter(m => m !== username);
      }
      await group.save();
      for (const m of group.members) { const s = userSockets.get(m); if (s) io.to(s).emit('group_updated', group); }
      cb({ success: true, group });
    } catch(e) { cb({ success: false, error: e.message }); }
  });

  // ── МЕДЛЕННЫЙ РЕЖИМ ──
  socket.on('group_set_slow_mode', async ({ groupId, seconds }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const group = await Group.findById(groupId);
      if (!group) return cb({ success: false });
      if (group.owner !== me && !group.admins.includes(me)) return cb({ success: false, error: 'Нет прав' });
      group.slowMode = Math.max(0, parseInt(seconds) || 0);
      await group.save();
      for (const m of group.members) { const s = userSockets.get(m); if (s) io.to(s).emit('group_updated', group); }
      cb({ success: true });
    } catch(e) { cb({ success: false }); }
  });

  // ── РОЛИ В КАНАЛАХ ──
  socket.on('channel_set_role', async ({ channelId, username, role }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      const ch = await Channel.findById(channelId);
      if (!ch || ch.owner !== me) return cb({ success: false, error: 'Нет прав' });
      if (role === 'admin') {
        if (!ch.admins.includes(username)) ch.admins.push(username);
        ch.editors = (ch.editors||[]).filter(e => e !== username);
      } else if (role === 'editor') {
        if (!ch.editors) ch.editors = [];
        if (!ch.editors.includes(username)) ch.editors.push(username);
        ch.admins = ch.admins.filter(a => a !== username);
      } else {
        ch.admins = ch.admins.filter(a => a !== username);
        ch.editors = (ch.editors||[]).filter(e => e !== username);
      }
      await ch.save();
      for (const s of ch.subscribers) { const sid = userSockets.get(s); if (sid) io.to(sid).emit('channel_updated', ch); }
      cb({ success: true, channel: ch });
    } catch(e) { cb({ success: false }); }
  });

  // ── ПОИСК ПО СООБЩЕНИЯМ (улучшенный) ──
  socket.on('search_in_chat', async ({ chatKey, query }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    if (!query || query.length < 2) return cb({ success: true, results: [] });
    try {
      let filter = { text: { $regex: query, $options: 'i' } };
      if (chatKey.startsWith('group_')) {
        filter.groupId = chatKey.replace('group_', ''); filter.chatType = 'group';
      } else if (chatKey.startsWith('channel_')) {
        filter.chatId = chatKey; filter.chatType = 'channel';
      } else {
        filter.chatType = 'direct'; filter.chatId = [me, chatKey].sort().join('_');
      }
      const results = await Message.find(filter).sort({ timestamp: -1 }).limit(50);
      cb({ success: true, results });
    } catch(e) { cb({ success: false, results: [] }); }
  });

  // ── AI ПЕРЕВОД ──
  socket.on('translate_message', async ({ text, targetLang }, cb) => {
    requireAuth(cb);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return cb({ success: false, error: 'AI не настроен' });
    try {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile', max_tokens: 512,
        messages: [
          { role: 'system', content: `Translate the following text to ${targetLang||'Russian'}. Reply with ONLY the translated text, no explanation.` },
          { role: 'user', content: text }
        ]
      });
      const https_m = require('https');
      const resp = await new Promise((resolve, reject) => {
        const req = https_m.request({ hostname:'api.groq.com', path:'/openai/v1/chat/completions', method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`,'Content-Length':Buffer.byteLength(body)}
        }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); });
        req.on('error',reject); req.write(body); req.end();
      });
      cb({ success: true, translation: resp.choices?.[0]?.message?.content || '' });
    } catch(e) { cb({ success: false, error: e.message }); }
  });

  // ── ГАЛЕРЕЯ ЧАТА ──
  socket.on('get_chat_media', async ({ chatKey }, cb) => {
    const me = requireAuth(cb); if (!me) return;
    try {
      let filter = { type: { $in: ['image','video','file','gif'] } };
      if (chatKey.startsWith('group_')) { filter.groupId = chatKey.replace('group_',''); filter.chatType='group'; }
      else if (chatKey.startsWith('channel_')) { filter.chatId=chatKey; filter.chatType='channel'; }
      else { filter.chatType='direct'; filter.chatId=[me,chatKey].sort().join('_'); }
      const media = await Message.find(filter).sort({ timestamp: -1 }).limit(200);
      cb({ success: true, media });
    } catch(e) { cb({ success: false, media: [] }); }
  });

  socket.on('disconnect', () => {
    const username = onlineUsers.get(socket.id);
    if (username) {
      onlineUsers.delete(socket.id);
      userSockets.delete(username);
      User.updateOne({ username }, { lastSeen: new Date() }).catch(()=>{});
      io.emit('user_status_change', { username, isOnline: false, lastSeen: new Date() });
      console.log(`🔴 ${username} отключился`);
    }
    rateLimitMap.delete(socket.id);
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
// Link preview proxy endpoint
const https_mod = require('https');
const http_mod  = require('http');
app.get('/api/link-preview', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ error: 'no url' });
  try {
    const mod = url.startsWith('https') ? https_mod : http_mod;
    const data = await new Promise((resolve, reject) => {
      const reqH = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhisprBot/1.0)' }, timeout: 5000 }, r => {
        let body = '';
        r.setEncoding('utf8');
        r.on('data', d => { if (body.length < 80000) body += d; });
        r.on('end', () => resolve(body));
      });
      reqH.on('error', reject);
      reqH.on('timeout', () => { reqH.destroy(); reject(new Error('timeout')); });
    });
    const title = (data.match(/<title[^>]*>([^<]{1,100})<\/title>/i)||[])[1]?.trim();
    const desc  = (data.match(/<meta[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']{1,200})["']/i)||
                   data.match(/<meta[^>]*content=["']([^"']{1,200})["'][^>]*(?:name|property)=["'](?:description|og:description)["']/i)||[])[1]?.trim();
    const image = (data.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)||
                   data.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)||[])[1];
    if (!title) return res.json({ error: 'no title' });
    res.json({ url, title, desc: desc||'', image: image||null });
  } catch(e) { res.json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  AI CHAT ENDPOINT (Groq — бесплатно, без карты)
//  Добавь GROQ_API_KEY в переменные окружения Render
//  Получить ключ: console.groq.com → API Keys → Create API Key
// ══════════════════════════════════════════
app.post('/api/ai-chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.json({ error: 'invalid messages' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.json({ error: 'AI не настроен. Добавьте GROQ_API_KEY в переменные окружения Render (получить бесплатно на console.groq.com).' });
  try {
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: 'Ты Whispr AI — умный помощник внутри мессенджера Whispr. Отвечай кратко, дружелюбно, на русском языке если пользователь пишет на русском.' },
        ...messages.slice(-20) // последние 20 сообщений для контекста
      ]
    });
    const resp = await new Promise((resolve, reject) => {
      const req2 = https_mod.request({
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, r => {
        let data = '';
        r.on('data', d => data += d);
        r.on('end', () => {
          try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
        });
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });
    if (resp.choices?.[0]?.message?.content) {
      res.json({ reply: resp.choices[0].message.content });
    } else {
      res.json({ error: resp.error?.message || 'Нет ответа от AI' });
    }
  } catch(e) { res.json({ error: 'Ошибка AI: ' + e.message }); }
});

// ══════════════════════════════════════════
//  FILE UPLOAD ENDPOINT — persistent in MongoDB
// ══════════════════════════════════════════
const fileSchema = new mongoose.Schema({
  token:    { type: String, required: true, unique: true, index: true },
  base64:   { type: String, required: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  fileName: { type: String, default: 'file' },
  expires:  { type: Date, required: true, index: { expireAfterSeconds: 0 } } // TTL index — MongoDB auto-deletes
});
const FileStore = mongoose.model('FileStore', fileSchema);

app.post('/api/upload', async (req, res) => {
  try {
    const { data, fileName, mimeType } = req.body;
    if (!data) return res.json({ error: 'no data' });
    const base64 = data.includes(',') ? data.split(',')[1] : data;
    // Check size — max 8MB base64 (~6MB original)
    if (base64.length > 8 * 1024 * 1024) return res.json({ error: 'Файл слишком большой (макс. 6 МБ)' });
    const token = require('crypto').randomBytes(16).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
    await FileStore.create({ token, base64, mimeType: mimeType || 'application/octet-stream', fileName: fileName || 'file', expires });
    res.json({ url: `${process.env.SERVER_URL || 'https://whispr-server-u5zy.onrender.com'}/api/file/${token}` });
  } catch(e) { res.json({ error: e.message }); }
});

app.get('/api/file/:token', async (req, res) => {
  try {
    const entry = await FileStore.findOne({ token: req.params.token });
    if (!entry) return res.status(404).send('Not found or expired');
    const buf = Buffer.from(entry.base64, 'base64');
    res.set('Content-Type', entry.mimeType);
    res.set('Content-Disposition', `inline; filename="${entry.fileName}"`);
    res.set('Cache-Control', 'public, max-age=604800');
    res.send(buf);
  } catch(e) { res.status(500).send('Error'); }
});

server.listen(PORT, () => console.log(`🚀 Whispr Server v3 on port ${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));

// ══════════════════════════════════════════
// ПАТЧ v4: редактирование, удаление, пересылка, звонки
// ══════════════════════════════════════════
