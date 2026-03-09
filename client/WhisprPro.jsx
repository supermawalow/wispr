import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Send, Search, UserPlus, LogOut, Circle, Shield, Trash2,
  Crown, X, Menu, Mic, MicOff, Play, Pause, Ban, History,
  Plus, UserCheck, Hash, Settings, Phone, PhoneOff, Check,
  MoreVertical, Forward, Pencil, Users, Sparkles, Palette
} from 'lucide-react';

const SERVER_URL = 'https://whispr-server-u5zy.onrender.com';
const EMOJI_LIST = ['❤️','😂','😮','😢','👍','🔥'];

// ── Цветовые темы ──
const THEMES = {
  violet: { name: 'Фиолетовый', from: '#7c3aed', via: '#6d28d9', to: '#a21caf', accent: 'violet' },
  blue:   { name: 'Синий',      from: '#1d4ed8', via: '#2563eb', to: '#0891b2', accent: 'blue'   },
  green:  { name: 'Зелёный',    from: '#065f46', via: '#047857', to: '#0d9488', accent: 'emerald'},
  rose:   { name: 'Розовый',    from: '#9f1239', via: '#be123c', to: '#e11d48', accent: 'rose'   },
  orange: { name: 'Оранжевый',  from: '#92400e', via: '#b45309', to: '#d97706', accent: 'amber'  },
  slate:  { name: 'Тёмный',     from: '#0f172a', via: '#1e293b', to: '#334155', accent: 'slate'  },
};

function Avatar({ username, displayName, avatar, size = 'md', online }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-xl' };
  const dotSizes = { sm: 'w-2.5 h-2.5 border', md: 'w-3 h-3 border-2', lg: 'w-4 h-4 border-2' };
  const colors = ['bg-violet-500','bg-pink-500','bg-teal-500','bg-orange-500','bg-blue-500','bg-emerald-500'];
  const color = colors[(username?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center font-bold text-white ${avatar ? '' : color}`}>
        {avatar ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                : <span>{(displayName || username || '?')[0].toUpperCase()}</span>}
      </div>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full border-[3px] border-black/40 ${online ? 'bg-green-400' : 'bg-gray-500'}`} />
      )}
    </div>
  );
}

