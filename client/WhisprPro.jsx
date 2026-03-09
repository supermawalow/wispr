import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Send, Users, Search, UserPlus, LogOut,
  Circle, Sparkles, Shield, Trash2, Crown, X,
  Menu, Mic, MicOff, Play, Pause, Ban, History,
  Plus, UserCheck, Hash, Settings, Phone, PhoneOff,
  Check, MoreVertical, Forward, Pencil
} from 'lucide-react';

const SERVER_URL = 'https://whispr-server-u5zy.onrender.com';
const EMOJI_LIST = ['❤️','😂','😮','😢','👍','🔥'];

function Avatar({ username, displayName, avatar, size = 'md', online }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-xl' };
  const dotSizes = { sm: 'w-2.5 h-2.5 border', md: 'w-3 h-3 border-2', lg: 'w-4 h-4 border-2' };
  const colors = ['bg-violet-500','bg-pink-500','bg-teal-500','bg-orange-500','bg-blue-500','bg-green-500'];
  const color = colors[(username?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center font-bold text-white ${avatar ? '' : color}`}>
        {avatar ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                : <span>{(displayName || username || '?')[0].toUpperCase()}</span>}
      </div>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full border-purple-900 ${online ? 'bg-green-400' : 'bg-gray-500'}`} />
      )}
    </div>
  );
}

function GroupAvatar({ group, size = 'md' }) {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' };
  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center text-white bg-gradient-to-br from-violet-500 to-fuchsia-500 flex-shrink-0`}>
      {group?.avatar ? <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" /> : <Hash className="w-4 h-4" />}
    </div>
  );
}

function IncomingCallOverlay({ from, fromDisplay, fromAvatar, onAccept, onReject }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200]">
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 text-center w-80 shadow-2xl">
        <div className="mb-4 flex justify-center"><Avatar username={from} displayName={fromDisplay} avatar={fromAvatar} size="lg" /></div>
        <p className="text-white/70 text-sm mb-1">Входящий звонок</p>
        <p className="text-white text-xl font-bold mb-6">{fromDisplay || from}</p>
        <div className="flex justify-center gap-8">
          <button onClick={onReject} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg"><PhoneOff className="w-7 h-7 text-white" /></button>
          <button onClick={onAccept} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg animate-pulse"><Phone className="w-7 h-7 text-white" /></button>
        </div>
      </div>
    </div>
  );
}

function ActiveCallOverlay({ peer, peerDisplay, peerAvatar, duration, muted, onMute, onEnd, calling, audioRef, remoteStream }) {
  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const localAudioRef = useRef(null);
  const resolvedRef = audioRef || localAudioRef;
  useEffect(() => {
    if (resolvedRef.current && remoteStream) {
      resolvedRef.current.srcObject = remoteStream;
      resolvedRef.current.play().catch(() => {});
    }
  }, [remoteStream]);
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200]">
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 text-center w-80 shadow-2xl">
        <div className="mb-4 flex justify-center"><Avatar username={peer} displayName={peerDisplay} avatar={peerAvatar} size="lg" /></div>
        <p className="text-white text-xl font-bold mb-1">{peerDisplay || peer}</p>
        {calling ? <p className="text-white/60 text-sm mb-6 animate-pulse">Вызов...</p> : <p className="text-green-400 text-sm mb-6 font-mono">{fmt(duration)}</p>}
        <div className="flex justify-center gap-6">
          {!calling && <button onClick={onMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-yellow-500' : 'bg-white/20 hover:bg-white/30'}`}>{muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}</button>}
          <button onClick={onEnd} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg"><PhoneOff className="w-7 h-7 text-white" /></button>
        </div>
      </div>
      <audio ref={resolvedRef} id="remoteAudio" autoPlay playsInline />
    </div>
  );
}

