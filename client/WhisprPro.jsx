import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  Send, Users, Search, UserPlus, LogOut, 
  Circle, Sparkles, Shield, Trash2, Crown, X,
  Menu, Mic, MicOff, Play, Pause, Ban, History,
  Plus, UserCheck, Hash, ChevronDown, Settings, ArrowLeft
} from 'lucide-react';

const SERVER_URL = 'https://whispr-server-u5zy.onrender.com';
const EMOJI_LIST = ['❤️','😂','😮','😢','👍','🔥'];

// ── Компонент аватара ──
function Avatar({ username, displayName, avatar, size = 'md', online }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-xl' };
  const dotSizes = { sm: 'w-2.5 h-2.5 border', md: 'w-3 h-3 border-2', lg: 'w-4 h-4 border-2' };
  const colors = ['bg-violet-500','bg-pink-500','bg-teal-500','bg-orange-500','bg-blue-500','bg-green-500'];
  const color = colors[(username?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center font-bold text-white ${avatar ? '' : color}`}>
        {avatar
          ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
          : <span>{(displayName || username || '?')[0].toUpperCase()}</span>}
      </div>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full border-purple-900 ${online ? 'bg-green-400' : 'bg-gray-500'}`} />
      )}
    </div>
  );
}

// ── Группа-аватар (решётка из букв участников) ──
function GroupAvatar({ group, size = 'md' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-xl' };
  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center font-bold text-white bg-gradient-to-br from-violet-500 to-fuchsia-500 flex-shrink-0`}>
      {group.avatar
        ? <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
        : <Hash className="w-4 h-4" />}
    </div>
  );
}

export default function WhisprPro() {
  const [socket, setSocket] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');

  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);

  // activeChat: { type: 'direct'|'group', id: username|groupId, data: contactObj|groupObj }
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState({});       // chatKey -> []
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState({});

  const [avatars, setAvatars] = useState({});

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Группы — создание
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Группы — инфо/настройки
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [addMemberResults, setAddMemberResults] = useState([]);

  // Админ
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState('users');
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');

  // Голосовые
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Реакции
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const [playingAudio, setPlayingAudio] = useState(null);

  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const currentUserRef = useRef(null);

  const getChatKey = (chat) => chat ? (chat.type === 'group' ? `group_${chat.id}` : chat.id) : null;

  // ── Сокет — один раз ──
  useEffect(() => {
    const newSocket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    setSocket(newSocket);

    newSocket.on('new_message', (msg) => {
      const me = currentUserRef.current?.username;
      const key = msg.from === me ? msg.to : msg.from;
      setMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] }));
    });

    newSocket.on('new_group_message', (msg) => {
      const key = `group_${msg.groupId}`;
      setMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] }));
    });

    newSocket.on('group_created', (group) => {
      setGroups(prev => {
        if (prev.find(g => g._id === group._id)) return prev;
        return [...prev, group];
      });
    });

    newSocket.on('group_updated', (group) => {
      setGroups(prev => prev.map(g => g._id === group._id ? group : g));
    });

    newSocket.on('user_status_change', ({ username, isOnline }) => {
      setContacts(prev => prev.map(c => c.username === username ? { ...c, isOnline } : c));
    });

    newSocket.on('user_typing', ({ from }) => {
      setTypingUsers(prev => ({ ...prev, [from]: true }));
      if (typingTimeoutRef.current[from]) clearTimeout(typingTimeoutRef.current[from]);
      typingTimeoutRef.current[from] = setTimeout(() => {
        setTypingUsers(prev => { const s = { ...prev }; delete s[from]; return s; });
      }, 2000);
    });

    newSocket.on('group_user_typing', ({ from, groupId }) => {
      const key = `group_${groupId}`;
      setTypingUsers(prev => ({ ...prev, [key]: from }));
      if (typingTimeoutRef.current[key]) clearTimeout(typingTimeoutRef.current[key]);
      typingTimeoutRef.current[key] = setTimeout(() => {
        setTypingUsers(prev => { const s = { ...prev }; delete s[key]; return s; });
      }, 2000);
    });

    newSocket.on('messages_read', ({ by }) => {
      setMessages(prev => {
        if (!prev[by]) return prev;
        return { ...prev, [by]: prev[by].map(m => ({ ...m, read: true })) };
      });
    });

    newSocket.on('reaction_updated', ({ messageId, reactions }) => {
      setMessages(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].map(m =>
            (m._id === messageId || m.id === messageId) ? { ...m, reactions } : m
          );
        }
        return updated;
      });
    });

    newSocket.on('avatar_updated', ({ username, avatar }) => {
      setAvatars(prev => ({ ...prev, [username]: avatar }));
    });

    newSocket.on('force_disconnect', ({ reason }) => {
      alert(reason); handleLogout();
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Scroll — только при новых сообщениях, без прыжков
  const chatKey = getChatKey(activeChat);
  const chatMessages = chatKey ? (messages[chatKey] || []) : [];
  const prevMsgCount = useRef(0);
  useEffect(() => {
    const count = chatMessages.length;
    if (count > prevMsgCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCount.current = count;
  }, [chatMessages.length]);

  // ── AUTH ──
  const handleRegister = (e) => {
    e.preventDefault(); setAuthError('');
    socket.emit('register', { username, displayName, password }, (res) => {
      if (res.success) handleLogin(e); else setAuthError(res.error);
    });
  };

  const handleLogin = (e) => {
    e.preventDefault(); setAuthError('');
    socket.emit('login', { username, password }, (res) => {
      if (res.success) {
        setCurrentUser(res.user);
        setContacts(res.contacts || []);
        setGroups(res.groups || []);
        const initAvatars = {};
        (res.contacts || []).forEach(c => { if (c.avatar) initAvatars[c.username] = c.avatar; });
        if (res.user.avatar) initAvatars[res.user.username] = res.user.avatar;
        setAvatars(initAvatars);
        setIsAuthenticated(true);
      } else setAuthError(res.error);
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false); setCurrentUser(null); setContacts([]); setGroups([]);
    setActiveChat(null); setMessages({}); setUsername(''); setPassword(''); setDisplayName('');
  };

  // ── АВАТАР ──
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) { alert('Макс. 500KB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      socket.emit('update_avatar', reader.result, (res) => {
        if (res.success) {
          setAvatars(prev => ({ ...prev, [currentUser.username]: reader.result }));
          setCurrentUser(prev => ({ ...prev, avatar: reader.result }));
        }
      });
    };
    reader.readAsDataURL(file);
  };

  // ── ПОИСК ──
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    socket.emit('search_users', query, (res) => { if (res.success) setSearchResults(res.results); });
  };

  const handleAddContact = (targetUsername) => {
    socket.emit('add_contact', targetUsername, (res) => {
      if (res.success) {
        setContacts(prev => [...prev, res.contact]);
        if (res.contact.avatar) setAvatars(prev => ({ ...prev, [res.contact.username]: res.contact.avatar }));
        setSearchResults([]); setSearchQuery(''); setShowSearch(false);
      }
    });
  };

  const handleRemoveContact = (targetUsername) => {
    if (!confirm(`Удалить ${targetUsername}?`)) return;
    socket.emit('remove_contact', targetUsername, (res) => {
      if (res.success) {
        setContacts(prev => prev.filter(c => c.username !== targetUsername));
        if (activeChat?.id === targetUsername) setActiveChat(null);
      }
    });
  };

  // ── ОТКРЫТЬ ЧАТ ──
  const openDirectChat = (contact) => {
    const chat = { type: 'direct', id: contact.username, data: contact };
    setActiveChat(chat);
    setShowSearch(false);
    socket.emit('load_chat', contact.username, (res) => {
      if (res.success) setMessages(prev => ({ ...prev, [contact.username]: res.messages }));
    });
  };

  const openGroupChat = (group) => {
    const chat = { type: 'group', id: group._id, data: group };
    setActiveChat(chat);
    socket.emit('load_group_chat', group._id, (res) => {
      if (res.success) setMessages(prev => ({ ...prev, [`group_${group._id}`]: res.messages }));
    });
  };

  // ── ОТПРАВИТЬ ──
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChat) return;
    if (activeChat.type === 'direct') {
      socket.emit('send_message', { to: activeChat.id, text: inputMessage.trim(), type: 'text' }, () => {});
    } else {
      socket.emit('send_group_message', { groupId: activeChat.id, text: inputMessage.trim(), type: 'text' }, () => {});
    }
    setInputMessage('');
  };

  const handleTyping = () => {
    if (!activeChat) return;
    if (activeChat.type === 'direct') socket.emit('typing', activeChat.id);
    else socket.emit('group_typing', activeChat.id);
  };

  // ── ГРУППЫ ──
  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    socket.emit('create_group', { name: newGroupName, description: newGroupDesc, members: selectedMembers }, (res) => {
      if (res.success) {
        setShowCreateGroup(false);
        setNewGroupName(''); setNewGroupDesc(''); setSelectedMembers([]);
        openGroupChat(res.group);
      }
    });
  };

  const handleLeaveGroup = () => {
    if (!activeChat || activeChat.type !== 'group') return;
    if (!confirm('Покинуть группу?')) return;
    socket.emit('leave_group', activeChat.id, (res) => {
      if (res.success) {
        setGroups(prev => prev.filter(g => g._id !== activeChat.id));
        setActiveChat(null);
        setShowGroupInfo(false);
      }
    });
  };

  const searchAddMember = (q) => {
    setAddMemberQuery(q);
    if (q.length < 2) { setAddMemberResults([]); return; }
    socket.emit('search_users', q, (res) => { if (res.success) setAddMemberResults(res.results); });
  };

  const handleAddMember = (uname) => {
    socket.emit('group_add_member', { groupId: activeChat.id, username: uname }, (res) => {
      if (res.success) {
        setGroups(prev => prev.map(g => g._id === activeChat.id ? res.group : g));
        setActiveChat(prev => prev ? { ...prev, data: res.group } : prev);
        setAddMemberQuery(''); setAddMemberResults([]);
      } else alert(res.error);
    });
  };

  // ── ГОЛОСОВЫЕ ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (activeChat.type === 'direct')
            socket.emit('send_message', { to: activeChat.id, text: '', type: 'voice', audioData: reader.result }, () => {});
          else
            socket.emit('send_group_message', { groupId: activeChat.id, text: '', type: 'voice', audioData: reader.result }, () => {});
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setIsRecording(true); setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { alert('Нет доступа к микрофону'); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setIsRecording(false); setRecordingTime(0);
  };

  const toggleAudio = (msgId, audioData) => {
    if (playingAudio === msgId) { setPlayingAudio(null); return; }
    setPlayingAudio(msgId);
    const audio = new Audio(audioData);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
  };

  // ── РЕАКЦИИ ──
  const handleReaction = (messageId, emoji) => {
    socket.emit('add_reaction', { messageId, emoji }, () => {});
    setHoveredMsg(null);
  };

  // ── АДМИН ──
  const loadAdminData = (search = '') => {
    socket.emit('admin_get_stats', (res) => { if (res.success) setAdminStats(res.stats); });
    socket.emit('admin_get_users', { search }, (res) => { if (res.success) setAllUsers(res.users); });
    socket.emit('admin_get_logs', (res) => { if (res.success) setAdminLogs(res.logs); });
  };

  const formatTime = (ts) => {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };
  const formatDur = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  // ══════════════════════════════════════════
  //  AUTH SCREEN
  // ══════════════════════════════════════════
  if (!isAuthenticated) return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>
      <div className="relative backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-3xl"></div>
        <div className="relative text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-white/20 border border-white/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">Whispr</h1>
          <p className="text-white/80 text-sm">Мессенджер нового поколения</p>
        </div>
        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="relative space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none transition-all"
              placeholder="username" required />
          </div>
          {isRegistering && (
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">Имя</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none transition-all"
                placeholder="Ваше имя" required />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none transition-all"
              placeholder="••••••••" required />
          </div>
          {authError && <div className="text-red-300 text-sm bg-red-500/20 px-3 py-2 rounded-lg">{authError}</div>}
          <button type="submit" className="w-full bg-white/20 border border-white/30 text-white py-3 rounded-xl font-medium hover:bg-white/30 transition-all">
            {isRegistering ? 'Зарегистрироваться' : 'Войти'}
          </button>
          <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
            className="w-full text-white/70 text-sm hover:text-white transition-colors">
            {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
          </button>
        </form>
      </div>
      <style>{STYLES}</style>
    </div>
  );

  // ══════════════════════════════════════════
  //  MAIN APP
  // ══════════════════════════════════════════
  const activeChatData = activeChat?.data;
  const typingKey = activeChat?.type === 'group' ? `group_${activeChat.id}` : activeChat?.id;

  return (
    <div style={{ height: '100dvh', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* ── SIDEBAR ── */}
      <div className={`relative flex-shrink-0 w-80 backdrop-blur-2xl bg-white/10 border-r border-white/20 flex flex-col transition-all duration-300 ${showSidebar ? 'ml-0' : '-ml-80'}`}>
        {/* Profile header */}
        <div className="p-4 border-b border-white/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer relative group">
                <Avatar username={currentUser?.username} displayName={currentUser?.displayName}
                  avatar={avatars[currentUser?.username]} size="sm" />
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs">✎</div>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
              <div>
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-white/70" />
                  <span className="text-white font-bold">Whispr</span>
                </div>
                <p className="text-xs text-white/60">@{currentUser?.username}</p>
              </div>
            </div>
            <div className="flex gap-1">
              {currentUser?.isAdmin && (
                <button onClick={() => { setShowAdminPanel(true); loadAdminData(); }}
                  className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                  <Shield className="w-4 h-4 text-white" />
                </button>
              )}
              <button onClick={handleLogout} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                <LogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Search + New group */}
        <div className="px-4 pt-3 pb-2 flex gap-2">
          <button onClick={() => setShowSearch(true)}
            className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-white flex items-center gap-2 hover:bg-white/30 transition-colors text-sm">
            <Search className="w-4 h-4" /><span>Найти</span>
          </button>
          <button onClick={() => setShowCreateGroup(true)}
            className="px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-white hover:bg-white/30 transition-colors" title="Новая группа">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Contacts + Groups list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {/* Contacts */}
          {contacts.length > 0 && (
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider pt-2 pb-1 px-1">Контакты</div>
          )}
          {contacts.map(contact => (
            <div key={contact.username} onClick={() => openDirectChat(contact)}
              className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all group flex items-center gap-3 ${
                activeChat?.type === 'direct' && activeChat.id === contact.username
                  ? 'bg-white/30 border border-white/40' : 'bg-white/10 border border-white/10 hover:bg-white/20'
              }`}>
              <Avatar username={contact.username} displayName={contact.displayName}
                avatar={avatars[contact.username]} size="sm" online={contact.isOnline} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{contact.displayName}</div>
                <div className="text-xs text-white/50 truncate">@{contact.username}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); handleRemoveContact(contact.username); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded transition-all flex-shrink-0">
                <X className="w-3 h-3 text-white/60" />
              </button>
            </div>
          ))}

          {/* Groups */}
          {groups.length > 0 && (
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider pt-3 pb-1 px-1">Группы</div>
          )}
          {groups.map(group => (
            <div key={group._id} onClick={() => openGroupChat(group)}
              className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 ${
                activeChat?.type === 'group' && activeChat.id === group._id
                  ? 'bg-white/30 border border-white/40' : 'bg-white/10 border border-white/10 hover:bg-white/20'
              }`}>
              <GroupAvatar group={group} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{group.name}</div>
                <div className="text-xs text-white/50">{group.members.length} участников</div>
              </div>
            </div>
          ))}

          {contacts.length === 0 && groups.length === 0 && (
            <div className="text-center py-10 text-white/50 text-sm">
              Нет контактов.<br/>Нажми «Найти» чтобы добавить!
            </div>
          )}
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
        {activeChat ? (
          <>
            {/* Chat header */}
            <div className="flex-shrink-0 px-4 py-3 backdrop-blur-2xl bg-white/10 border-b border-white/20 flex items-center gap-3">
              <button onClick={() => setShowSidebar(s => !s)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 flex-shrink-0">
                <Menu className="w-5 h-5 text-white" />
              </button>
              {activeChat.type === 'direct'
                ? <Avatar username={activeChatData?.username} displayName={activeChatData?.displayName}
                    avatar={avatars[activeChatData?.username]} size="md" online={activeChatData?.isOnline} />
                : <GroupAvatar group={activeChatData} size="md" />
              }
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">
                  {activeChat.type === 'direct' ? activeChatData?.displayName : activeChatData?.name}
                </div>
                <div className="text-xs text-white/60">
                  {activeChat.type === 'direct'
                    ? (activeChatData?.isOnline ? <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-green-400 text-green-400" />онлайн</span> : 'не в сети')
                    : `${activeChatData?.members?.length || 0} участников`
                  }
                </div>
              </div>
              {activeChat.type === 'group' && (
                <button onClick={() => setShowGroupInfo(true)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 flex-shrink-0">
                  <Settings className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {chatMessages.map((msg) => {
                const isOwn = msg.from === currentUser?.username;
                const msgId = msg._id || msg.id;
                const reactions = msg.reactions || {};
                const hasReactions = Object.keys(reactions).some(e => reactions[e]?.length > 0);
                const senderContact = contacts.find(c => c.username === msg.from);

                return (
                  <div key={msgId} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} group`}
                    onMouseEnter={() => { clearTimeout(hoverTimeoutRef.current); setHoveredMsg(msgId); }}
                    onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setHoveredMsg(null), 300); }}>

                    {/* Avatar for others in group */}
                    {!isOwn && activeChat.type === 'group' && (
                      <Avatar username={msg.from} displayName={msg.from}
                        avatar={avatars[msg.from]} size="sm" />
                    )}

                    <div className="relative max-w-xs md:max-w-md">
                      {/* Sender name in group */}
                      {!isOwn && activeChat.type === 'group' && (
                        <div className="text-xs text-white/60 mb-1 ml-1">{senderContact?.displayName || msg.from}</div>
                      )}

                      {/* Reaction picker */}
                      {hoveredMsg === msgId && (
                        <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-10 flex gap-1 bg-black/70 backdrop-blur-xl rounded-2xl px-2 py-1 z-10 shadow-xl`}
                          onMouseEnter={() => { clearTimeout(hoverTimeoutRef.current); setHoveredMsg(msgId); }}
                          onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setHoveredMsg(null), 300); }}>
                          {EMOJI_LIST.map(emoji => (
                            <button key={emoji} onClick={() => handleReaction(msgId, emoji)}
                              className="text-lg hover:scale-125 transition-transform">{emoji}</button>
                          ))}
                        </div>
                      )}

                      {/* Bubble */}
                      <div className={`rounded-2xl px-4 py-2.5 backdrop-blur-xl ${
                        isOwn ? 'bg-white/25 border border-white/30 rounded-br-sm' : 'bg-white/15 border border-white/20 rounded-bl-sm'
                      } text-white shadow-md`}>
                        {msg.type === 'voice' ? (
                          <div className="flex items-center gap-3 min-w-36">
                            <button onClick={() => toggleAudio(msgId, msg.audioData)}
                              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors flex-shrink-0">
                              {playingAudio === msgId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <div className="flex-1 h-1 bg-white/30 rounded-full"><div className="h-full w-1/2 bg-white/70 rounded-full"></div></div>
                            <Mic className="w-3 h-3 text-white/50 flex-shrink-0" />
                          </div>
                        ) : (
                          <div className="text-sm leading-relaxed break-words">{msg.text}</div>
                        )}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-xs text-white/50">{formatTime(msg.timestamp)}</span>
                          {isOwn && activeChat.type === 'direct' && (
                            <span className="text-xs">
                              {msg.read ? <span className="text-blue-300">✓✓</span>
                               : msg.delivered ? <span className="text-white/50">✓✓</span>
                               : <span className="text-white/30">✓</span>}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reactions */}
                      {hasReactions && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          {Object.entries(reactions).filter(([,u]) => u?.length > 0).map(([emoji, users]) => (
                            <button key={emoji} onClick={() => handleReaction(msgId, emoji)}
                              className="flex items-center gap-1 bg-white/20 border border-white/30 rounded-full px-2 py-0.5 text-sm hover:bg-white/30 transition-colors">
                              {emoji}<span className="text-xs text-white/80">{users.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              {typingUsers[typingKey] && (
                <div className="text-sm text-white/70 italic bg-white/10 inline-block px-3 py-1 rounded-full self-start">
                  {activeChat.type === 'group' ? `${typingUsers[typingKey]} печатает...` : 'печатает...'}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 backdrop-blur-2xl bg-white/10 border-t border-white/20">
              {isRecording ? (
                <div className="flex items-center gap-3 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3">
                  <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse flex-shrink-0"></div>
                  <span className="text-white flex-1">Запись... {formatDur(recordingTime)}</span>
                  <button onClick={stopRecording} className="bg-red-500/40 hover:bg-red-500/60 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 flex-shrink-0">
                    <MicOff className="w-4 h-4" />Отправить
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input type="text" value={inputMessage} onChange={e => { setInputMessage(e.target.value); handleTyping(); }}
                    className="flex-1 px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none transition-all min-w-0"
                    placeholder="Напишите сообщение..." />
                  <button type="button" onClick={startRecording}
                    className="bg-white/20 border border-white/30 text-white px-3 py-3 rounded-xl hover:bg-white/30 transition-all flex-shrink-0">
                    <Mic className="w-5 h-5" />
                  </button>
                  <button type="submit"
                    className="bg-white/20 border border-white/30 text-white px-5 py-3 rounded-xl hover:bg-white/30 transition-all flex items-center gap-2 flex-shrink-0">
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/50">
              <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="text-lg">Выберите чат</p>
              <p className="text-sm mt-1">или создайте группу</p>
            </div>
          </div>
        )}
      </div>

      {/* ══ MODALS ══ */}

      {/* Search */}
      {showSearch && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSearch(false)}>
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Поиск</h3>
              <button onClick={() => setShowSearch(false)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30"><X className="w-5 h-5 text-white" /></button>
            </div>
            <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)} autoFocus
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none mb-4"
              placeholder="Username или имя..." />
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map(u => (
                <div key={u.username} className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl flex items-center gap-3">
                  <Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm" online={u.isOnline} />
                  <div className="flex-1">
                    <div className="text-white font-medium">{u.displayName}</div>
                    <div className="text-xs text-white/60">@{u.username}</div>
                  </div>
                  <button onClick={() => handleAddContact(u.username)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm flex items-center gap-1">
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && <p className="text-center py-6 text-white/60">Ничего не найдено</p>}
              {searchQuery.length < 2 && <p className="text-center py-6 text-white/60">Введите минимум 2 символа</p>}
            </div>
          </div>
        </div>
      )}

      {/* Create Group */}
      {showCreateGroup && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Hash className="w-5 h-5" />Новая группа</h3>
              <button onClick={() => setShowCreateGroup(false)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30"><X className="w-5 h-5 text-white" /></button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none"
                placeholder="Название группы" required />
              <input type="text" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)}
                className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none"
                placeholder="Описание (необязательно)" />
              <div>
                <p className="text-sm text-white/70 mb-2">Добавить участников из контактов:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {contacts.map(c => (
                    <label key={c.username} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/10 cursor-pointer hover:bg-white/20 transition-colors">
                      <input type="checkbox" checked={selectedMembers.includes(c.username)}
                        onChange={e => setSelectedMembers(prev => e.target.checked ? [...prev, c.username] : prev.filter(u => u !== c.username))}
                        className="rounded" />
                      <Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm" />
                      <span className="text-white text-sm">{c.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-white/20 border border-white/30 text-white py-3 rounded-xl hover:bg-white/30 transition-all font-medium">
                Создать группу
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Group Info */}
      {showGroupInfo && activeChat?.type === 'group' && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowGroupInfo(false)}>
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-md m-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{activeChatData?.name}</h3>
              <button onClick={() => setShowGroupInfo(false)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30"><X className="w-5 h-5 text-white" /></button>
            </div>
            {activeChatData?.description && <p className="text-white/70 text-sm mb-4">{activeChatData.description}</p>}

            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Участники ({activeChatData?.members?.length})</p>
            <div className="space-y-2 mb-4">
              {activeChatData?.members?.map(member => {
                const c = contacts.find(x => x.username === member) || { username: member, displayName: member };
                return (
                  <div key={member} className="flex items-center gap-3 px-3 py-2 bg-white/10 rounded-xl">
                    <Avatar username={member} displayName={c.displayName} avatar={avatars[member]} size="sm" />
                    <div className="flex-1">
                      <div className="text-white text-sm">{c.displayName || member}</div>
                      <div className="text-xs text-white/50">@{member}</div>
                    </div>
                    {activeChatData?.admins?.includes(member) && <Crown className="w-4 h-4 text-yellow-400" />}
                  </div>
                );
              })}
            </div>

            {activeChatData?.admins?.includes(currentUser?.username) && (
              <div className="mb-4">
                <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Добавить участника</p>
                <input type="text" value={addMemberQuery} onChange={e => searchAddMember(e.target.value)}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none mb-2"
                  placeholder="Поиск пользователей..." />
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {addMemberResults.filter(u => !activeChatData.members.includes(u.username)).map(u => (
                    <div key={u.username} className="flex items-center gap-3 px-3 py-2 bg-white/10 rounded-xl">
                      <Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm" />
                      <span className="text-white text-sm flex-1">{u.displayName}</span>
                      <button onClick={() => handleAddMember(u.username)}
                        className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />Добавить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleLeaveGroup}
              className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-300 font-medium transition-colors">
              Покинуть группу
            </button>
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {showAdminPanel && currentUser?.isAdmin && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdminPanel(false)}>
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2"><Shield className="w-6 h-6" />Админ Панель</h3>
              <button onClick={() => setShowAdminPanel(false)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30"><X className="w-5 h-5 text-white" /></button>
            </div>
            {adminStats && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
                {[
                  { label: 'Всего', val: adminStats.totalUsers },
                  { label: 'Онлайн', val: adminStats.onlineUsers },
                  { label: 'Сообщ.', val: adminStats.totalMessages },
                  { label: 'Чатов', val: adminStats.totalChats },
                  { label: 'Заблок.', val: adminStats.blockedUsers },
                  { label: 'Групп', val: adminStats.totalGroups },
                ].map(s => (
                  <div key={s.label} className="p-3 bg-white/10 border border-white/20 rounded-xl text-center">
                    <div className="text-white/60 text-xs">{s.label}</div>
                    <div className="text-xl font-bold text-white">{s.val}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mb-4">
              {['users','logs'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${adminTab === tab ? 'bg-white/30 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                  {tab === 'users' ? <><Users className="w-4 h-4" />Пользователи</> : <><History className="w-4 h-4" />История</>}
                </button>
              ))}
            </div>
            {adminTab === 'users' && (
              <>
                <input type="text" value={adminSearch} onChange={e => { setAdminSearch(e.target.value); loadAdminData(e.target.value); }}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none mb-3"
                  placeholder="🔍 Поиск..." />
                <div className="space-y-2">
                  {allUsers.map(user => (
                    <div key={user.username} className={`px-4 py-3 border rounded-xl flex items-center justify-between ${user.isBlocked ? 'bg-red-500/10 border-red-500/20' : 'bg-white/10 border-white/20'}`}>
                      <div className="flex items-center gap-3">
                        <Circle className={`w-2 h-2 flex-shrink-0 ${user.isOnline ? 'fill-green-400 text-green-400' : 'fill-gray-500 text-gray-500'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{user.displayName}</span>
                            {user.isAdmin && <Crown className="w-4 h-4 text-yellow-400" />}
                            {user.isBlocked && <Ban className="w-4 h-4 text-red-400" />}
                          </div>
                          <div className="text-xs text-white/50">@{user.username} • {user.contactsCount} конт. • {new Date(user.createdAt).toLocaleDateString('ru-RU')}</div>
                        </div>
                      </div>
                      {!user.isAdmin && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => { socket.emit('admin_block_user', { target: user.username, block: !user.isBlocked }, res => { if (res.success) loadAdminData(adminSearch); }); }}
                            className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border transition-colors ${user.isBlocked ? 'bg-green-500/20 border-green-500/30 text-green-200 hover:bg-green-500/30' : 'bg-orange-500/20 border-orange-500/30 text-orange-200 hover:bg-orange-500/30'}`}>
                            <Ban className="w-3 h-3" />{user.isBlocked ? 'Разблок.' : 'Блок.'}
                          </button>
                          <button onClick={() => { if (confirm(`Промоут ${user.username}?`)) socket.emit('admin_promote_user', user.username, res => { if (res.success) loadAdminData(adminSearch); }); }}
                            className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-200 text-xs hover:bg-yellow-500/30 transition-colors">
                            <Crown className="w-3 h-3" />
                          </button>
                          <button onClick={() => { if (confirm(`Удалить ${user.username}?`)) socket.emit('admin_delete_user', user.username, res => { if (res.success) loadAdminData(adminSearch); }); }}
                            className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-xs hover:bg-red-500/30 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {adminTab === 'logs' && (
              <div className="space-y-2">
                {adminLogs.length === 0 && <p className="text-center py-8 text-white/50">Нет действий</p>}
                {adminLogs.map((log, i) => (
                  <div key={i} className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-white/90 text-sm">{log.details}</div>
                      <div className="text-xs text-white/40 mt-0.5">@{log.admin}</div>
                    </div>
                    <div className="text-xs text-white/40 flex-shrink-0 ml-4">{formatTime(log.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{STYLES}</style>

      <div style={{ position:'fixed', bottom:10, left:'50%', transform:'translateX(-50%)', color:'rgba(255,255,255,0.25)', fontSize:'11px', zIndex:100, pointerEvents:'none', whiteSpace:'nowrap' }}>
        by Meowlentii
      </div>
    </div>
  );
}

const STYLES = `
  @keyframes blob {
    0%   { transform: translate(0,0) scale(1); }
    33%  { transform: translate(30px,-50px) scale(1.1); }
    66%  { transform: translate(-20px,20px) scale(0.9); }
    100% { transform: translate(0,0) scale(1); }
  }
  .animate-blob { animation: blob 7s infinite; }
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }
`;