function GroupAvatar({ group, size = 'md' }) {
  const s = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' };
  return (
    <div className={`${s[size]} rounded-full flex items-center justify-center text-white bg-gradient-to-br from-violet-500 to-fuchsia-500 flex-shrink-0 overflow-hidden`}>
      {group?.avatar ? <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" /> : <Hash className="w-4 h-4" />}
    </div>
  );
}

function Modal({ onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-gray-900/90 border border-white/10 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[88vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function IncomingCallOverlay({ from, fromDisplay, fromAvatar, onAccept, onReject }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[200]">
      <div className="bg-gray-900 border border-white/10 rounded-3xl p-10 text-center w-80 shadow-2xl">
        <div className="mb-5 flex justify-center"><Avatar username={from} displayName={fromDisplay} avatar={fromAvatar} size="lg" /></div>
        <p className="text-white/50 text-sm mb-1 tracking-widest uppercase text-xs">Входящий звонок</p>
        <p className="text-white text-2xl font-bold mb-8">{fromDisplay || from}</p>
        <div className="flex justify-center gap-10">
          <button onClick={onReject} className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 hover:bg-red-500/40 flex items-center justify-center transition-all"><PhoneOff className="w-7 h-7 text-red-400" /></button>
          <button onClick={onAccept} className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 hover:bg-green-500/40 flex items-center justify-center transition-all"><Phone className="w-7 h-7 text-green-400" /></button>
        </div>
      </div>
    </div>
  );
}

function ActiveCallOverlay({ peer, peerDisplay, peerAvatar, duration, muted, onMute, onEnd, calling, audioRef, remoteStream }) {
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const localRef = useRef(null);
  const resolved = audioRef || localRef;
  useEffect(() => {
    if (resolved.current && remoteStream) {
      resolved.current.srcObject = remoteStream;
      resolved.current.play().catch(() => {});
    }
  }, [remoteStream]);
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[200]">
      <div className="bg-gray-900 border border-white/10 rounded-3xl p-10 text-center w-80 shadow-2xl">
        <div className="mb-5 flex justify-center relative">
          <Avatar username={peer} displayName={peerDisplay} avatar={peerAvatar} size="lg" />
          {!calling && <div className="absolute inset-0 rounded-full border-2 border-green-400/30 animate-ping" style={{borderRadius:'50%'}}></div>}
        </div>
        <p className="text-white text-2xl font-bold mb-1">{peerDisplay || peer}</p>
        {calling ? <p className="text-white/40 text-sm mb-8 animate-pulse">Вызов...</p> : <p className="text-green-400 text-sm mb-8 font-mono tracking-widest">{fmt(duration)}</p>}
        <div className="flex justify-center gap-6">
          {!calling && <button onClick={onMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border ${muted ? 'bg-yellow-500/20 border-yellow-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>{muted ? <MicOff className="w-6 h-6 text-yellow-400" /> : <Mic className="w-6 h-6 text-white/70" />}</button>}
          <button onClick={onEnd} className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 hover:bg-red-500/40 flex items-center justify-center transition-all"><PhoneOff className="w-7 h-7 text-red-400" /></button>
        </div>
      </div>
      <audio ref={resolved} id="remoteAudio" autoPlay playsInline />
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

  // Звонки
  const [callState, setCallState] = useState('idle');
  const [callPeer, setCallPeer] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callMuted, setCallMuted] = useState(false);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);
  const callPeerRef = useRef(null);
  const incomingOfferRef = useRef(null);

  // Админ
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState('users');
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');

  // Настройки
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('whispr_theme') || 'violet');

  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const currentUserRef = useRef(null);

  const T = THEMES[theme] || THEMES.violet;
  const getChatKey = c => c ? (c.type === 'group' ? `group_${c.id}` : c.id) : null;
  const ICE = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ]};

  const cleanupCall = useCallback(() => {
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    clearInterval(callTimerRef.current);
    remoteStreamRef.current = null;
    const a = remoteAudioRef.current; if (a) a.srcObject = null;
    setCallState('idle'); setCallPeer(null); setCallDuration(0); setCallMuted(false);
    callPeerRef.current = null; incomingOfferRef.current = null;
  }, []);

  const startCall = useCallback(async (toUsername) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(ICE);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => {
        const s = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
        remoteStreamRef.current = s;
        const a = remoteAudioRef.current;
        if (a) { a.srcObject = s; a.play().catch(() => {}); }
      };
      pc.onicecandidate = e => { if (e.candidate) socketRef.current?.emit('ice_candidate', { to: toUsername, candidate: e.candidate }); };
      pc.onconnectionstatechange = () => { if (['failed','disconnected','closed'].includes(pc.connectionState)) cleanupCall(); };
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('call_offer', { to: toUsername, offer });
      setCallPeer(toUsername); callPeerRef.current = toUsername; setCallState('calling');
    } catch { alert('Нет доступа к микрофону'); cleanupCall(); }
  }, [cleanupCall]);

  const acceptCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(ICE);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => {
        const s = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
        remoteStreamRef.current = s;
        const a = remoteAudioRef.current;
        if (a) { a.srcObject = s; a.play().catch(() => {}); }
      };
      pc.onicecandidate = e => { if (e.candidate) socketRef.current?.emit('ice_candidate', { to: callPeerRef.current, candidate: e.candidate }); };
      pc.onconnectionstatechange = () => { if (['failed','disconnected','closed'].includes(pc.connectionState)) cleanupCall(); };
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
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
    s.on('new_message', msg => { const me = currentUserRef.current?.username; const key = msg.from === me ? msg.to : msg.from; setMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] })); });
    s.on('new_group_message', msg => { const key = `group_${msg.groupId}`; setMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] })); });
    s.on('message_edited', ({ messageId, newText, edited }) => setMessages(prev => { const u = {...prev}; for (const k of Object.keys(u)) u[k] = u[k].map(m => (m._id===messageId||m.id===messageId) ? {...m, text:newText, edited} : m); return u; }));
    s.on('message_deleted', ({ messageId }) => setMessages(prev => { const u = {...prev}; for (const k of Object.keys(u)) u[k] = u[k].filter(m => m._id!==messageId && m.id!==messageId); return u; }));
    s.on('group_created', g => setGroups(prev => prev.find(x => x._id===g._id) ? prev : [...prev, g]));
    s.on('group_updated', g => setGroups(prev => prev.map(x => x._id===g._id ? g : x)));
    s.on('user_status_change', ({ username, isOnline }) => setContacts(prev => prev.map(c => c.username===username ? {...c, isOnline} : c)));
    s.on('user_typing', ({ from }) => { setTypingUsers(prev => ({...prev, [from]: true})); clearTimeout(typingTimeoutRef.current[from]); typingTimeoutRef.current[from] = setTimeout(() => setTypingUsers(prev => { const n={...prev}; delete n[from]; return n; }), 2000); });
    s.on('group_user_typing', ({ from, groupId }) => { const key=`group_${groupId}`; setTypingUsers(prev => ({...prev, [key]: from})); clearTimeout(typingTimeoutRef.current[key]); typingTimeoutRef.current[key] = setTimeout(() => setTypingUsers(prev => { const n={...prev}; delete n[key]; return n; }), 2000); });
    s.on('messages_read', ({ by }) => setMessages(prev => prev[by] ? {...prev, [by]: prev[by].map(m => ({...m, read:true}))} : prev));
    s.on('reaction_updated', ({ messageId, reactions }) => setMessages(prev => { const u={...prev}; for (const k of Object.keys(u)) u[k]=u[k].map(m => (m._id===messageId||m.id===messageId) ? {...m, reactions} : m); return u; }));
    s.on('avatar_updated', ({ username, avatar }) => setAvatars(prev => ({...prev, [username]: avatar})));
    s.on('incoming_call', ({ from, offer }) => { callPeerRef.current=from; incomingOfferRef.current=offer; setCallPeer(from); setCallState('incoming'); });
    s.on('call_answered', async ({ answer }) => { try { await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(answer)); setCallState('active'); callTimerRef.current=setInterval(()=>setCallDuration(d=>d+1),1000); } catch {} });
    s.on('ice_candidate', async ({ candidate }) => { try { if (peerConnectionRef.current?.remoteDescription) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {} });
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

  // Save theme
  useEffect(() => { localStorage.setItem('whispr_theme', theme); }, [theme]);

  const handleRegister = e => { e.preventDefault(); setAuthError(''); socket.emit('register', { username, displayName, password }, res => { if (res.success) handleLogin(e); else setAuthError(res.error); }); };
  const handleLogin = e => { e.preventDefault(); setAuthError(''); socket.emit('login', { username, password }, res => { if (res.success) { setCurrentUser(res.user); setContacts(res.contacts||[]); setGroups(res.groups||[]); const av={}; (res.contacts||[]).forEach(c=>{if(c.avatar)av[c.username]=c.avatar;}); if(res.user.avatar)av[res.user.username]=res.user.avatar; setAvatars(av); setIsAuthenticated(true); } else setAuthError(res.error); }); };
  const handleLogout = () => { cleanupCall(); setIsAuthenticated(false); setCurrentUser(null); setContacts([]); setGroups([]); setActiveChat(null); setMessages({}); setUsername(''); setPassword(''); setDisplayName(''); };
  const handleAvatarUpload = e => { const f=e.target.files[0]; if(!f) return; if(f.size>500000){alert('Макс. 500KB');return;} const r=new FileReader(); r.onloadend=()=>socket.emit('update_avatar',r.result,res=>{if(res.success){setAvatars(p=>({...p,[currentUser.username]:r.result}));setCurrentUser(p=>({...p,avatar:r.result}));}}); r.readAsDataURL(f); };
  const handleSearch = q => { setSearchQuery(q); if(q.length<2){setSearchResults([]);return;} socket.emit('search_users',q,res=>{if(res.success)setSearchResults(res.results);}); };
  const handleAddContact = u => { socket.emit('add_contact',u,res=>{if(res.success){setContacts(p=>[...p,res.contact]);if(res.contact.avatar)setAvatars(p=>({...p,[res.contact.username]:res.contact.avatar}));setSearchResults([]);setSearchQuery('');setShowSearch(false);}}); };
  const handleRemoveContact = u => { if(!confirm(`Удалить ${u}?`))return; socket.emit('remove_contact',u,res=>{if(res.success){setContacts(p=>p.filter(c=>c.username!==u));if(activeChat?.id===u)setActiveChat(null);}}); };
  const openDirectChat = c => { setActiveChat({type:'direct',id:c.username,data:c}); setShowSearch(false); socket.emit('load_chat',c.username,res=>{if(res.success)setMessages(p=>({...p,[c.username]:res.messages}));}); };
  const openGroupChat = g => { setActiveChat({type:'group',id:g._id,data:g}); socket.emit('load_group_chat',g._id,res=>{if(res.success)setMessages(p=>({...p,[`group_${g._id}`]:res.messages}));}); };
  const handleSendMessage = e => { e.preventDefault(); if(!inputMessage.trim()||!activeChat)return; if(activeChat.type==='direct')socket.emit('send_message',{to:activeChat.id,text:inputMessage.trim(),type:'text'},()=>{}); else socket.emit('send_group_message',{groupId:activeChat.id,text:inputMessage.trim(),type:'text'},()=>{}); setInputMessage(''); };
  const handleTyping = () => { if(!activeChat)return; if(activeChat.type==='direct')socket.emit('typing',activeChat.id); else socket.emit('group_typing',activeChat.id); };
  const startEdit = msg => { setEditingMsgId(msg._id||msg.id); setEditText(msg.text); setMsgMenu(null); };
  const submitEdit = e => { e.preventDefault(); if(!editText.trim())return; socket.emit('edit_message',{messageId:editingMsgId,newText:editText.trim()},res=>{if(res.success){setEditingMsgId(null);setEditText('');}}); };
  const deleteMsg = (msg, forAll) => { socket.emit('delete_message',{messageId:msg._id||msg.id,deleteFor:forAll?'all':'me'},()=>{}); setMsgMenu(null); };
  const submitForward = toUsername => { socket.emit('forward_message',{messageId:forwardMsg._id||forwardMsg.id,toUsername},res=>{if(res.success){setShowForwardModal(false);setForwardMsg(null);const c=contacts.find(x=>x.username===toUsername);if(c)openDirectChat(c);}}); };
  const startRecording = async () => { try { const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const mr=new MediaRecorder(stream); mediaRecorderRef.current=mr; audioChunksRef.current=[]; mr.ondataavailable=e=>audioChunksRef.current.push(e.data); mr.onstop=()=>{const blob=new Blob(audioChunksRef.current,{type:'audio/webm'});const r=new FileReader();r.onloadend=()=>{if(activeChat.type==='direct')socket.emit('send_message',{to:activeChat.id,text:'',type:'voice',audioData:r.result},()=>{});else socket.emit('send_group_message',{groupId:activeChat.id,text:'',type:'voice',audioData:r.result},()=>{});};r.readAsDataURL(blob);stream.getTracks().forEach(t=>t.stop());}; mr.start();setIsRecording(true);setRecordingTime(0);recordingTimerRef.current=setInterval(()=>setRecordingTime(t=>t+1),1000); } catch{alert('Нет доступа к микрофону');} };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); clearInterval(recordingTimerRef.current); setIsRecording(false); setRecordingTime(0); };
  const toggleAudio = (id,data) => { if(playingAudio===id){setPlayingAudio(null);return;} setPlayingAudio(id);const a=new Audio(data);a.onended=()=>setPlayingAudio(null);a.play(); };
  const handleReaction = (mid,emoji) => { socket.emit('add_reaction',{messageId:mid,emoji},()=>{}); setHoveredMsg(null); };
  const handleCreateGroup = e => { e.preventDefault(); if(!newGroupName.trim())return; socket.emit('create_group',{name:newGroupName,description:newGroupDesc,members:selectedMembers},res=>{if(res.success){setShowCreateGroup(false);setNewGroupName('');setNewGroupDesc('');setSelectedMembers([]);openGroupChat(res.group);}}); };
  const handleLeaveGroup = () => { if(!confirm('Покинуть группу?'))return; socket.emit('leave_group',activeChat.id,res=>{if(res.success){setGroups(p=>p.filter(g=>g._id!==activeChat.id));setActiveChat(null);setShowGroupInfo(false);}}); };
  const searchAddMember = q => { setAddMemberQuery(q); if(q.length<2){setAddMemberResults([]);return;} socket.emit('search_users',q,res=>{if(res.success)setAddMemberResults(res.results);}); };
  const handleAddMember = u => { socket.emit('group_add_member',{groupId:activeChat.id,username:u},res=>{if(res.success){setGroups(p=>p.map(g=>g._id===activeChat.id?res.group:g));setActiveChat(p=>p?{...p,data:res.group}:p);setAddMemberQuery('');setAddMemberResults([]);}else alert(res.error);}); };
  const loadAdminData = (search='') => { socket.emit('admin_get_stats',res=>{if(res.success)setAdminStats(res.stats);}); socket.emit('admin_get_users',{search},res=>{if(res.success)setAllUsers(res.users);}); socket.emit('admin_get_logs',res=>{if(res.success)setAdminLogs(res.logs);}); };
  const handlePromote = u => { if(!confirm(`Сделать ${u} администратором?`))return; socket.emit('admin_promote_user',u,res=>{if(res.success)loadAdminData(adminSearch);else alert(res.error);}); };
  const handleDemote = u => { if(!confirm(`Разжаловать ${u}?`))return; socket.emit('admin_demote_user',u,res=>{if(res.success)loadAdminData(adminSearch);else alert(res.error);}); };

  const fmtTime = ts => { const d=new Date(ts),n=new Date(); return d.toDateString()===n.toDateString()?d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}); };
  const fmtDur = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const activeChatData = activeChat?.type==='group' ? groups.find(g=>g._id===activeChat?.id)||activeChat?.data : contacts.find(c=>c.username===activeChat?.id)||activeChat?.data;
  const typingKey = activeChat?.type==='group' ? `group_${activeChat.id}` : activeChat?.id;

  // ══════════════════════════════════════════
  //  AUTH SCREEN
  // ══════════════════════════════════════════
  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background:`linear-gradient(135deg, ${T.from}, ${T.via}, ${T.to})`}}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{background:T.via}}></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{background:T.from}}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl" style={{background:T.to}}></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-black tracking-tighter leading-none select-none" style={{
            fontSize: 'clamp(4rem, 15vw, 7rem)',
            background: 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.4) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 2px 40px rgba(255,255,255,0.15))',
            fontFamily: '"Arial Black", "Helvetica Neue", sans-serif',
          }}>Whispr</h1>
          <p className="text-white/40 text-sm tracking-[0.3em] uppercase mt-1 font-light">Messenger</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 space-y-4" style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <h2 className="text-white font-semibold text-lg mb-6">{isRegistering ? 'Создать аккаунт' : 'Войти'}</h2>

          <input type="text" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!isRegistering&&handleLogin(e)}
            className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all placeholder-white/30"
            style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)'}}
            placeholder="username" />

          {isRegistering && <input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-white/30"
            style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)'}}
            placeholder="Ваше имя" />}

          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!isRegistering&&handleLogin(e)}
            className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-white/30"
            style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)'}}
            placeholder="Пароль" />

          {authError && <div className="text-red-300 text-sm px-3 py-2 rounded-lg" style={{background:'rgba(239,68,68,0.15)'}}>{authError}</div>}

          <button onClick={isRegistering ? handleRegister : handleLogin}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{background:`linear-gradient(135deg, ${T.from}, ${T.to})`}}>
            {isRegistering ? 'Зарегистрироваться' : 'Войти'}
          </button>

          <button onClick={()=>{setIsRegistering(!isRegistering);setAuthError('');}} className="w-full text-white/40 text-sm hover:text-white/70 transition-colors py-1">
            {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  //  MAIN APP
  // ══════════════════════════════════════════
  return (
    <div style={{height:'100dvh',display:'flex',position:'relative',overflow:'hidden',background:'#0d0d0f'}}>

      {/* Subtle gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-64 -left-64 w-[500px] h-[500px] rounded-full blur-3xl opacity-[0.07]" style={{background:T.via}}></div>
        <div className="absolute -bottom-64 -right-64 w-[500px] h-[500px] rounded-full blur-3xl opacity-[0.07]" style={{background:T.from}}></div>
      </div>

      {/* ── SIDEBAR ── */}
      <div className={`relative flex-shrink-0 w-72 flex flex-col transition-all duration-300 ${showSidebar ? 'translate-x-0' : '-translate-x-full w-0 overflow-hidden'}`}
        style={{borderRight:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.03)'}}>

        {/* Profile */}
        <div className="px-4 pt-5 pb-4" style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer relative group flex-shrink-0">
              <Avatar username={currentUser?.username} displayName={currentUser?.displayName} avatar={avatars[currentUser?.username]} size="md" />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity">✎</div>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm truncate">{currentUser?.displayName}</div>
              <div className="text-white/30 text-xs truncate">@{currentUser?.username}</div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={()=>setShowSettings(true)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><Palette className="w-4 h-4 text-white/40 hover:text-white/70" /></button>
              {currentUser?.isAdmin && <button onClick={()=>{setShowAdminPanel(true);loadAdminData();}} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><Shield className="w-4 h-4 text-white/40 hover:text-white/70" /></button>}
              <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><LogOut className="w-4 h-4 text-white/40 hover:text-white/70" /></button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 py-3 flex gap-2">
          <button onClick={()=>setShowSearch(true)} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 text-sm hover:text-white/70 transition-colors" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
            <Search className="w-3.5 h-3.5" /><span>Поиск</span>
          </button>
          <button onClick={()=>setShowCreateGroup(true)} className="px-3 py-2 rounded-xl hover:bg-white/8 transition-colors" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}} title="Новая группа">
            <Plus className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
          {contacts.length > 0 && <div className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.15em] px-2 pt-2 pb-1.5">Контакты</div>}
          {contacts.map(c => (
            <div key={c.username} onClick={()=>openDirectChat(c)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group ${activeChat?.type==='direct'&&activeChat.id===c.username ? 'text-white' : 'hover:bg-white/4'}`}
              style={activeChat?.type==='direct'&&activeChat.id===c.username ? {background:`linear-gradient(135deg, ${T.from}30, ${T.to}20)`,border:'1px solid rgba(255,255,255,0.08)'} : {}}>
              <Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm" online={c.isOnline} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/80 truncate">{c.displayName}</div>
                <div className="text-xs text-white/30 truncate">@{c.username}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();handleRemoveContact(c.username);}} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded-lg transition-all flex-shrink-0"><X className="w-3 h-3 text-white/40" /></button>
            </div>
          ))}

          {groups.length > 0 && <div className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.15em] px-2 pt-3 pb-1.5">Группы</div>}
          {groups.map(g => (
            <div key={g._id} onClick={()=>openGroupChat(g)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeChat?.type==='group'&&activeChat.id===g._id ? 'text-white' : 'hover:bg-white/4'}`}
              style={activeChat?.type==='group'&&activeChat.id===g._id ? {background:`linear-gradient(135deg, ${T.from}30, ${T.to}20)`,border:'1px solid rgba(255,255,255,0.08)'} : {}}>
              <GroupAvatar group={g} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/80 truncate">{g.name}</div>
                <div className="text-xs text-white/30">{g.members.length} участников</div>
              </div>
            </div>
          ))}

          {contacts.length===0&&groups.length===0 && <div className="text-center py-12 text-white/20 text-sm">Нажми «Поиск»<br/>чтобы найти людей</div>}
        </div>
      </div>

      {/* ── CHAT ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',position:'relative',minWidth:0}}>
        {activeChat ? (
          <>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4" style={{borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)'}}>
              <button onClick={()=>setShowSidebar(s=>!s)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0">
                <Menu className="w-5 h-5 text-white/40" />
              </button>
              {activeChat.type==='direct'
                ? <Avatar username={activeChatData?.username} displayName={activeChatData?.displayName} avatar={avatars[activeChatData?.username]} size="md" online={activeChatData?.isOnline} />
                : <GroupAvatar group={activeChatData} size="md" />}
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold truncate">{activeChat.type==='direct'?activeChatData?.displayName:activeChatData?.name}</div>
                <div className="text-xs text-white/30">{activeChat.type==='direct'?(activeChatData?.isOnline?<span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>онлайн</span>:'не в сети'):`${activeChatData?.members?.length||0} участников`}</div>
              </div>
              {activeChat.type==='direct'&&activeChatData?.isOnline&&callState==='idle'&&(
                <button onClick={()=>startCall(activeChat.id)} className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0" title="Позвонить">
                  <Phone className="w-5 h-5 text-white/40 hover:text-green-400" />
                </button>
              )}
              {activeChat.type==='group'&&<button onClick={()=>setShowGroupInfo(true)} className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"><Settings className="w-4.5 h-4.5 text-white/40" /></button>}
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'1.25rem 1.5rem',display:'flex',flexDirection:'column',gap:'0.25rem'}}>
              {chatMessages.map(msg => {
                const isOwn = msg.from === currentUser?.username;
                const mid = msg._id || msg.id;
                const reactions = msg.reactions || {};
                const hasR = Object.keys(reactions).some(e=>reactions[e]?.length>0);
                const isEditing = editingMsgId === mid;
                return (
                  <div key={mid} className={`flex items-end gap-2 ${isOwn?'flex-row-reverse':'flex-row'}`}
                    onMouseEnter={()=>{clearTimeout(hoverTimeoutRef.current);setHoveredMsg(mid);}}
                    onMouseLeave={()=>{hoverTimeoutRef.current=setTimeout(()=>setHoveredMsg(null),300);}}>

                    {!isOwn&&activeChat.type==='group'&&<Avatar username={msg.from} displayName={msg.from} avatar={avatars[msg.from]} size="sm" />}

                    <div className="relative max-w-sm">
                      {!isOwn&&activeChat.type==='group'&&<div className="text-xs text-white/30 mb-1 ml-1">{contacts.find(c=>c.username===msg.from)?.displayName||msg.from}</div>}

                      {/* Reaction panel */}
                      {hoveredMsg===mid&&!isEditing&&(
                        <div className={`absolute ${isOwn?'right-0':'left-0'} -top-9 flex gap-0.5 rounded-xl px-1.5 py-1 z-10 shadow-xl`}
                          style={{background:'rgba(15,15,20,0.95)',border:'1px solid rgba(255,255,255,0.08)'}}
                          onMouseEnter={()=>{clearTimeout(hoverTimeoutRef.current);setHoveredMsg(mid);}}
                          onMouseLeave={()=>{hoverTimeoutRef.current=setTimeout(()=>setHoveredMsg(null),300);}}>
                          {EMOJI_LIST.map(e=><button key={e} onClick={()=>handleReaction(mid,e)} className="text-base hover:scale-125 transition-transform px-0.5">{e}</button>)}
                          <button onClick={ev=>{ev.stopPropagation();setMsgMenu({msgId:mid,msg,isOwn});}} className="ml-1 p-1 hover:bg-white/10 rounded-lg"><MoreVertical className="w-3.5 h-3.5 text-white/50" /></button>
                        </div>
                      )}

                      {msg.forwarded&&<div className="text-xs text-white/30 mb-1 flex items-center gap-1"><Forward className="w-3 h-3"/>Переслано от @{msg.forwardedFrom}</div>}

                      {isEditing ? (
                        <form onSubmit={submitEdit} className="flex gap-2 items-center">
                          <input value={editText} onChange={e=>setEditText(e.target.value)} autoFocus className="flex-1 px-3 py-2 rounded-xl text-white text-sm outline-none" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}} />
                          <button type="submit" className="p-2 rounded-lg" style={{background:'rgba(34,197,94,0.2)'}}><Check className="w-4 h-4 text-green-400" /></button>
                          <button type="button" onClick={()=>setEditingMsgId(null)} className="p-2 rounded-lg" style={{background:'rgba(255,255,255,0.05)'}}><X className="w-4 h-4 text-white/50" /></button>
                        </form>
                      ) : (
                        <div className={`rounded-2xl px-4 py-2.5 ${isOwn?'rounded-br-sm':'rounded-bl-sm'}`}
                          style={isOwn
                            ? {background:`linear-gradient(135deg, ${T.from}90, ${T.to}90)`,border:'1px solid rgba(255,255,255,0.1)'}
                            : {background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.06)'}}>
                          {msg.type==='voice'?(
                            <div className="flex items-center gap-3 min-w-36">
                              <button onClick={()=>toggleAudio(mid,msg.audioData)} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'rgba(255,255,255,0.15)'}}>
                                {playingAudio===mid?<Pause className="w-4 h-4 text-white"/>:<Play className="w-4 h-4 text-white"/>}
                              </button>
                              <div className="flex-1 h-0.5 rounded-full" style={{background:'rgba(255,255,255,0.2)'}}><div className="h-full w-1/2 rounded-full" style={{background:'rgba(255,255,255,0.6)'}}></div></div>
                              <Mic className="w-3 h-3 text-white/40 flex-shrink-0" />
                            </div>
                          ):(
                            <div className="text-sm leading-relaxed break-words text-white/90">{msg.text}</div>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {msg.edited&&<span className="text-[10px] text-white/30">ред.</span>}
                            <span className="text-[10px] text-white/30">{fmtTime(msg.timestamp)}</span>
                            {isOwn&&activeChat.type==='direct'&&<span className="text-[10px]">{msg.read?<span className="text-blue-300">✓✓</span>:msg.delivered?<span className="text-white/30">✓✓</span>:<span className="text-white/20">✓</span>}</span>}
                          </div>
                        </div>
                      )}

                      {hasR&&!isEditing&&(
                        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn?'justify-end':'justify-start'}`}>
                          {Object.entries(reactions).filter(([,u])=>u?.length>0).map(([e,u])=>(
                            <button key={e} onClick={()=>handleReaction(mid,e)} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors hover:bg-white/10" style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.08)'}}>
                              {e}<span className="text-white/50">{u.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              {typingUsers[typingKey]&&<div className="text-xs text-white/30 italic px-2 py-1 self-start">{activeChat.type==='group'?`${typingUsers[typingKey]} печатает...`:'печатает...'}</div>}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-4 py-4" style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              {isRecording ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)'}}>
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse flex-shrink-0"></div>
                  <span className="text-white/70 text-sm flex-1">Запись {fmtDur(recordingTime)}</span>
                  <button onClick={stopRecording} className="px-4 py-1.5 rounded-xl text-sm text-red-300 flex items-center gap-2 flex-shrink-0 hover:bg-red-500/20 transition-colors">
                    <MicOff className="w-4 h-4" />Отправить
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input type="text" value={inputMessage} onChange={e=>{setInputMessage(e.target.value);handleTyping();}}
                    className="flex-1 px-4 py-3 rounded-2xl text-white text-sm outline-none placeholder-white/20 min-w-0 transition-all"
                    style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}}
                    placeholder="Напишите сообщение..." />
                  <button type="button" onClick={startRecording} className="p-3 rounded-2xl hover:bg-white/5 transition-colors flex-shrink-0" style={{border:'1px solid rgba(255,255,255,0.07)'}}><Mic className="w-5 h-5 text-white/40" /></button>
                  <button type="submit" className="px-5 py-3 rounded-2xl font-medium text-white text-sm flex items-center gap-2 flex-shrink-0 transition-all hover:opacity-90"
                    style={{background:`linear-gradient(135deg, ${T.from}, ${T.to})`}}>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="text-6xl font-black mb-3 tracking-tighter select-none" style={{background:`linear-gradient(135deg, ${T.from}, ${T.to})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',fontFamily:'"Arial Black", "Helvetica Neue", sans-serif'}}>Whispr</div>
            <p className="text-white/20 text-sm">Выберите чат слева</p>
          </div>
        )}
      </div>

      {/* ══ CONTEXT MENU ══ */}
      {msgMenu&&(
        <div className="fixed z-50 rounded-xl overflow-hidden shadow-2xl w-44" style={{top:220,left:'50%',transform:'translateX(-50%)',background:'rgba(10,10,15,0.97)',border:'1px solid rgba(255,255,255,0.08)'}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>{setForwardMsg(msgMenu.msg);setShowForwardModal(true);setMsgMenu(null);}} className="w-full px-4 py-2.5 text-left text-white/70 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"><Forward className="w-4 h-4 text-blue-400"/>Переслать</button>
          {msgMenu.isOwn&&msgMenu.msg.type!=='voice'&&<button onClick={()=>startEdit(msgMenu.msg)} className="w-full px-4 py-2.5 text-left text-white/70 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"><Pencil className="w-4 h-4 text-yellow-400"/>Редактировать</button>}
          {msgMenu.isOwn&&<button onClick={()=>deleteMsg(msgMenu.msg,true)} className="w-full px-4 py-2.5 text-left text-red-400 text-sm hover:bg-red-500/5 flex items-center gap-3 transition-colors"><Trash2 className="w-4 h-4"/>Удалить у всех</button>}
          <button onClick={()=>deleteMsg(msgMenu.msg,false)} className="w-full px-4 py-2.5 text-left text-white/30 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"><X className="w-4 h-4"/>Удалить у меня</button>
        </div>
      )}

      {/* ══ SETTINGS ══ */}
      {showSettings&&(
        <Modal onClose={()=>setShowSettings(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2"><Palette className="w-5 h-5"/>Настройки</h3>
              <button onClick={()=>setShowSettings(false)} className="p-2 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-white/40"/></button>
            </div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Цветовая тема</p>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(THEMES).map(([key, t]) => (
                <button key={key} onClick={()=>setTheme(key)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${theme===key?'ring-2 ring-white/30':''}`}
                  style={{background:`linear-gradient(135deg, ${t.from}, ${t.to})`,opacity:theme===key?1:0.6}}>
                  {theme===key&&<div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full"></div>}
                  <span className="text-white text-xs font-medium">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ══ FORWARD ══ */}
      {showForwardModal&&(
        <Modal onClose={()=>setShowForwardModal(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-white font-semibold flex items-center gap-2"><Forward className="w-5 h-5"/>Переслать</h3><button onClick={()=>setShowForwardModal(false)} className="p-2 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/40"/></button></div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {contacts.map(c=>(
                <button key={c.username} onClick={()=>submitForward(c.username)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                  <Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm" online={c.isOnline}/>
                  <div className="text-left"><div className="text-white/80 text-sm">{c.displayName}</div><div className="text-white/30 text-xs">@{c.username}</div></div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ══ SEARCH ══ */}
      {showSearch&&(
        <Modal onClose={()=>setShowSearch(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-white font-semibold">Поиск</h3><button onClick={()=>setShowSearch(false)} className="p-2 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-white/40"/></button></div>
            <input type="text" value={searchQuery} onChange={e=>handleSearch(e.target.value)} autoFocus className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-white/30 mb-4" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}} placeholder="Username или имя..."/>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {searchResults.map(u=>(
                <div key={u.username} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{background:'rgba(255,255,255,0.03)'}}>
                  <Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm" online={u.isOnline}/>
                  <div className="flex-1"><div className="text-white/80 text-sm font-medium">{u.displayName}</div><div className="text-white/30 text-xs">@{u.username}</div></div>
                  <button onClick={()=>handleAddContact(u.username)} className="px-3 py-1.5 rounded-lg text-white/70 text-xs flex items-center gap-1.5 hover:bg-white/8 transition-colors" style={{background:'rgba(255,255,255,0.06)'}}><UserPlus className="w-3.5 h-3.5"/>Добавить</button>
                </div>
              ))}
              {searchQuery.length>=2&&searchResults.length===0&&<p className="text-center py-8 text-white/20 text-sm">Ничего не найдено</p>}
              {searchQuery.length<2&&<p className="text-center py-8 text-white/20 text-sm">Введите минимум 2 символа</p>}
            </div>
          </div>
        </Modal>
      )}

      {/* ══ CREATE GROUP ══ */}
      {showCreateGroup&&(
        <Modal onClose={()=>setShowCreateGroup(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-white font-semibold flex items-center gap-2"><Hash className="w-5 h-5"/>Новая группа</h3><button onClick={()=>setShowCreateGroup(false)} className="p-2 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-white/40"/></button></div>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <input type="text" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-white/30" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}} placeholder="Название группы" required/>
              <input type="text" value={newGroupDesc} onChange={e=>setNewGroupDesc(e.target.value)} className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-white/30" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}} placeholder="Описание (необязательно)"/>
              <div>
                <p className="text-white/30 text-xs mb-2">Участники:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {contacts.map(c=>(
                    <label key={c.username} className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-white/4 transition-colors">
                      <input type="checkbox" checked={selectedMembers.includes(c.username)} onChange={e=>setSelectedMembers(p=>e.target.checked?[...p,c.username]:p.filter(u=>u!==c.username))} className="rounded"/>
                      <Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm"/>
                      <span className="text-white/70 text-sm">{c.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90" style={{background:`linear-gradient(135deg, ${T.from}, ${T.to})`}}>Создать</button>
            </form>
          </div>
        </Modal>
      )}

      {/* ══ GROUP INFO ══ */}
      {showGroupInfo&&activeChat?.type==='group'&&(
        <Modal onClose={()=>setShowGroupInfo(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-white font-semibold">{activeChatData?.name}</h3><button onClick={()=>setShowGroupInfo(false)} className="p-2 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-white/40"/></button></div>
            {activeChatData?.description&&<p className="text-white/40 text-sm mb-4">{activeChatData.description}</p>}
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Участники ({activeChatData?.members?.length})</p>
            <div className="space-y-1.5 mb-4">
              {activeChatData?.members?.map(member => {
                const c=contacts.find(x=>x.username===member)||{username:member,displayName:member};
                return (<div key={member} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{background:'rgba(255,255,255,0.03)'}}><Avatar username={member} displayName={c.displayName} avatar={avatars[member]} size="sm"/><div className="flex-1"><div className="text-white/80 text-sm">{c.displayName||member}</div><div className="text-white/30 text-xs">@{member}</div></div>{activeChatData?.admins?.includes(member)&&<Crown className="w-4 h-4 text-yellow-500"/>}</div>);
              })}
            </div>
            {activeChatData?.admins?.includes(currentUser?.username)&&(
              <div className="mb-4">
                <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Добавить участника</p>
                <input type="text" value={addMemberQuery} onChange={e=>searchAddMember(e.target.value)} className="w-full px-4 py-2 rounded-xl text-white text-sm outline-none placeholder-white/30 mb-2" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}} placeholder="Поиск..."/>
                {addMemberResults.filter(u=>!activeChatData.members.includes(u.username)).map(u=>(
                  <div key={u.username} className="flex items-center gap-3 px-3 py-2 rounded-xl mb-1" style={{background:'rgba(255,255,255,0.03)'}}><Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm"/><span className="text-white/70 text-sm flex-1">{u.displayName}</span><button onClick={()=>handleAddMember(u.username)} className="px-2 py-1 rounded-lg text-white/60 text-xs flex items-center gap-1 hover:bg-white/8 transition-colors" style={{background:'rgba(255,255,255,0.06)'}}><UserCheck className="w-3 h-3"/>Добавить</button></div>
                ))}
              </div>
            )}
            <button onClick={handleLeaveGroup} className="w-full py-2.5 rounded-xl text-red-400 text-sm font-medium transition-colors hover:bg-red-500/10" style={{border:'1px solid rgba(239,68,68,0.2)'}}>Покинуть группу</button>
          </div>
        </Modal>
      )}

      {/* ══ ADMIN ══ */}
      {showAdminPanel&&currentUser?.isAdmin&&(
        <Modal onClose={()=>setShowAdminPanel(false)} wide>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-white font-semibold text-lg flex items-center gap-2"><Shield className="w-5 h-5"/>Панель администратора</h3><button onClick={()=>setShowAdminPanel(false)} className="p-2 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-white/40"/></button></div>
            {adminStats&&(<div className="grid grid-cols-6 gap-2 mb-5">{[['Всего',adminStats.totalUsers],['Онлайн',adminStats.onlineUsers],['Сообщ.',adminStats.totalMessages],['Чатов',adminStats.totalChats],['Заблок.',adminStats.blockedUsers],['Групп',adminStats.totalGroups]].map(([l,v])=>(<div key={l} className="p-3 rounded-xl text-center" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}><div className="text-white/30 text-xs">{l}</div><div className="text-xl font-bold text-white">{v}</div></div>))}</div>)}
            <div className="flex gap-2 mb-4">{['users','logs'].map(tab=>(<button key={tab} onClick={()=>setAdminTab(tab)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${adminTab===tab?'text-white':'text-white/40 hover:text-white/60'}`} style={adminTab===tab?{background:`linear-gradient(135deg, ${T.from}40, ${T.to}40)`,border:'1px solid rgba(255,255,255,0.1)'}:{}}>{tab==='users'?<><Users className="w-4 h-4"/>Пользователи</>:<><History className="w-4 h-4"/>История</>}</button>))}</div>
            {adminTab==='users'&&(
              <>
                <input type="text" value={adminSearch} onChange={e=>{setAdminSearch(e.target.value);loadAdminData(e.target.value);}} className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none placeholder-white/30 mb-3" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="🔍 Поиск..."/>
                <div className="space-y-1.5">
                  {allUsers.map(u=>(
                    <div key={u.username} className={`px-4 py-3 rounded-xl flex items-center justify-between ${u.isBlocked?'border border-red-500/20':''}`} style={{background:u.isBlocked?'rgba(239,68,68,0.05)':'rgba(255,255,255,0.03)'}}>
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${u.isOnline?'bg-green-400':'bg-gray-600'}`}></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/80 font-medium text-sm">{u.displayName}</span>
                            {u.isAdmin&&<Crown className="w-3.5 h-3.5 text-yellow-500"/>}
                            {u.isBlocked&&<Ban className="w-3.5 h-3.5 text-red-400"/>}
                          </div>
                          <div className="text-white/30 text-xs">@{u.username} · {u.contactsCount} контактов</div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {/* Блок / Разблок — только для не-главных-админов */}
                        {u.username!=='admin'&&(
                          <button onClick={()=>socket.emit('admin_block_user',{target:u.username,block:!u.isBlocked},res=>{if(res.success)loadAdminData(adminSearch);})}
                            className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${u.isBlocked?'text-green-300':'text-orange-300'}`}
                            style={{background:u.isBlocked?'rgba(34,197,94,0.1)':'rgba(251,146,60,0.1)',border:u.isBlocked?'1px solid rgba(34,197,94,0.2)':'1px solid rgba(251,146,60,0.2)'}}>
                            <Ban className="w-3 h-3"/>{u.isBlocked?'Разблок.':'Блок.'}
                          </button>
                        )}
                        {/* Повысить (только обычные) */}
                        {!u.isAdmin&&(
                          <button onClick={()=>handlePromote(u.username)} className="px-2.5 py-1.5 rounded-lg text-xs text-yellow-300 flex items-center gap-1 transition-colors hover:bg-yellow-500/15" style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.2)'}} title="Сделать админом">
                            <Crown className="w-3 h-3"/>Повысить
                          </button>
                        )}
                        {/* Разжаловать (только назначенные админы, не главный) */}
                        {u.isAdmin&&u.username!=='admin'&&(
                          <button onClick={()=>handleDemote(u.username)} className="px-2.5 py-1.5 rounded-lg text-xs text-orange-300 flex items-center gap-1 transition-colors hover:bg-orange-500/15" style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.2)'}} title="Разжаловать">
                            <Crown className="w-3 h-3"/>Разжаловать
                          </button>
                        )}
                        {/* Удалить */}
                        {u.username!=='admin'&&(
                          <button onClick={()=>{if(confirm(`Удалить ${u.username}?`))socket.emit('admin_delete_user',u.username,res=>{if(res.success)loadAdminData(adminSearch);});}} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" style={{border:'1px solid rgba(239,68,68,0.15)'}}>
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {adminTab==='logs'&&(
              <div className="space-y-1.5">
                {adminLogs.length===0&&<p className="text-center py-10 text-white/20">Нет действий</p>}
                {adminLogs.map((log,i)=>(
                  <div key={i} className="px-4 py-3 rounded-xl flex items-center justify-between" style={{background:'rgba(255,255,255,0.03)'}}>
                    <div><div className="text-white/70 text-sm">{log.details}</div><div className="text-white/25 text-xs mt-0.5">@{log.admin}</div></div>
                    <div className="text-white/25 text-xs flex-shrink-0 ml-4">{fmtTime(log.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ CALLS ══ */}
      {callState==='incoming'&&<IncomingCallOverlay from={callPeer} fromDisplay={contacts.find(c=>c.username===callPeer)?.displayName||callPeer} fromAvatar={avatars[callPeer]} onAccept={acceptCall} onReject={rejectCall}/>}
      {(callState==='calling'||callState==='active')&&<ActiveCallOverlay peer={callPeer} peerDisplay={contacts.find(c=>c.username===callPeer)?.displayName||callPeer} peerAvatar={avatars[callPeer]} duration={callDuration} muted={callMuted} onMute={toggleMute} onEnd={endCall} calling={callState==='calling'} audioRef={remoteAudioRef} remoteStream={remoteStreamRef.current}/>}

      <div style={{position:'fixed',bottom:8,left:'50%',transform:'translateX(-50%)',color:'rgba(255,255,255,0.1)',fontSize:'10px',pointerEvents:'none',whiteSpace:'nowrap',letterSpacing:'0.15em',zIndex:100}}>by Meowlentii</div>
    </div>
  );
}