export default function WhisprPro() {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [avatars, setAvatars] = useState({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [addMemberResults, setAddMemberResults] = useState([]);
  const [msgMenu, setMsgMenu] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editText, setEditText] = useState('');
  const [forwardMsg, setForwardMsg] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const hoverTimeoutRef = useRef(null);
  const [callState, setCallState] = useState('idle');
  const [callPeer, setCallPeer] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callMuted, setCallMuted] = useState(false);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const callPeerRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState('users');
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const currentUserRef = useRef(null);

  const getChatKey = (chat) => chat ? (chat.type === 'group' ? `group_${chat.id}` : chat.id) : null;
  const ICE = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ] };

  const cleanupCall = useCallback(() => {
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    clearInterval(callTimerRef.current);
    setCallState('idle'); setCallPeer(null); setCallDuration(0); setCallMuted(false);
    callPeerRef.current = null; incomingOfferRef.current = null;
    remoteStreamRef.current = null;
    const a = remoteAudioRef.current || document.getElementById('remoteAudio'); if (a) a.srcObject = null;
  }, []);

  const startCall = useCallback(async (toUsername) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(ICE);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => { remoteStreamRef.current = e.streams[0]; const a = remoteAudioRef.current || document.getElementById('remoteAudio'); if (a) a.srcObject = e.streams[0]; };
      pc.onicecandidate = e => { if (e.candidate) socketRef.current?.emit('ice_candidate', { to: toUsername, candidate: e.candidate }); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('call_offer', { to: toUsername, offer });
      setCallPeer(toUsername); callPeerRef.current = toUsername; setCallState('calling');
    } catch { alert('Нет доступа к микрофону'); cleanupCall(); }
  }, [cleanupCall]);

  const acceptCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(ICE);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => { remoteStreamRef.current = e.streams[0]; const a = remoteAudioRef.current || document.getElementById('remoteAudio'); if (a) a.srcObject = e.streams[0]; };
      pc.onicecandidate = e => { if (e.candidate) socketRef.current?.emit('ice_candidate', { to: callPeerRef.current, candidate: e.candidate }); };
      await pc.setRemoteDescription(incomingOfferRef.current);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('call_answer', { to: callPeerRef.current, answer });
      setCallState('active');
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } catch { alert('Нет доступа к микрофону'); cleanupCall(); }
  }, [cleanupCall]);

  const rejectCall = useCallback(() => { socketRef.current?.emit('call_reject', { to: callPeerRef.current }); cleanupCall(); }, [cleanupCall]);
  const endCall = useCallback(() => { socketRef.current?.emit('call_end', { to: callPeerRef.current }); cleanupCall(); }, [cleanupCall]);
  const toggleMute = useCallback(() => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; }); setCallMuted(m => !m); }, []);

  useEffect(() => {
    const s = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    setSocket(s); socketRef.current = s;
    s.on('new_message', (msg) => { const me = currentUserRef.current?.username; const key = msg.from === me ? msg.to : msg.from; setMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] })); });
    s.on('new_group_message', (msg) => { const key = `group_${msg.groupId}`; setMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] })); });
    s.on('message_edited', ({ messageId, newText, edited }) => { setMessages(prev => { const u = { ...prev }; for (const k of Object.keys(u)) u[k] = u[k].map(m => (m._id === messageId || m.id === messageId) ? { ...m, text: newText, edited } : m); return u; }); });
    s.on('message_deleted', ({ messageId }) => { setMessages(prev => { const u = { ...prev }; for (const k of Object.keys(u)) u[k] = u[k].filter(m => m._id !== messageId && m.id !== messageId); return u; }); });
    s.on('group_created', (g) => setGroups(prev => prev.find(x => x._id === g._id) ? prev : [...prev, g]));
    s.on('group_updated', (g) => setGroups(prev => prev.map(x => x._id === g._id ? g : x)));
    s.on('user_status_change', ({ username, isOnline }) => setContacts(prev => prev.map(c => c.username === username ? { ...c, isOnline } : c)));
    s.on('user_typing', ({ from }) => { setTypingUsers(prev => ({ ...prev, [from]: true })); if (typingTimeoutRef.current[from]) clearTimeout(typingTimeoutRef.current[from]); typingTimeoutRef.current[from] = setTimeout(() => setTypingUsers(prev => { const n = { ...prev }; delete n[from]; return n; }), 2000); });
    s.on('group_user_typing', ({ from, groupId }) => { const key = `group_${groupId}`; setTypingUsers(prev => ({ ...prev, [key]: from })); if (typingTimeoutRef.current[key]) clearTimeout(typingTimeoutRef.current[key]); typingTimeoutRef.current[key] = setTimeout(() => setTypingUsers(prev => { const n = { ...prev }; delete n[key]; return n; }), 2000); });
    s.on('messages_read', ({ by }) => setMessages(prev => prev[by] ? { ...prev, [by]: prev[by].map(m => ({ ...m, read: true })) } : prev));
    s.on('reaction_updated', ({ messageId, reactions }) => { setMessages(prev => { const u = { ...prev }; for (const k of Object.keys(u)) u[k] = u[k].map(m => (m._id === messageId || m.id === messageId) ? { ...m, reactions } : m); return u; }); });
    s.on('avatar_updated', ({ username, avatar }) => setAvatars(prev => ({ ...prev, [username]: avatar })));
    s.on('incoming_call', ({ from, offer }) => { callPeerRef.current = from; incomingOfferRef.current = offer; setCallPeer(from); setCallState('incoming'); });
    s.on('call_answered', async ({ answer }) => { try { await peerConnectionRef.current?.setRemoteDescription(answer); setCallState('active'); callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000); } catch {} });
    s.on('ice_candidate', async ({ candidate }) => { try { await peerConnectionRef.current?.addIceCandidate(candidate); } catch {} });
    s.on('call_ended', () => cleanupCall());
    s.on('call_rejected', () => { alert('Звонок отклонён'); cleanupCall(); });
    s.on('call_failed', ({ reason }) => { alert(reason); cleanupCall(); });
    s.on('force_disconnect', ({ reason }) => { alert(reason); handleLogout(); });
    return () => { s.close(); cleanupCall(); };
  }, []);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const chatKey = getChatKey(activeChat);
  const chatMessages = chatKey ? (messages[chatKey] || []) : [];
  const prevMsgCount = useRef(0);
  useEffect(() => { if (chatMessages.length > prevMsgCount.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); prevMsgCount.current = chatMessages.length; }, [chatMessages.length]);
  useEffect(() => { const h = () => setMsgMenu(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);

  const handleRegister = (e) => { e.preventDefault(); setAuthError(''); socket.emit('register', { username, displayName, password }, (res) => { if (res.success) handleLogin(e); else setAuthError(res.error); }); };
  const handleLogin = (e) => { e.preventDefault(); setAuthError(''); socket.emit('login', { username, password }, (res) => { if (res.success) { setCurrentUser(res.user); setContacts(res.contacts || []); setGroups(res.groups || []); const av = {}; (res.contacts || []).forEach(c => { if (c.avatar) av[c.username] = c.avatar; }); if (res.user.avatar) av[res.user.username] = res.user.avatar; setAvatars(av); setIsAuthenticated(true); } else setAuthError(res.error); }); };
  const handleLogout = () => { cleanupCall(); setIsAuthenticated(false); setCurrentUser(null); setContacts([]); setGroups([]); setActiveChat(null); setMessages({}); setUsername(''); setPassword(''); setDisplayName(''); };
  const handleAvatarUpload = (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 500000) { alert('Макс. 500KB'); return; } const r = new FileReader(); r.onloadend = () => socket.emit('update_avatar', r.result, (res) => { if (res.success) { setAvatars(prev => ({ ...prev, [currentUser.username]: r.result })); setCurrentUser(prev => ({ ...prev, avatar: r.result })); } }); r.readAsDataURL(file); };
  const handleSearch = (q) => { setSearchQuery(q); if (q.length < 2) { setSearchResults([]); return; } socket.emit('search_users', q, (res) => { if (res.success) setSearchResults(res.results); }); };
  const handleAddContact = (u) => { socket.emit('add_contact', u, (res) => { if (res.success) { setContacts(prev => [...prev, res.contact]); if (res.contact.avatar) setAvatars(prev => ({ ...prev, [res.contact.username]: res.contact.avatar })); setSearchResults([]); setSearchQuery(''); setShowSearch(false); } }); };
  const handleRemoveContact = (u) => { if (!confirm(`Удалить ${u}?`)) return; socket.emit('remove_contact', u, (res) => { if (res.success) { setContacts(prev => prev.filter(c => c.username !== u)); if (activeChat?.id === u) setActiveChat(null); } }); };
  const openDirectChat = (contact) => { setActiveChat({ type: 'direct', id: contact.username, data: contact }); setShowSearch(false); socket.emit('load_chat', contact.username, (res) => { if (res.success) setMessages(prev => ({ ...prev, [contact.username]: res.messages })); }); };
  const openGroupChat = (group) => { setActiveChat({ type: 'group', id: group._id, data: group }); socket.emit('load_group_chat', group._id, (res) => { if (res.success) setMessages(prev => ({ ...prev, [`group_${group._id}`]: res.messages })); }); };
  const handleSendMessage = (e) => { e.preventDefault(); if (!inputMessage.trim() || !activeChat) return; if (activeChat.type === 'direct') socket.emit('send_message', { to: activeChat.id, text: inputMessage.trim(), type: 'text' }, () => {}); else socket.emit('send_group_message', { groupId: activeChat.id, text: inputMessage.trim(), type: 'text' }, () => {}); setInputMessage(''); };
  const handleTyping = () => { if (!activeChat) return; if (activeChat.type === 'direct') socket.emit('typing', activeChat.id); else socket.emit('group_typing', activeChat.id); };
  const startEdit = (msg) => { setEditingMsgId(msg._id || msg.id); setEditText(msg.text); setMsgMenu(null); };
  const submitEdit = (e) => { e.preventDefault(); if (!editText.trim()) return; socket.emit('edit_message', { messageId: editingMsgId, newText: editText.trim() }, (res) => { if (res.success) { setEditingMsgId(null); setEditText(''); } }); };
  const deleteMsg = (msg, forAll) => { socket.emit('delete_message', { messageId: msg._id || msg.id, deleteFor: forAll ? 'all' : 'me' }, () => {}); setMsgMenu(null); };
  const submitForward = (toUsername) => { socket.emit('forward_message', { messageId: forwardMsg._id || forwardMsg.id, toUsername }, (res) => { if (res.success) { setShowForwardModal(false); setForwardMsg(null); const c = contacts.find(x => x.username === toUsername); if (c) openDirectChat(c); } }); };
  const startRecording = async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mr = new MediaRecorder(stream); mediaRecorderRef.current = mr; audioChunksRef.current = []; mr.ondataavailable = e => audioChunksRef.current.push(e.data); mr.onstop = () => { const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); const r = new FileReader(); r.onloadend = () => { if (activeChat.type === 'direct') socket.emit('send_message', { to: activeChat.id, text: '', type: 'voice', audioData: r.result }, () => {}); else socket.emit('send_group_message', { groupId: activeChat.id, text: '', type: 'voice', audioData: r.result }, () => {}); }; r.readAsDataURL(blob); stream.getTracks().forEach(t => t.stop()); }; mr.start(); setIsRecording(true); setRecordingTime(0); recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000); } catch { alert('Нет доступа к микрофону'); } };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); clearInterval(recordingTimerRef.current); setIsRecording(false); setRecordingTime(0); };
  const toggleAudio = (id, data) => { if (playingAudio === id) { setPlayingAudio(null); return; } setPlayingAudio(id); const a = new Audio(data); a.onended = () => setPlayingAudio(null); a.play(); };
  const handleReaction = (mid, emoji) => { socket.emit('add_reaction', { messageId: mid, emoji }, () => {}); setHoveredMsg(null); };
  const handleCreateGroup = (e) => { e.preventDefault(); if (!newGroupName.trim()) return; socket.emit('create_group', { name: newGroupName, description: newGroupDesc, members: selectedMembers }, (res) => { if (res.success) { setShowCreateGroup(false); setNewGroupName(''); setNewGroupDesc(''); setSelectedMembers([]); openGroupChat(res.group); } }); };
  const handleLeaveGroup = () => { if (!confirm('Покинуть группу?')) return; socket.emit('leave_group', activeChat.id, (res) => { if (res.success) { setGroups(prev => prev.filter(g => g._id !== activeChat.id)); setActiveChat(null); setShowGroupInfo(false); } }); };
  const searchAddMember = (q) => { setAddMemberQuery(q); if (q.length < 2) { setAddMemberResults([]); return; } socket.emit('search_users', q, (res) => { if (res.success) setAddMemberResults(res.results); }); };
  const handleAddMember = (u) => { socket.emit('group_add_member', { groupId: activeChat.id, username: u }, (res) => { if (res.success) { setGroups(prev => prev.map(g => g._id === activeChat.id ? res.group : g)); setActiveChat(prev => prev ? { ...prev, data: res.group } : prev); setAddMemberQuery(''); setAddMemberResults([]); } else alert(res.error); }); };
  const handleDemote = (username) => {
    if (!confirm(`Разжаловать ${username}?`)) return;
    socket.emit('admin_demote_user', username, (res) => {
      if (res.success) loadAdminData(adminSearch);
      else alert(res.error);
    });
  };
  const loadAdminData = (search = '') => { socket.emit('admin_get_stats', (res) => { if (res.success) setAdminStats(res.stats); }); socket.emit('admin_get_users', { search }, (res) => { if (res.success) setAllUsers(res.users); }); socket.emit('admin_get_logs', (res) => { if (res.success) setAdminLogs(res.logs); }); };
  const fmtTime = (ts) => { const d = new Date(ts), n = new Date(); return d.toDateString() === n.toDateString() ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); };
  const fmtDur = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const activeChatData = activeChat?.type === 'group' ? groups.find(g => g._id === activeChat?.id) || activeChat?.data : contacts.find(c => c.username === activeChat?.id) || activeChat?.data;
  const typingKey = activeChat?.type === 'group' ? `group_${activeChat.id}` : activeChat?.id;

  if (!isAuthenticated) return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600"><div className="absolute inset-0 opacity-30"><div className="absolute top-0 -left-4 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div><div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div><div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div></div></div>
      <div className="relative backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-3xl"></div>
        <div className="relative text-center mb-8"><div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-white/20 border border-white/30"><Sparkles className="w-8 h-8 text-white"/></div><h1 className="text-5xl font-bold text-white mb-2">Whispr</h1><p className="text-white/80 text-sm">Мессенджер нового поколения</p></div>
        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="relative space-y-4">
          <div><label className="block text-sm font-medium text-white/90 mb-2">Username</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none" placeholder="username" required/></div>
          {isRegistering && <div><label className="block text-sm font-medium text-white/90 mb-2">Имя</label><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none" placeholder="Ваше имя" required/></div>}
          <div><label className="block text-sm font-medium text-white/90 mb-2">Пароль</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none" placeholder="••••••••" required/></div>
          {authError && <div className="text-red-300 text-sm bg-red-500/20 px-3 py-2 rounded-lg">{authError}</div>}
          <button type="submit" className="w-full bg-white/20 border border-white/30 text-white py-3 rounded-xl font-medium hover:bg-white/30 transition-all">{isRegistering ? 'Зарегистрироваться' : 'Войти'}</button>
          <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="w-full text-white/70 text-sm hover:text-white">{isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}</button>
        </form>
      </div>
      <style>{STYLES}</style>
    </div>
  );

  return (
    <div style={{height:'100dvh',display:'flex',position:'relative',overflow:'hidden'}}>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600"><div className="absolute inset-0 opacity-20"><div className="absolute top-0 -left-4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div><div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div><div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div></div></div>

      <div className={`relative flex-shrink-0 w-80 backdrop-blur-2xl bg-white/10 border-r border-white/20 flex flex-col transition-all duration-300 ${showSidebar ? 'ml-0' : '-ml-80'}`}>
        <div className="p-4 border-b border-white/20"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><label className="cursor-pointer relative group"><Avatar username={currentUser?.username} displayName={currentUser?.displayName} avatar={avatars[currentUser?.username]} size="sm"/><div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity">✎</div><input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/></label><div><div className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-white/70"/><span className="text-white font-bold">Whispr</span></div><p className="text-xs text-white/60">@{currentUser?.username}</p></div></div><div className="flex gap-1">{currentUser?.isAdmin && <button onClick={() => { setShowAdminPanel(true); loadAdminData(); }} className="p-2 rounded-lg bg-white/20 hover:bg-white/30"><Shield className="w-4 h-4 text-white"/></button>}<button onClick={handleLogout} className="p-2 rounded-lg bg-white/20 hover:bg-white/30"><LogOut className="w-4 h-4 text-white"/></button></div></div></div>
        <div className="px-4 pt-3 pb-2 flex gap-2"><button onClick={() => setShowSearch(true)} className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-white flex items-center gap-2 hover:bg-white/30 text-sm"><Search className="w-4 h-4"/><span>Найти</span></button><button onClick={() => setShowCreateGroup(true)} className="px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-white hover:bg-white/30"><Plus className="w-4 h-4"/></button></div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {contacts.length > 0 && <div className="text-xs font-semibold text-white/40 uppercase tracking-wider pt-2 pb-1 px-1">Контакты</div>}
          {contacts.map(c => (<div key={c.username} onClick={() => openDirectChat(c)} className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all group flex items-center gap-3 ${activeChat?.type==='direct'&&activeChat.id===c.username?'bg-white/30 border border-white/40':'bg-white/10 border border-white/10 hover:bg-white/20'}`}><Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm" online={c.isOnline}/><div className="flex-1 min-w-0"><div className="text-sm font-medium text-white truncate">{c.displayName}</div><div className="text-xs text-white/50 truncate">@{c.username}</div></div><button onClick={e => { e.stopPropagation(); handleRemoveContact(c.username); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded flex-shrink-0"><X className="w-3 h-3 text-white/60"/></button></div>))}
          {groups.length > 0 && <div className="text-xs font-semibold text-white/40 uppercase tracking-wider pt-3 pb-1 px-1">Группы</div>}
          {groups.map(g => (<div key={g._id} onClick={() => openGroupChat(g)} className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 ${activeChat?.type==='group'&&activeChat.id===g._id?'bg-white/30 border border-white/40':'bg-white/10 border border-white/10 hover:bg-white/20'}`}><GroupAvatar group={g} size="sm"/><div className="flex-1 min-w-0"><div className="text-sm font-medium text-white truncate">{g.name}</div><div className="text-xs text-white/50">{g.members.length} участников</div></div></div>))}
          {contacts.length===0&&groups.length===0&&<div className="text-center py-10 text-white/40 text-sm">Нет контактов.<br/>Нажми «Найти»!</div>}
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',position:'relative',minWidth:0}}>
        {activeChat ? (
          <>
            <div className="flex-shrink-0 px-4 py-3 backdrop-blur-2xl bg-white/10 border-b border-white/20 flex items-center gap-3">
              <button onClick={() => setShowSidebar(s => !s)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 flex-shrink-0"><Menu className="w-5 h-5 text-white"/></button>
              {activeChat.type==='direct'?<Avatar username={activeChatData?.username} displayName={activeChatData?.displayName} avatar={avatars[activeChatData?.username]} size="md" online={activeChatData?.isOnline}/>:<GroupAvatar group={activeChatData} size="md"/>}
              <div className="flex-1 min-w-0"><div className="text-white font-medium truncate">{activeChat.type==='direct'?activeChatData?.displayName:activeChatData?.name}</div><div className="text-xs text-white/60">{activeChat.type==='direct'?(activeChatData?.isOnline?<span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-green-400 text-green-400"/>онлайн</span>:'не в сети'):`${activeChatData?.members?.length||0} участников`}</div></div>
              {activeChat.type==='direct'&&activeChatData?.isOnline&&callState==='idle'&&<button onClick={() => startCall(activeChat.id)} className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/40 border border-green-500/30 flex-shrink-0"><Phone className="w-5 h-5 text-green-300"/></button>}
              {activeChat.type==='group'&&<button onClick={() => setShowGroupInfo(true)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 flex-shrink-0"><Settings className="w-4 h-4 text-white"/></button>}
            </div>

            <div style={{flex:1,overflowY:'auto',padding:'1.5rem',display:'flex',flexDirection:'column',gap:'0.375rem'}}>
              {chatMessages.map((msg) => {
                const isOwn = msg.from === currentUser?.username;
                const mid = msg._id || msg.id;
                const reactions = msg.reactions || {};
                const hasR = Object.keys(reactions).some(e => reactions[e]?.length > 0);
                const isEditing = editingMsgId === mid;
                return (
                  <div key={mid} className={`flex items-end gap-2 ${isOwn?'flex-row-reverse':'flex-row'}`} onMouseEnter={() => { clearTimeout(hoverTimeoutRef.current); setHoveredMsg(mid); }} onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setHoveredMsg(null), 300); }}>
                    {!isOwn&&activeChat.type==='group'&&<Avatar username={msg.from} displayName={msg.from} avatar={avatars[msg.from]} size="sm"/>}
                    <div className="relative max-w-xs md:max-w-md">
                      {!isOwn&&activeChat.type==='group'&&<div className="text-xs text-white/60 mb-1 ml-1">{contacts.find(c=>c.username===msg.from)?.displayName||msg.from}</div>}
                      {hoveredMsg===mid&&!isEditing&&(
                        <div className={`absolute ${isOwn?'right-0':'left-0'} -top-10 flex gap-1 bg-black/70 backdrop-blur-xl rounded-2xl px-2 py-1 z-10 shadow-xl`} onMouseEnter={() => { clearTimeout(hoverTimeoutRef.current); setHoveredMsg(mid); }} onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setHoveredMsg(null), 300); }}>
                          {EMOJI_LIST.map(e => <button key={e} onClick={() => handleReaction(mid, e)} className="text-lg hover:scale-125 transition-transform">{e}</button>)}
                          <button onClick={ev => { ev.stopPropagation(); setMsgMenu({ msgId: mid, msg, isOwn }); }} className="ml-1 p-1 hover:bg-white/20 rounded-lg"><MoreVertical className="w-4 h-4 text-white/70"/></button>
                        </div>
                      )}
                      {msg.forwarded&&<div className="text-xs text-white/50 mb-1 flex items-center gap-1"><Forward className="w-3 h-3"/>Переслано от @{msg.forwardedFrom}</div>}
                      {isEditing ? (
                        <form onSubmit={submitEdit} className="flex gap-2 items-center">
                          <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus className="flex-1 px-3 py-2 bg-white/30 border border-white/50 rounded-xl text-white text-sm focus:outline-none"/>
                          <button type="submit" className="p-2 bg-green-500/30 hover:bg-green-500/50 rounded-lg"><Check className="w-4 h-4 text-white"/></button>
                          <button type="button" onClick={() => setEditingMsgId(null)} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-4 h-4 text-white"/></button>
                        </form>
                      ) : (
                        <div className={`rounded-2xl px-4 py-2.5 backdrop-blur-xl ${isOwn?'bg-white/25 border border-white/30 rounded-br-sm':'bg-white/15 border border-white/20 rounded-bl-sm'} text-white shadow-md`}>
                          {msg.type==='voice'?(<div className="flex items-center gap-3 min-w-36"><button onClick={() => toggleAudio(mid, msg.audioData)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 flex-shrink-0">{playingAudio===mid?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}</button><div className="flex-1 h-1 bg-white/30 rounded-full"><div className="h-full w-1/2 bg-white/70 rounded-full"></div></div><Mic className="w-3 h-3 text-white/50 flex-shrink-0"/></div>):(<div className="text-sm leading-relaxed break-words">{msg.text}</div>)}
                          <div className="flex items-center justify-end gap-1 mt-0.5">{msg.edited&&<span className="text-xs text-white/40">ред.</span>}<span className="text-xs text-white/50">{fmtTime(msg.timestamp)}</span>{isOwn&&activeChat.type==='direct'&&<span className="text-xs">{msg.read?<span className="text-blue-300">✓✓</span>:msg.delivered?<span className="text-white/50">✓✓</span>:<span className="text-white/30">✓</span>}</span>}</div>
                        </div>
                      )}
                      {hasR&&!isEditing&&<div className={`flex flex-wrap gap-1 mt-1 ${isOwn?'justify-end':'justify-start'}`}>{Object.entries(reactions).filter(([,u])=>u?.length>0).map(([e,u])=>(<button key={e} onClick={() => handleReaction(mid, e)} className="flex items-center gap-1 bg-white/20 border border-white/30 rounded-full px-2 py-0.5 text-sm hover:bg-white/30">{e}<span className="text-xs text-white/80">{u.length}</span></button>))}</div>}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef}/>
              {typingUsers[typingKey]&&<div className="text-sm text-white/70 italic bg-white/10 inline-block px-3 py-1 rounded-full self-start">{activeChat.type==='group'?`${typingUsers[typingKey]} печатает...`:'печатает...'}</div>}
            </div>

            <div className="flex-shrink-0 p-4 backdrop-blur-2xl bg-white/10 border-t border-white/20">
              {isRecording ? (
                <div className="flex items-center gap-3 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3"><div className="w-3 h-3 bg-red-400 rounded-full animate-pulse flex-shrink-0"></div><span className="text-white flex-1">Запись... {fmtDur(recordingTime)}</span><button onClick={stopRecording} className="bg-red-500/40 hover:bg-red-500/60 text-white px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"><MicOff className="w-4 h-4"/>Отправить</button></div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2"><input type="text" value={inputMessage} onChange={e => { setInputMessage(e.target.value); handleTyping(); }} className="flex-1 px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none min-w-0" placeholder="Напишите сообщение..."/><button type="button" onClick={startRecording} className="bg-white/20 border border-white/30 text-white px-3 py-3 rounded-xl hover:bg-white/30 flex-shrink-0"><Mic className="w-5 h-5"/></button><button type="submit" className="bg-white/20 border border-white/30 text-white px-5 py-3 rounded-xl hover:bg-white/30 flex items-center gap-2 flex-shrink-0"><Send className="w-5 h-5"/></button></form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center"><div className="text-center text-white/50"><Sparkles className="w-16 h-16 mx-auto mb-4 opacity-40"/><p className="text-lg">Выберите чат</p></div></div>
        )}
      </div>

      {msgMenu&&(<div className="fixed z-50 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl w-48" style={{top:200,left:'50%',transform:'translateX(-50%)'}} onClick={e=>e.stopPropagation()}><button onClick={() => { setForwardMsg(msgMenu.msg); setShowForwardModal(true); setMsgMenu(null); }} className="w-full px-4 py-3 text-left text-white text-sm hover:bg-white/10 flex items-center gap-3"><Forward className="w-4 h-4 text-blue-300"/>Переслать</button>{msgMenu.isOwn&&msgMenu.msg.type!=='voice'&&<button onClick={() => startEdit(msgMenu.msg)} className="w-full px-4 py-3 text-left text-white text-sm hover:bg-white/10 flex items-center gap-3"><Pencil className="w-4 h-4 text-yellow-300"/>Редактировать</button>}{msgMenu.isOwn&&<button onClick={() => deleteMsg(msgMenu.msg, true)} className="w-full px-4 py-3 text-left text-red-300 text-sm hover:bg-red-500/10 flex items-center gap-3"><Trash2 className="w-4 h-4"/>Удалить у всех</button>}<button onClick={() => deleteMsg(msgMenu.msg, false)} className="w-full px-4 py-3 text-left text-white/60 text-sm hover:bg-white/10 flex items-center gap-3"><X className="w-4 h-4"/>Удалить у меня</button></div>)}

      {showForwardModal&&(<div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowForwardModal(false)}><div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-sm m-4" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Forward className="w-5 h-5"/>Переслать</h3><button onClick={() => setShowForwardModal(false)} className="p-2 rounded-lg bg-white/20"><X className="w-4 h-4 text-white"/></button></div><div className="space-y-2 max-h-64 overflow-y-auto">{contacts.map(c=>(<button key={c.username} onClick={() => submitForward(c.username)} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"><Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm" online={c.isOnline}/><div className="text-left"><div className="text-white text-sm">{c.displayName}</div><div className="text-white/50 text-xs">@{c.username}</div></div></button>))}</div></div></div>)}

      {showSearch&&(<div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSearch(false)}><div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-md m-4" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-white">Поиск</h3><button onClick={() => setShowSearch(false)} className="p-2 rounded-lg bg-white/20"><X className="w-5 h-5 text-white"/></button></div><input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)} autoFocus className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none mb-4" placeholder="Username или имя..."/><div className="space-y-2 max-h-80 overflow-y-auto">{searchResults.map(u=>(<div key={u.username} className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl flex items-center gap-3"><Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm" online={u.isOnline}/><div className="flex-1"><div className="text-white font-medium">{u.displayName}</div><div className="text-xs text-white/60">@{u.username}</div></div><button onClick={() => handleAddContact(u.username)} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm"><UserPlus className="w-4 h-4"/></button></div>))}{searchQuery.length>=2&&searchResults.length===0&&<p className="text-center py-6 text-white/60">Ничего не найдено</p>}{searchQuery.length<2&&<p className="text-center py-6 text-white/60">Введите минимум 2 символа</p>}</div></div></div>)}

      {showCreateGroup&&(<div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreateGroup(false)}><div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-md m-4" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Hash className="w-5 h-5"/>Новая группа</h3><button onClick={() => setShowCreateGroup(false)} className="p-2 rounded-lg bg-white/20"><X className="w-5 h-5 text-white"/></button></div><form onSubmit={handleCreateGroup} className="space-y-4"><input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none" placeholder="Название группы" required/><input type="text" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none" placeholder="Описание (необязательно)"/><div><p className="text-sm text-white/70 mb-2">Участники:</p><div className="space-y-1 max-h-40 overflow-y-auto">{contacts.map(c=>(<label key={c.username} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/10 cursor-pointer hover:bg-white/20"><input type="checkbox" checked={selectedMembers.includes(c.username)} onChange={e => setSelectedMembers(prev => e.target.checked?[...prev,c.username]:prev.filter(u=>u!==c.username))}/><Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm"/><span className="text-white text-sm">{c.displayName}</span></label>))}</div></div><button type="submit" className="w-full bg-white/20 border border-white/30 text-white py-3 rounded-xl hover:bg-white/30 font-medium">Создать группу</button></form></div></div>)}

      {showGroupInfo&&activeChat?.type==='group'&&(<div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowGroupInfo(false)}><div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-md m-4 max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-white">{activeChatData?.name}</h3><button onClick={() => setShowGroupInfo(false)} className="p-2 rounded-lg bg-white/20"><X className="w-5 h-5 text-white"/></button></div>{activeChatData?.description&&<p className="text-white/60 text-sm mb-4">{activeChatData.description}</p>}<p className="text-xs text-white/40 uppercase tracking-wider mb-2">Участники ({activeChatData?.members?.length})</p><div className="space-y-2 mb-4">{activeChatData?.members?.map(member => { const c=contacts.find(x=>x.username===member)||{username:member,displayName:member}; return (<div key={member} className="flex items-center gap-3 px-3 py-2 bg-white/10 rounded-xl"><Avatar username={member} displayName={c.displayName} avatar={avatars[member]} size="sm"/><div className="flex-1"><div className="text-white text-sm">{c.displayName||member}</div><div className="text-xs text-white/50">@{member}</div></div>{activeChatData?.admins?.includes(member)&&<Crown className="w-4 h-4 text-yellow-400"/>}</div>); })}</div>{activeChatData?.admins?.includes(currentUser?.username)&&(<div className="mb-4"><p className="text-xs text-white/40 uppercase tracking-wider mb-2">Добавить</p><input type="text" value={addMemberQuery} onChange={e => searchAddMember(e.target.value)} className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:outline-none mb-2" placeholder="Поиск..."/>{addMemberResults.filter(u=>!activeChatData.members.includes(u.username)).map(u=>(<div key={u.username} className="flex items-center gap-3 px-3 py-2 bg-white/10 rounded-xl mb-1"><Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm"/><span className="text-white text-sm flex-1">{u.displayName}</span><button onClick={() => handleAddMember(u.username)} className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs flex items-center gap-1"><UserCheck className="w-3 h-3"/>Добавить</button></div>))}</div>)}<button onClick={handleLeaveGroup} className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-300 font-medium">Покинуть группу</button></div></div>)}

      {showAdminPanel&&currentUser?.isAdmin&&(<div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdminPanel(false)}><div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-5"><h3 className="text-2xl font-bold text-white flex items-center gap-2"><Shield className="w-6 h-6"/>Админ Панель</h3><button onClick={() => setShowAdminPanel(false)} className="p-2 rounded-lg bg-white/20"><X className="w-5 h-5 text-white"/></button></div>{adminStats&&(<div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">{[['Всего',adminStats.totalUsers],['Онлайн',adminStats.onlineUsers],['Сообщ.',adminStats.totalMessages],['Чатов',adminStats.totalChats],['Заблок.',adminStats.blockedUsers],['Групп',adminStats.totalGroups]].map(([l,v])=>(<div key={l} className="p-3 bg-white/10 border border-white/20 rounded-xl text-center"><div className="text-white/60 text-xs">{l}</div><div className="text-xl font-bold text-white">{v}</div></div>))}</div>)}<div className="flex gap-2 mb-4">{['users','logs'].map(tab=>(<button key={tab} onClick={() => setAdminTab(tab)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${adminTab===tab?'bg-white/30 text-white':'bg-white/10 text-white/60 hover:bg-white/20'}`}>{tab==='users'?<><Users className="w-4 h-4"/>Пользователи</>:<><History className="w-4 h-4"/>История</>}</button>))}</div>{adminTab==='users'&&(<><input type="text" value={adminSearch} onChange={e => { setAdminSearch(e.target.value); loadAdminData(e.target.value); }} className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none mb-3" placeholder="🔍 Поиск..."/><div className="space-y-2">{allUsers.map(u=>(<div key={u.username} className={`px-4 py-3 border rounded-xl flex items-center justify-between ${u.isBlocked?'bg-red-500/10 border-red-500/20':'bg-white/10 border-white/20'}`}><div className="flex items-center gap-3"><Circle className={`w-2 h-2 flex-shrink-0 ${u.isOnline?'fill-green-400 text-green-400':'fill-gray-500 text-gray-500'}`}/><div><div className="flex items-center gap-2"><span className="text-white font-medium">{u.displayName}</span>{u.isAdmin&&<Crown className="w-4 h-4 text-yellow-400"/>}{u.isBlocked&&<Ban className="w-4 h-4 text-red-400"/>}</div><div className="text-xs text-white/50">@{u.username} • {u.contactsCount} конт.</div></div></div>{!u.isAdmin&&(<div className="flex gap-2 flex-shrink-0"><button onClick={()=>socket.emit('admin_block_user',{target:u.username,block:!u.isBlocked},res=>{if(res.success)loadAdminData(adminSearch);})} className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border ${u.isBlocked?'bg-green-500/20 border-green-500/30 text-green-200':'bg-orange-500/20 border-orange-500/30 text-orange-200'}`}><Ban className="w-3 h-3"/>{u.isBlocked?'Разблок.':'Блок.'}</button>{!u.isAdmin&&<button onClick={()=>{if(confirm(`Промоут ${u.username}?`))socket.emit('admin_promote_user',u.username,res=>{if(res.success)loadAdminData(adminSearch);})}} className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-200 text-xs" title="Сделать админом"><Crown className="w-3 h-3"/></button>}{u.isAdmin&&u.username!=='admin'&&<button onClick={()=>handleDemote(u.username)} className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-200 text-xs" title="Разжаловать"><Crown className="w-3 h-3 line-through opacity-60"/></button>}<button onClick={()=>{if(confirm(`Удалить ${u.username}?`))socket.emit('admin_delete_user',u.username,res=>{if(res.success)loadAdminData(adminSearch);})}} className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-xs"><Trash2 className="w-3 h-3"/></button></div>)}</div>))}</div></>)}{adminTab==='logs'&&(<div className="space-y-2">{adminLogs.length===0&&<p className="text-center py-8 text-white/50">Нет действий</p>}{adminLogs.map((log,i)=>(<div key={i} className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl flex items-center justify-between"><div><div className="text-white/90 text-sm">{log.details}</div><div className="text-xs text-white/40">@{log.admin}</div></div><div className="text-xs text-white/40 flex-shrink-0 ml-4">{fmtTime(log.timestamp)}</div></div>))}</div>)}</div></div>)}

      {callState==='incoming'&&<IncomingCallOverlay from={callPeer} fromDisplay={contacts.find(c=>c.username===callPeer)?.displayName||callPeer} fromAvatar={avatars[callPeer]} onAccept={acceptCall} onReject={rejectCall}/>}
      {(callState==='calling'||callState==='active')&&<ActiveCallOverlay peer={callPeer} peerDisplay={contacts.find(c=>c.username===callPeer)?.displayName||callPeer} peerAvatar={avatars[callPeer]} duration={callDuration} muted={callMuted} onMute={toggleMute} onEnd={endCall} calling={callState==='calling'} audioRef={remoteAudioRef} remoteStream={remoteStreamRef.current}/>}

      <style>{STYLES}</style>
      <div style={{position:'fixed',bottom:10,left:'50%',transform:'translateX(-50%)',color:'rgba(255,255,255,0.2)',fontSize:'11px',zIndex:100,pointerEvents:'none',whiteSpace:'nowrap'}}>by Meowlentii</div>
    </div>
  );
}

const STYLES = `
  @keyframes blob { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-50px) scale(1.1)} 66%{transform:translate(-20px,20px) scale(0.9)} 100%{transform:translate(0,0) scale(1)} }
  .animate-blob{animation:blob 7s infinite} .animation-delay-2000{animation-delay:2s} .animation-delay-4000{animation-delay:4s}
`;
