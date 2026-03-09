import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Send, Search, UserPlus, LogOut, Shield, Trash2,
  Crown, X, Menu, Mic, MicOff, Play, Pause, Ban, History,
  Plus, UserCheck, Hash, Settings, Phone, PhoneOff, Check,
  MoreVertical, Forward, Pencil, Users, Palette, Camera, AtSign
} from 'lucide-react';

const SERVER_URL = 'https://whispr-server-u5zy.onrender.com';
const EMOJI_LIST = ['❤️','😂','😮','😢','👍','🔥'];

const THEMES = {
  violet: { name: 'Фиолетовый', a: '#7c3aed', b: '#a855f7', c: '#ec4899' },
  blue:   { name: 'Синий',      a: '#1e40af', b: '#3b82f6', c: '#06b6d4' },
  green:  { name: 'Зелёный',    a: '#065f46', b: '#10b981', c: '#34d399' },
  rose:   { name: 'Розовый',    a: '#9f1239', b: '#f43f5e', c: '#fb7185' },
  orange: { name: 'Оранжевый',  a: '#92400e', b: '#f59e0b', c: '#fbbf24' },
  slate:  { name: 'Тёмный',     a: '#1e293b', b: '#475569', c: '#94a3b8' },
};

// ── Particle Canvas ──
function Particles({ theme }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const T = THEMES[theme] || THEMES.violet;
    const colors = [T.a, T.b, T.c];

    particlesRef.current = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.5 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach(p => {
        p.pulse += 0.01;
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(a * 255).toString(16).padStart(2,'0');
        ctx.fill();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animRef.current); };
  }, [theme]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{zIndex:0}} />;
}

// ── Logo ──
function WhisprLogo({ size = 'xl', theme }) {
  const T = THEMES[theme] || THEMES.violet;
  const sizes = { sm:'text-2xl', md:'text-4xl', xl:'text-8xl' };
  return (
    <svg width="0" height="0" style={{position:'absolute'}}>
      <defs>
        <linearGradient id={`lg-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function LogoText({ size = 'xl', sub = false }) {
  const sizes = { sm: 36, md: 52, xl: 96 };
  const fs = sizes[size] || 96;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={fs * 4.5} height={fs * 1.2} viewBox={`0 0 ${fs * 4.5} ${fs * 1.2}`} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,1)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.45)" />
          </linearGradient>
          <filter id="logo-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <text
          x="0" y={fs * 0.95}
          fontFamily='"Arial Black","Helvetica Neue",sans-serif'
          fontWeight="900"
          fontSize={fs}
          fill="url(#logo-grad)"
          filter="url(#logo-glow)"
          letterSpacing="-3"
        >Whispr</text>
      </svg>
      {sub && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '0.35em', paddingTop: 8, textTransform: 'uppercase', fontWeight: 400 }}>MESSENGER</div>}
    </div>
  );
}

function Avatar({ username, displayName, avatar, size = 'md', online }) {
  const sizes = { xs:'w-6 h-6 text-[10px]', sm:'w-8 h-8 text-xs', md:'w-10 h-10 text-sm', lg:'w-14 h-14 text-xl' };
  const dotSizes = { xs:'w-2 h-2', sm:'w-2.5 h-2.5 border', md:'w-3 h-3 border-2', lg:'w-4 h-4 border-2' };
  const colors = ['bg-violet-600','bg-pink-600','bg-teal-600','bg-orange-600','bg-blue-600','bg-emerald-600'];
  const color = colors[(username?.charCodeAt(0)||0) % colors.length];
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center font-bold text-white ${avatar?'':color}`}>
        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span>{(displayName||username||'?')[0].toUpperCase()}</span>}
      </div>
      {online !== undefined && <span className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full border-black/60 ${online?'bg-green-400':'bg-gray-600'}`} />}
    </div>
  );
}

function GroupAvatar({ group, size='md' }) {
  const s = { sm:'w-8 h-8', md:'w-10 h-10', lg:'w-14 h-14' };
  return (
    <div className={`${s[size]} rounded-full flex items-center justify-center text-white bg-gradient-to-br from-violet-600 to-fuchsia-600 flex-shrink-0 overflow-hidden`}>
      {group?.avatar ? <img src={group.avatar} alt="" className="w-full h-full object-cover" /> : <Hash className="w-4 h-4" />}
    </div>
  );
}

function Modal({ onClose, children, wide }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(0,0,0,0.7)',backdropFilter:'blur(12px)',animation:'fadeIn 0.18s ease'}} onClick={onClose}>
      <div className={`w-full ${wide?'max-w-3xl':'max-w-md'} max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl`}
        style={{background:'#111116',border:'1px solid rgba(255,255,255,0.08)',animation:'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)'}}
        onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function IncomingCallOverlay({ from, fromDisplay, fromAvatar, onAccept, onReject }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]" style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(20px)',animation:'fadeIn 0.2s ease'}}>
      <div className="rounded-3xl p-10 text-center w-80 shadow-2xl" style={{background:'#111116',border:'1px solid rgba(255,255,255,0.08)',animation:'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)'}}>
        <div className="mb-5 flex justify-center"><Avatar username={from} displayName={fromDisplay} avatar={fromAvatar} size="lg" /></div>
        <p className="text-white/30 text-[10px] tracking-[0.3em] uppercase mb-1">Входящий звонок</p>
        <p className="text-white text-2xl font-bold mb-8">{fromDisplay||from}</p>
        <div className="flex justify-center gap-10">
          <button onClick={onReject} className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)'}}><PhoneOff className="w-7 h-7 text-red-400"/></button>
          <button onClick={onAccept} className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)'}}><Phone className="w-7 h-7 text-green-400"/></button>
        </div>
      </div>
    </div>
  );
}

function ActiveCallOverlay({ peer, peerDisplay, peerAvatar, duration, muted, onMute, onEnd, calling, audioRef, remoteStream }) {
  const fmt = s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const localRef = useRef(null);
  const resolved = audioRef||localRef;
  useEffect(() => {
    if (!remoteStream) return;
    const el = resolved.current;
    if (!el) return;
    el.srcObject = remoteStream;
    const tryPlay = () => el.play().catch(err => { console.warn('overlay play err', err); setTimeout(tryPlay, 800); });
    tryPlay();
  }, [remoteStream]);
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]" style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(20px)',animation:'fadeIn 0.2s ease'}}>
      <div className="rounded-3xl p-10 text-center w-80 shadow-2xl" style={{background:'#111116',border:'1px solid rgba(255,255,255,0.08)'}}>
        <div className="mb-5 flex justify-center"><Avatar username={peer} displayName={peerDisplay} avatar={peerAvatar} size="lg" /></div>
        <p className="text-white text-2xl font-bold mb-1">{peerDisplay||peer}</p>
        {calling ? <p className="text-white/30 text-sm mb-8 animate-pulse">Вызов...</p> : <p className="text-green-400 text-sm mb-8 font-mono tracking-widest">{fmt(duration)}</p>}
        <div className="flex justify-center gap-6">
          {!calling&&<button onClick={onMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 border ${muted?'border-yellow-500/30 bg-yellow-500/10':'border-white/10 bg-white/5 hover:bg-white/10'}`}>{muted?<MicOff className="w-6 h-6 text-yellow-400"/>:<Mic className="w-6 h-6 text-white/50"/>}</button>}
          <button onClick={onEnd} className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105" style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)'}}><PhoneOff className="w-7 h-7 text-red-400"/></button>
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
  const [authPage, setAuthPage] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [autoLoginDone, setAutoLoginDone] = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(()=>{try{return !!localStorage.getItem('whispr_creds');}catch{return false;}});
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const savedCredsRef = useRef(null);
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');

  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
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
  const pendingIceCandidatesRef = useRef([]);

  // Админ
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState('users');
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');

  // Настройки
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('whispr_theme')||'violet'; } catch { return 'violet'; } });
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const currentUserRef = useRef(null);

  const T = THEMES[theme] || THEMES.violet;
  const getChatKey = c => c?(c.type==='group'?`group_${c.id}`:c.id):null;
  const ICE = {
    iceServers: [
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'},
      {urls:'stun:stun2.l.google.com:19302'},
      {urls:'stun:stun3.l.google.com:19302'},
      {urls:'stun:stun4.l.google.com:19302'},
      {urls:'stun:stun.cloudflare.com:3478'},
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => { try { localStorage.setItem('whispr_theme',theme); } catch {} }, [theme]);

  const cleanupCall = useCallback(() => {
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current=null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t=>t.stop()); localStreamRef.current=null; }
    clearInterval(callTimerRef.current);
    remoteStreamRef.current=null;
    pendingIceCandidatesRef.current=[];
    const a=remoteAudioRef.current; if(a) a.srcObject=null;
    setCallState('idle'); setCallPeer(null); setCallDuration(0); setCallMuted(false);
    callPeerRef.current=null; incomingOfferRef.current=null;
  }, []);

  const startCall = useCallback(async (toUsername) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(ICE);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      pc.ontrack = e => {
        console.log('📞 caller ontrack', e.track.kind, e.streams.length);
        const s = e.streams?.[0] || new MediaStream([e.track]);
        remoteStreamRef.current = s;
        // Try audio element
        const tryPlay = () => { const a=remoteAudioRef.current||document.getElementById('remoteAudio'); if(a){a.srcObject=s;a.play().catch(err=>console.warn('play err',err));} };
        tryPlay(); setTimeout(tryPlay, 500); setTimeout(tryPlay, 1500);
      };
      pc.onicecandidate = e => { if(e.candidate) socketRef.current?.emit('ice_candidate',{to:toUsername,candidate:e.candidate}); };
      pc.onconnectionstatechange = () => { if(['failed','disconnected','closed'].includes(pc.connectionState)) cleanupCall(); };
      const offer = await pc.createOffer({offerToReceiveAudio:true});
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('call_offer',{to:toUsername,offer});
      setCallPeer(toUsername); callPeerRef.current=toUsername; setCallState('calling');
    } catch { alert('Нет доступа к микрофону'); cleanupCall(); }
  }, [cleanupCall]);

  const acceptCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      localStreamRef.current=stream;
      const pc = new RTCPeerConnection(ICE);
      peerConnectionRef.current=pc;
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      pc.ontrack = e => {
        console.log('📞 callee ontrack', e.track.kind, e.streams.length);
        const s = e.streams?.[0] || new MediaStream([e.track]);
        remoteStreamRef.current = s;
        const tryPlay = () => { const a=remoteAudioRef.current||document.getElementById('remoteAudio'); if(a){a.srcObject=s;a.play().catch(err=>console.warn('play err',err));} };
        tryPlay(); setTimeout(tryPlay, 500); setTimeout(tryPlay, 1500);
      };
      pc.onicecandidate = e => { if(e.candidate) socketRef.current?.emit('ice_candidate',{to:callPeerRef.current,candidate:e.candidate}); };
      pc.onconnectionstatechange = () => { if(['failed','disconnected','closed'].includes(pc.connectionState)) cleanupCall(); };
      // IMPORTANT: setRemoteDescription THEN addTracks order matters
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      // flush pending ICE candidates buffered before remoteDescription was set
      const pending = [...pendingIceCandidatesRef.current];
      pendingIceCandidatesRef.current=[];
      for(const cand of pending){try{await pc.addIceCandidate(new RTCIceCandidate(cand));}catch(e){console.warn('pending ICE err',e);}}
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('call_answer',{to:callPeerRef.current,answer});
      setCallState('active');
      callTimerRef.current=setInterval(()=>setCallDuration(d=>d+1),1000);
    } catch { alert('Нет доступа к микрофону'); cleanupCall(); }
  }, [cleanupCall]);

  const rejectCall = useCallback(() => { socketRef.current?.emit('call_reject',{to:callPeerRef.current}); cleanupCall(); },[cleanupCall]);
  const endCall = useCallback(() => { socketRef.current?.emit('call_end',{to:callPeerRef.current}); cleanupCall(); },[cleanupCall]);
  const toggleMute = useCallback(() => { localStreamRef.current?.getAudioTracks().forEach(t=>{t.enabled=!t.enabled;}); setCallMuted(m=>!m); },[]);

  useEffect(() => {
    const s = io(SERVER_URL,{transports:['websocket','polling']});
    setSocket(s); socketRef.current=s;
    s.on('new_message', msg => { const me=currentUserRef.current?.username; const key=msg.from===me?msg.to:msg.from; setMessages(p=>({...p,[key]:[...(p[key]||[]),msg]})); });
    s.on('new_group_message', msg => { const key=`group_${msg.groupId}`; setMessages(p=>({...p,[key]:[...(p[key]||[]),msg]})); });
    s.on('message_edited', ({messageId,newText,edited}) => setMessages(p=>{const u={...p};for(const k of Object.keys(u))u[k]=u[k].map(m=>(m._id===messageId||m.id===messageId)?{...m,text:newText,edited}:m);return u;}));
    s.on('message_deleted', ({messageId}) => setMessages(p=>{const u={...p};for(const k of Object.keys(u))u[k]=u[k].filter(m=>m._id!==messageId&&m.id!==messageId);return u;}));
    s.on('group_created', g => setGroups(p=>p.find(x=>x._id===g._id)?p:[...p,g]));
    s.on('group_updated', g => setGroups(p=>p.map(x=>x._id===g._id?g:x)));
    s.on('user_status_change', ({username,isOnline}) => setContacts(p=>p.map(c=>c.username===username?{...c,isOnline}:c)));
    s.on('user_typing', ({from}) => { setTypingUsers(p=>({...p,[from]:true})); clearTimeout(typingTimeoutRef.current[from]); typingTimeoutRef.current[from]=setTimeout(()=>setTypingUsers(p=>{const n={...p};delete n[from];return n;}),2000); });
    s.on('group_user_typing', ({from,groupId}) => { const k=`group_${groupId}`; setTypingUsers(p=>({...p,[k]:from})); clearTimeout(typingTimeoutRef.current[k]); typingTimeoutRef.current[k]=setTimeout(()=>setTypingUsers(p=>{const n={...p};delete n[k];return n;}),2000); });
    s.on('messages_read', ({by}) => setMessages(p=>p[by]?{...p,[by]:p[by].map(m=>({...m,read:true}))}:p));
    s.on('reaction_updated', ({messageId,reactions}) => setMessages(p=>{const u={...p};for(const k of Object.keys(u))u[k]=u[k].map(m=>(m._id===messageId||m.id===messageId)?{...m,reactions}:m);return u;}));
    s.on('avatar_updated', ({username,avatar}) => setAvatars(p=>({...p,[username]:avatar})));
    s.on('incoming_call', ({from,offer}) => { callPeerRef.current=from; incomingOfferRef.current=offer; setCallPeer(from); setCallState('incoming'); });
    s.on('call_answered', async({answer}) => { try{ const pc=peerConnectionRef.current; if(!pc)return; await pc.setRemoteDescription(new RTCSessionDescription(answer)); // flush pending for(const c of pendingIceCandidatesRef.current){try{await pc.addIceCandidate(new RTCIceCandidate(c));}catch{}} pendingIceCandidatesRef.current=[]; setCallState('active');callTimerRef.current=setInterval(()=>setCallDuration(d=>d+1),1000);}catch(e){console.error('call_answered err',e);} });
    s.on('ice_candidate', async({candidate}) => { try{ const pc=peerConnectionRef.current; if(pc&&pc.remoteDescription&&pc.remoteDescription.type){ await pc.addIceCandidate(new RTCIceCandidate(candidate)); } else { pendingIceCandidatesRef.current.push(candidate); } }catch(e){console.warn('ICE error',e);} });
    s.on('call_ended', ()=>cleanupCall());
    s.on('call_rejected', ()=>{alert('Звонок отклонён');cleanupCall();});
    s.on('call_failed', ({reason})=>{alert(reason);cleanupCall();});
    s.on('force_disconnect', ({reason})=>{alert(reason);handleLogout();});
    return ()=>{s.close();cleanupCall();};
  }, []);

  useEffect(()=>{currentUserRef.current=currentUser;},[currentUser]);

  // Auto-login from saved creds
  useEffect(()=>{
    if(!socket||autoLoginDone)return;
    setAutoLoginDone(true);
    try{
      const saved=localStorage.getItem('whispr_creds');
      if(!saved)return;
      const {u,p}=JSON.parse(saved);
      if(!u||!p)return;
      savedCredsRef.current={u,p};
      socket.emit('login',{username:u,password:p},res=>{
        if(res.success){
          setCurrentUser(res.user);setContacts(res.contacts||[]);setGroups(res.groups||[]);
          const av={};(res.contacts||[]).forEach(c=>{if(c.avatar)av[c.username]=c.avatar;});if(res.user.avatar)av[res.user.username]=res.user.avatar;
          setAvatars(av);setUsername(u);setPassword(p);setIsAuthenticated(true);
        } else { localStorage.removeItem('whispr_creds'); }
        setAutoLoginLoading(false);
      });
    }catch{localStorage.removeItem('whispr_creds');setAutoLoginLoading(false);}
  },[socket,autoLoginDone]);

  const chatKey = getChatKey(activeChat);
  const chatMessages = chatKey?(messages[chatKey]||[]):[];
  const prevMsgCount = useRef(0);
  useEffect(()=>{if(chatMessages.length>prevMsgCount.current)messagesEndRef.current?.scrollIntoView({behavior:'smooth'});prevMsgCount.current=chatMessages.length;},[chatMessages.length]);
  useEffect(()=>{const h=()=>setMsgMenu(null);document.addEventListener('click',h);return()=>document.removeEventListener('click',h);},[]);

  // Плавный переход чата
  useEffect(()=>{if(activeChat){setChatVisible(false);setTimeout(()=>setChatVisible(true),50);}},[activeChat?.id]);

  const handleRegister = e => { e.preventDefault();setAuthError('');socket.emit('register',{username,displayName,password},res=>{if(res.success)handleLogin(e);else setAuthError(res.error);}); };
  const handleLogin = e => { e.preventDefault();setAuthError('');socket.emit('login',{username,password},res=>{if(res.success){try{localStorage.setItem('whispr_creds',JSON.stringify({u:username.toLowerCase(),p:password}));}catch{}setCurrentUser(res.user);setContacts(res.contacts||[]);setGroups(res.groups||[]);const av={};(res.contacts||[]).forEach(c=>{if(c.avatar)av[c.username]=c.avatar;});if(res.user.avatar)av[res.user.username]=res.user.avatar;setAvatars(av);setIsAuthenticated(true);}else setAuthError(res.error);}); };
  const handleLogout = () => { cleanupCall();try{localStorage.removeItem('whispr_creds');}catch{}setIsAuthenticated(false);setCurrentUser(null);setContacts([]);setGroups([]);setActiveChat(null);setMessages({});setUsername('');setPassword('');setDisplayName(''); };

  const handleAvatarUpload = (e, fromSettings=false) => {
    const f=e.target.files[0]; if(!f)return;
    if(f.size>500000){alert('Макс. 500KB');return;}
    const r=new FileReader();
    r.onloadend=()=>{
      if(fromSettings){
        setProfileError('');setSavingProfile(true);
        socket.emit('update_profile',{avatar:r.result},res=>{
          setSavingProfile(false);
          if(res.success){setAvatars(p=>({...p,[currentUser.username]:r.result}));setCurrentUser(p=>({...p,avatar:r.result}));setProfileSuccess('Аватар обновлён!');}
          else setProfileError(res.error);
        });
      } else {
        socket.emit('update_avatar',r.result,res=>{if(res.success){setAvatars(p=>({...p,[currentUser.username]:r.result}));setCurrentUser(p=>({...p,avatar:r.result}));}});
      }
    };
    r.readAsDataURL(f);
  };

  const handleSaveProfile = () => {
    setProfileError('');setProfileSuccess('');setSavingProfile(true);
    const data={};
    if(editDisplayName.trim()&&editDisplayName.trim()!==currentUser.displayName)data.displayName=editDisplayName.trim();
    if(editUsername.trim()&&editUsername.trim()!==currentUser.username)data.newUsername=editUsername.trim();
    if(!Object.keys(data).length){setSavingProfile(false);setProfileSuccess('Нечего менять');return;}
    const currentPassword = savedCredsRef.current?.p || password || (()=>{try{const s=localStorage.getItem('whispr_creds');return s?JSON.parse(s).p:'';}catch{return '';}})();
    socket.emit('update_profile',data,res=>{
      setSavingProfile(false);
      if(res.success){
        setCurrentUser(res.user);
        if(res.user.username!==currentUser.username){
          setActiveChat(null);setMessages({});setContacts([]);
          const savedP=savedCredsRef.current?.p||password||currentPassword;
          try{localStorage.setItem('whispr_creds',JSON.stringify({u:res.user.username,p:savedP}));}catch{}
          socket.emit('login',{username:res.user.username,password:savedP},r2=>{if(r2.success){setContacts(r2.contacts||[]);setGroups(r2.groups||[]);}});
        }
        setProfileSuccess('Профиль обновлён!');
        setEditUsername(res.user.username);
        setEditDisplayName(res.user.displayName);
      } else setProfileError(res.error);
    });
  };

  const handleSearch = q=>{setSearchQuery(q);if(q.length<2){setSearchResults([]);return;}socket.emit('search_users',q,res=>{if(res.success)setSearchResults(res.results);});};
  const handleAddContact = u=>{socket.emit('add_contact',u,res=>{if(res.success){setContacts(p=>[...p,res.contact]);if(res.contact.avatar)setAvatars(p=>({...p,[res.contact.username]:res.contact.avatar}));setSearchResults([]);setSearchQuery('');setShowSearch(false);}});};
  const handleRemoveContact = u=>{if(!confirm(`Удалить ${u}?`))return;socket.emit('remove_contact',u,res=>{if(res.success){setContacts(p=>p.filter(c=>c.username!==u));if(activeChat?.id===u)setActiveChat(null);}});};
  const openDirectChat = c=>{setActiveChat({type:'direct',id:c.username,data:c});setShowSearch(false);socket.emit('load_chat',c.username,res=>{if(res.success)setMessages(p=>({...p,[c.username]:res.messages}));});};
  const openGroupChat = g=>{setActiveChat({type:'group',id:g._id,data:g});socket.emit('load_group_chat',g._id,res=>{if(res.success)setMessages(p=>({...p,[`group_${g._id}`]:res.messages}));});};
  const handleSendMessage = e=>{e.preventDefault();if(!inputMessage.trim()||!activeChat)return;if(activeChat.type==='direct')socket.emit('send_message',{to:activeChat.id,text:inputMessage.trim(),type:'text'},()=>{});else socket.emit('send_group_message',{groupId:activeChat.id,text:inputMessage.trim(),type:'text'},()=>{});setInputMessage('');};
  const handleTyping = ()=>{if(!activeChat)return;if(activeChat.type==='direct')socket.emit('typing',activeChat.id);else socket.emit('group_typing',activeChat.id);};
  const startEdit = msg=>{setEditingMsgId(msg._id||msg.id);setEditText(msg.text);setMsgMenu(null);};
  const submitEdit = e=>{e.preventDefault();if(!editText.trim())return;socket.emit('edit_message',{messageId:editingMsgId,newText:editText.trim()},res=>{if(res.success){setEditingMsgId(null);setEditText('');}});};
  const deleteMsg = (msg,forAll)=>{socket.emit('delete_message',{messageId:msg._id||msg.id,deleteFor:forAll?'all':'me'},()=>{});setMsgMenu(null);};
  const submitForward = to=>{socket.emit('forward_message',{messageId:forwardMsg._id||forwardMsg.id,toUsername:to},res=>{if(res.success){setShowForwardModal(false);setForwardMsg(null);const c=contacts.find(x=>x.username===to);if(c)openDirectChat(c);}});};
  const startRecording = async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const mr=new MediaRecorder(stream);mediaRecorderRef.current=mr;audioChunksRef.current=[];mr.ondataavailable=e=>audioChunksRef.current.push(e.data);mr.onstop=()=>{const blob=new Blob(audioChunksRef.current,{type:'audio/webm'});const r=new FileReader();r.onloadend=()=>{if(activeChat.type==='direct')socket.emit('send_message',{to:activeChat.id,text:'',type:'voice',audioData:r.result},()=>{});else socket.emit('send_group_message',{groupId:activeChat.id,text:'',type:'voice',audioData:r.result},()=>{});};r.readAsDataURL(blob);stream.getTracks().forEach(t=>t.stop());};mr.start();setIsRecording(true);setRecordingTime(0);recordingTimerRef.current=setInterval(()=>setRecordingTime(t=>t+1),1000);}catch{alert('Нет доступа к микрофону');}};
  const stopRecording = ()=>{mediaRecorderRef.current?.stop();clearInterval(recordingTimerRef.current);setIsRecording(false);setRecordingTime(0);};
  const toggleAudio = (id,data)=>{if(playingAudio===id){setPlayingAudio(null);return;}setPlayingAudio(id);const a=new Audio(data);a.onended=()=>setPlayingAudio(null);a.play();};
  const handleReaction = (mid,emoji)=>{socket.emit('add_reaction',{messageId:mid,emoji},()=>{});setHoveredMsg(null);};
  const handleCreateGroup = e=>{e.preventDefault();if(!newGroupName.trim())return;socket.emit('create_group',{name:newGroupName,description:newGroupDesc,members:selectedMembers},res=>{if(res.success){setShowCreateGroup(false);setNewGroupName('');setNewGroupDesc('');setSelectedMembers([]);openGroupChat(res.group);}});};
  const handleLeaveGroup = ()=>{if(!confirm('Покинуть группу?'))return;socket.emit('leave_group',activeChat.id,res=>{if(res.success){setGroups(p=>p.filter(g=>g._id!==activeChat.id));setActiveChat(null);setShowGroupInfo(false);}});};
  const searchAddMember = q=>{setAddMemberQuery(q);if(q.length<2){setAddMemberResults([]);return;}socket.emit('search_users',q,res=>{if(res.success)setAddMemberResults(res.results);});};
  const handleAddMember = u=>{socket.emit('group_add_member',{groupId:activeChat.id,username:u},res=>{if(res.success){setGroups(p=>p.map(g=>g._id===activeChat.id?res.group:g));setActiveChat(p=>p?{...p,data:res.group}:p);setAddMemberQuery('');setAddMemberResults([]);}else alert(res.error);});};
  const loadAdminData = (search='')=>{socket.emit('admin_get_stats',res=>{if(res.success)setAdminStats(res.stats);});socket.emit('admin_get_users',{search},res=>{if(res.success)setAllUsers(res.users);});socket.emit('admin_get_logs',res=>{if(res.success)setAdminLogs(res.logs);});};
  const handlePromote = u=>{if(!confirm(`Сделать ${u} администратором?`))return;socket.emit('admin_promote_user',u,res=>{if(res.success)loadAdminData(adminSearch);else alert(res.error);});};
  const handleDemote = u=>{if(!confirm(`Разжаловать ${u}?`))return;socket.emit('admin_demote_user',u,res=>{if(res.success)loadAdminData(adminSearch);else alert(res.error);});};
  const fmtTime = ts=>{const d=new Date(ts),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});};
  const fmtDur = s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const activeChatData = activeChat?.type==='group'?groups.find(g=>g._id===activeChat?.id)||activeChat?.data:contacts.find(c=>c.username===activeChat?.id)||activeChat?.data;
  const typingKey = activeChat?.type==='group'?`group_${activeChat.id}`:activeChat?.id;

  // ══════════════════════════════════════════
  //  AUTH SCREEN
  // ══════════════════════════════════════════
  if (autoLoginLoading) return (
    <div style={{height:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0e'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
        <LogoText size="md" />
        <div style={{width:32,height:32,border:'2px solid rgba(255,255,255,0.1)',borderTop:'2px solid rgba(255,255,255,0.5)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{background:`linear-gradient(135deg, ${T.a} 0%, ${T.b} 50%, ${T.c} 100%)`}}>
      <Particles theme={theme} />
      {/* Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{zIndex:1}}>
        <div className="absolute -top-48 -left-48 w-96 h-96 rounded-full blur-3xl opacity-25" style={{background:T.b}}></div>
        <div className="absolute -bottom-48 -right-48 w-96 h-96 rounded-full blur-3xl opacity-25" style={{background:T.a}}></div>
      </div>
      <div className="relative w-full max-w-md" style={{zIndex:2}}>
        <div className="text-center mb-10" style={{animation:'logoEntrance 0.8s cubic-bezier(0.34,1.56,0.64,1)'}}>
          <LogoText size="xl" sub={true} />
        </div>
        <div className="rounded-2xl p-8 space-y-4" style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.1)',animation:'slideUp 0.5s cubic-bezier(0.34,1.2,0.64,1) 0.2s both'}}>
          <h2 className="text-white/80 font-semibold text-base mb-2">{isRegistering?'Создать аккаунт':'Войти'}</h2>
          <input type="text" value={username} onChange={e=>setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-white/30 transition-all focus:bg-white/10"
            style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)'}} placeholder="username" />
          {isRegistering&&<input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-white/30 transition-all focus:bg-white/10"
            style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)'}} placeholder="Ваше имя" />}
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-white/30 transition-all focus:bg-white/10"
            style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)'}} placeholder="Пароль" />
          {authError&&<div className="text-red-300 text-sm px-3 py-2 rounded-lg" style={{background:'rgba(239,68,68,0.15)'}}>{authError}</div>}
          <button onClick={isRegistering?handleRegister:handleLogin}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{background:'rgba(0,0,0,0.35)',border:'1px solid rgba(255,255,255,0.2)',backdropFilter:'blur(8px)'}}>
            {isRegistering?'Зарегистрироваться':'Войти'}
          </button>
          <button onClick={()=>{setIsRegistering(!isRegistering);setAuthError('');}} className="w-full text-white/40 text-sm hover:text-white/70 transition-colors py-1">
            {isRegistering?'Уже есть аккаунт? Войти':'Нет аккаунта? Регистрация'}
          </button>
        </div>
        <div className="text-center mt-4" style={{animation:'slideUp 0.5s ease 0.4s both'}}>
          <div className="flex justify-center gap-2 flex-wrap">
            {Object.entries(THEMES).map(([k,t])=>(
              <button key={k} onClick={()=>setTheme(k)}
                className={`w-5 h-5 rounded-full transition-all hover:scale-125 ${theme===k?'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110':''}`}
                style={{background:`linear-gradient(135deg,${t.a},${t.c})`}} title={t.name} />
            ))}
          </div>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  // ══════════════════════════════════════════
  //  MAIN APP
  // ══════════════════════════════════════════
  return (
    <div style={{height:'100dvh',display:'flex',position:'relative',overflow:'hidden',background:'#0a0a0e'}}>
      <Particles theme={theme} />
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{zIndex:0}}>
        <div className="absolute -top-64 -left-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-[0.06]" style={{background:T.b}}></div>
        <div className="absolute -bottom-64 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-[0.06]" style={{background:T.a}}></div>
      </div>

      {/* ── SIDEBAR ── */}
      <div className={`relative flex-shrink-0 w-72 flex flex-col transition-all duration-300 ${showSidebar?'translate-x-0':'w-0 -translate-x-72 overflow-hidden'}`}
        style={{zIndex:2,borderRight:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)'}}>

        {/* Profile */}
        <div className="px-4 pt-5 pb-4" style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer relative group flex-shrink-0">
              <Avatar username={currentUser?.username} displayName={currentUser?.displayName} avatar={avatars[currentUser?.username]} size="md" />
              <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="w-4 h-4 text-white" /></div>
              <input type="file" accept="image/*" onChange={e=>handleAvatarUpload(e,false)} className="hidden" />
            </label>
            <div className="flex-1 min-w-0">
              <div className="text-white/80 font-semibold text-sm truncate">{currentUser?.displayName}</div>
              <div className="text-white/25 text-xs truncate">@{currentUser?.username}</div>
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              <button onClick={()=>{setShowSettings(true);setSettingsTab('account');setEditDisplayName(currentUser?.displayName||'');setEditUsername(currentUser?.username||'');setProfileError('');setProfileSuccess('');}} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Настройки"><Settings className="w-4 h-4 text-white/30 hover:text-white/60" /></button>
              {currentUser?.isAdmin&&<button onClick={()=>{setShowAdminPanel(true);loadAdminData();}} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><Shield className="w-4 h-4 text-white/30 hover:text-white/60" /></button>}
              <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><LogOut className="w-4 h-4 text-white/30 hover:text-white/60" /></button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 py-2.5 flex gap-2">
          <button onClick={()=>setShowSearch(true)} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 text-sm hover:text-white/60 hover:bg-white/4 transition-all" style={{border:'1px solid rgba(255,255,255,0.05)'}}>
            <Search className="w-3.5 h-3.5" /><span>Поиск</span>
          </button>
          <button onClick={()=>setShowCreateGroup(true)} className="px-3 py-2 rounded-xl hover:bg-white/5 transition-colors" style={{border:'1px solid rgba(255,255,255,0.05)'}} title="Новая группа">
            <Plus className="w-4 h-4 text-white/30" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 scrollbar-none">
          {contacts.length>0&&<div className="text-[10px] font-semibold text-white/15 uppercase tracking-[0.2em] px-2 pt-2 pb-1.5">Контакты</div>}
          {contacts.map((c,i)=>(
            <div key={c.username} onClick={()=>openDirectChat(c)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group`}
              style={{
                background:activeChat?.type==='direct'&&activeChat.id===c.username?`linear-gradient(135deg,${T.a}22,${T.c}15)`:undefined,
                border:activeChat?.type==='direct'&&activeChat.id===c.username?'1px solid rgba(255,255,255,0.07)':'1px solid transparent',
                animation:`listItem 0.3s ease ${i*0.04}s both`,
              }}>
              <Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm" online={c.isOnline} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${activeChat?.type==='direct'&&activeChat.id===c.username?'text-white':'text-white/60'}`}>{c.displayName}</div>
                <div className="text-xs text-white/20 truncate">@{c.username}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();handleRemoveContact(c.username);}} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded-lg transition-all flex-shrink-0"><X className="w-3 h-3 text-white/30" /></button>
            </div>
          ))}
          {groups.length>0&&<div className="text-[10px] font-semibold text-white/15 uppercase tracking-[0.2em] px-2 pt-3 pb-1.5">Группы</div>}
          {groups.map((g,i)=>(
            <div key={g._id} onClick={()=>openGroupChat(g)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
              style={{
                background:activeChat?.type==='group'&&activeChat.id===g._id?`linear-gradient(135deg,${T.a}22,${T.c}15)`:undefined,
                border:activeChat?.type==='group'&&activeChat.id===g._id?'1px solid rgba(255,255,255,0.07)':'1px solid transparent',
                animation:`listItem 0.3s ease ${i*0.04}s both`,
              }}>
              <GroupAvatar group={g} size="sm" />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${activeChat?.type==='group'&&activeChat.id===g._id?'text-white':'text-white/60'}`}>{g.name}</div>
                <div className="text-xs text-white/20">{g.members.length} участников</div>
              </div>
            </div>
          ))}
          {contacts.length===0&&groups.length===0&&<div className="text-center py-12 text-white/15 text-sm">Нажми «Поиск»<br/>чтобы найти людей</div>}
        </div>
      </div>

      {/* ── CHAT ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',position:'relative',minWidth:0,zIndex:1}}>
        {activeChat ? (
          <div style={{display:'flex',flexDirection:'column',height:'100%',opacity:chatVisible?1:0,transform:chatVisible?'none':'translateY(8px)',transition:'opacity 0.25s ease, transform 0.25s ease'}}>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4" style={{borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.2)'}}>
              <button onClick={()=>setShowSidebar(s=>!s)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"><Menu className="w-5 h-5 text-white/30" /></button>
              {activeChat.type==='direct'?<Avatar username={activeChatData?.username} displayName={activeChatData?.displayName} avatar={avatars[activeChatData?.username]} size="md" online={activeChatData?.isOnline}/>:<GroupAvatar group={activeChatData} size="md"/>}
              <div className="flex-1 min-w-0">
                <div className="text-white/90 font-semibold truncate">{activeChat.type==='direct'?activeChatData?.displayName:activeChatData?.name}</div>
                <div className="text-xs text-white/25">{activeChat.type==='direct'?(activeChatData?.isOnline?<span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>онлайн</span>:'не в сети'):`${activeChatData?.members?.length||0} участников`}</div>
              </div>
              {activeChat.type==='direct'&&activeChatData?.isOnline&&callState==='idle'&&(
                <button onClick={()=>startCall(activeChat.id)} className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"><Phone className="w-5 h-5 text-white/30 hover:text-green-400 transition-colors" /></button>
              )}
              {activeChat.type==='group'&&<button onClick={()=>setShowGroupInfo(true)} className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"><Settings className="w-4 h-4 text-white/30" /></button>}
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'1.25rem 1.5rem',display:'flex',flexDirection:'column',gap:'0.25rem'}}>
              {chatMessages.map((msg,idx)=>{
                const isOwn=msg.from===currentUser?.username;
                const mid=msg._id||msg.id;
                const reactions=msg.reactions||{};
                const hasR=Object.keys(reactions).some(e=>reactions[e]?.length>0);
                const isEditing=editingMsgId===mid;
                return (
                  <div key={mid} className={`flex items-end gap-2 ${isOwn?'flex-row-reverse':'flex-row'}`}
                    style={{animation:`msgIn 0.2s ease ${Math.min(idx,20)*0.015}s both`}}
                    onMouseEnter={()=>{clearTimeout(hoverTimeoutRef.current);setHoveredMsg(mid);}}
                    onMouseLeave={()=>{hoverTimeoutRef.current=setTimeout(()=>setHoveredMsg(null),300);}}>
                    {!isOwn&&activeChat.type==='group'&&<Avatar username={msg.from} displayName={msg.from} avatar={avatars[msg.from]} size="sm"/>}
                    <div className="relative max-w-sm">
                      {!isOwn&&activeChat.type==='group'&&<div className="text-xs text-white/25 mb-1 ml-1">{contacts.find(c=>c.username===msg.from)?.displayName||msg.from}</div>}
                      {hoveredMsg===mid&&!isEditing&&(
                        <div className={`absolute ${isOwn?'right-0':'left-0'} -top-9 flex gap-0.5 rounded-xl px-1.5 py-1 z-10 shadow-xl`}
                          style={{background:'rgba(8,8,14,0.97)',border:'1px solid rgba(255,255,255,0.07)',animation:'popIn 0.15s cubic-bezier(0.34,1.56,0.64,1)'}}
                          onMouseEnter={()=>{clearTimeout(hoverTimeoutRef.current);setHoveredMsg(mid);}}
                          onMouseLeave={()=>{hoverTimeoutRef.current=setTimeout(()=>setHoveredMsg(null),300);}}>
                          {EMOJI_LIST.map(e=><button key={e} onClick={()=>handleReaction(mid,e)} className="text-base hover:scale-125 transition-transform px-0.5">{e}</button>)}
                          <button onClick={ev=>{ev.stopPropagation();setMsgMenu({msgId:mid,msg,isOwn});}} className="ml-1 p-1 hover:bg-white/8 rounded-lg transition-colors"><MoreVertical className="w-3.5 h-3.5 text-white/40"/></button>
                        </div>
                      )}
                      {msg.forwarded&&<div className="text-xs text-white/25 mb-1 flex items-center gap-1"><Forward className="w-3 h-3"/>Переслано от @{msg.forwardedFrom}</div>}
                      {isEditing?(
                        <form onSubmit={submitEdit} className="flex gap-2 items-center">
                          <input value={editText} onChange={e=>setEditText(e.target.value)} autoFocus className="flex-1 px-3 py-2 rounded-xl text-white text-sm outline-none" style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)'}}/>
                          <button type="submit" className="p-2 rounded-lg" style={{background:'rgba(34,197,94,0.15)'}}><Check className="w-4 h-4 text-green-400"/></button>
                          <button type="button" onClick={()=>setEditingMsgId(null)} className="p-2 rounded-lg" style={{background:'rgba(255,255,255,0.05)'}}><X className="w-4 h-4 text-white/40"/></button>
                        </form>
                      ):(
                        <div className={`rounded-2xl px-4 py-2.5 ${isOwn?'rounded-br-sm':'rounded-bl-sm'} transition-all`}
                          style={isOwn?{background:`linear-gradient(135deg,${T.a}cc,${T.b}cc)`,border:'1px solid rgba(255,255,255,0.08)'}:{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.05)'}}>
                          {msg.type==='voice'?(
                            <div className="flex items-center gap-3 min-w-36">
                              <button onClick={()=>toggleAudio(mid,msg.audioData)} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-105" style={{background:'rgba(255,255,255,0.15)'}}>
                                {playingAudio===mid?<Pause className="w-4 h-4 text-white"/>:<Play className="w-4 h-4 text-white"/>}
                              </button>
                              <div className="flex-1 h-0.5 rounded-full" style={{background:'rgba(255,255,255,0.15)'}}><div className="h-full w-1/2 rounded-full" style={{background:'rgba(255,255,255,0.5)'}}></div></div>
                              <Mic className="w-3 h-3 text-white/30 flex-shrink-0"/>
                            </div>
                          ):(
                            <div style={{color:"rgba(255,255,255,0.92)",fontSize:"14px",lineHeight:"1.5",wordBreak:"word-break"}}>{msg.text}</div>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {msg.edited&&<span className="text-[10px] text-white/25">ред.</span>}
                            <span className="text-[10px] text-white/25">{fmtTime(msg.timestamp)}</span>
                            {isOwn&&activeChat.type==='direct'&&<span className="text-[10px]">{msg.read?<span className="text-blue-300/70">✓✓</span>:msg.delivered?<span className="text-white/25">✓✓</span>:<span className="text-white/15">✓</span>}</span>}
                          </div>
                        </div>
                      )}
                      {hasR&&!isEditing&&(
                        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn?'justify-end':'justify-start'}`}>
                          {Object.entries(reactions).filter(([,u])=>u?.length>0).map(([e,u])=>(
                            <button key={e} onClick={()=>handleReaction(mid,e)} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all hover:scale-105" style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.07)'}}>
                              {e}<span className="text-white/40">{u.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef}/>
              {typingUsers[typingKey]&&<div className="text-xs text-white/25 italic px-2 py-0.5 self-start" style={{animation:'fadeIn 0.2s ease'}}>{activeChat.type==='group'?`${typingUsers[typingKey]} печатает...`:'печатает...'}</div>}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-4 py-4" style={{borderTop:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.15)'}}>
              {isRecording?(
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',animation:'fadeIn 0.2s ease'}}>
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse flex-shrink-0"></div>
                  <span className="text-white/50 text-sm flex-1">Запись {fmtDur(recordingTime)}</span>
                  <button onClick={stopRecording} className="px-3 py-1.5 rounded-xl text-sm text-red-300/80 flex items-center gap-2 hover:bg-red-500/15 transition-colors flex-shrink-0"><MicOff className="w-4 h-4"/>Отправить</button>
                </div>
              ):(
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input type="text" value={inputMessage} onChange={e=>{setInputMessage(e.target.value);handleTyping();}}
                    className="flex-1 px-4 py-3 rounded-2xl text-white/90 text-sm outline-none placeholder-white/15 min-w-0 transition-all"
                    style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}
                    placeholder="Напишите сообщение..."/>
                  <button type="button" onClick={startRecording} className="p-3 rounded-2xl hover:bg-white/5 transition-colors flex-shrink-0" style={{border:'1px solid rgba(255,255,255,0.06)'}}><Mic className="w-5 h-5 text-white/25"/></button>
                  <button type="submit" className="px-5 py-3 rounded-2xl font-medium text-white text-sm flex items-center gap-2 flex-shrink-0 transition-all hover:opacity-85 active:scale-95"
                    style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}><Send className="w-4 h-4"/></button>
                </form>
              )}
            </div>
          </div>
        ):(
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{animation:'fadeIn 0.4s ease'}}>
            <div className="mb-4" style={{animation:'logoEntrance 0.6s cubic-bezier(0.34,1.3,0.64,1)'}}>
              <LogoText size="xl" />
            </div>
            <p className="text-white/15 text-sm mt-2">Выберите чат</p>
          </div>
        )}
      </div>

      {/* ══ CONTEXT MENU ══ */}
      {msgMenu&&(
        <div className="fixed z-50 rounded-xl overflow-hidden shadow-2xl w-44" style={{top:220,left:'50%',transform:'translateX(-50%)',background:'rgba(8,8,14,0.97)',border:'1px solid rgba(255,255,255,0.07)',animation:'popIn 0.15s ease'}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>{setForwardMsg(msgMenu.msg);setShowForwardModal(true);setMsgMenu(null);}} className="w-full px-4 py-2.5 text-left text-white/60 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"><Forward className="w-4 h-4 text-blue-400"/>Переслать</button>
          {msgMenu.isOwn&&msgMenu.msg.type!=='voice'&&<button onClick={()=>startEdit(msgMenu.msg)} className="w-full px-4 py-2.5 text-left text-white/60 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"><Pencil className="w-4 h-4 text-yellow-400"/>Редактировать</button>}
          {msgMenu.isOwn&&<button onClick={()=>deleteMsg(msgMenu.msg,true)} className="w-full px-4 py-2.5 text-left text-red-400/80 text-sm hover:bg-red-500/5 flex items-center gap-3 transition-colors"><Trash2 className="w-4 h-4"/>Удалить у всех</button>}
          <button onClick={()=>deleteMsg(msgMenu.msg,false)} className="w-full px-4 py-2.5 text-left text-white/25 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"><X className="w-4 h-4"/>Удалить у меня</button>
        </div>
      )}

      {/* ══ SETTINGS ══ */}
      {showSettings&&(
        <Modal onClose={()=>setShowSettings(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white/80 font-semibold text-base flex items-center gap-2"><Settings className="w-4 h-4"/>Настройки</h3>
              <button onClick={()=>setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button>
            </div>
            {/* Tabs */}
            <div className="flex gap-2 mb-5">
              {[['account','Аккаунт'],['theme','Тема']].map(([k,l])=>(
                <button key={k} onClick={()=>setSettingsTab(k)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${settingsTab===k?'text-white':'text-white/30 hover:text-white/60'}`}
                  style={settingsTab===k?{background:`linear-gradient(135deg,${T.a}40,${T.b}30)`,border:'1px solid rgba(255,255,255,0.08)'}:{}}>{l}</button>
              ))}
            </div>

            {settingsTab==='account'&&(
              <div className="space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative group flex-shrink-0">
                    <Avatar username={currentUser?.username} displayName={currentUser?.displayName} avatar={avatars[currentUser?.username]} size="lg"/>
                    <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                      <Camera className="w-5 h-5 text-white"/>
                      <input type="file" accept="image/*" onChange={e=>handleAvatarUpload(e,true)} className="hidden"/>
                    </label>
                  </div>
                  <div>
                    <div className="text-white/70 font-semibold">{currentUser?.displayName}</div>
                    <div className="text-white/25 text-sm">@{currentUser?.username}</div>
                    <div className="text-white/20 text-xs mt-1">Нажми на аватар чтобы сменить</div>
                  </div>
                </div>
                {/* Display name */}
                <div>
                  <label className="text-white/30 text-xs uppercase tracking-widest mb-1.5 block">Отображаемое имя</label>
                  <input type="text" value={editDisplayName} onChange={e=>setEditDisplayName(e.target.value)} maxLength={30}
                    className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20 transition-all"
                    style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}
                    placeholder="Ваше имя"/>
                </div>
                {/* Username */}
                <div>
                  <label className="text-white/30 text-xs uppercase tracking-widest mb-1.5 block">Username</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"/>
                    <input type="text" value={editUsername} onChange={e=>setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} maxLength={20}
                      className="w-full pl-9 pr-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20 transition-all"
                      style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}
                      placeholder="username"/>
                  </div>
                  <div className="text-white/15 text-xs mt-1">3–20 символов: буквы, цифры, _</div>
                </div>
                {profileError&&<div className="text-red-300 text-sm px-3 py-2 rounded-lg" style={{background:'rgba(239,68,68,0.1)'}}>{profileError}</div>}
                {profileSuccess&&<div className="text-green-300 text-sm px-3 py-2 rounded-lg" style={{background:'rgba(34,197,94,0.1)'}}>{profileSuccess}</div>}
                <button onClick={handleSaveProfile} disabled={savingProfile}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                  style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>
                  {savingProfile?'Сохраняем...':'Сохранить изменения'}
                </button>
              </div>
            )}

            {settingsTab==='theme'&&(
              <div>
                <p className="text-white/20 text-xs uppercase tracking-widest mb-4">Выберите цвет интерфейса</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(THEMES).map(([k,t])=>(
                    <button key={k} onClick={()=>setTheme(k)}
                      className={`relative flex items-center gap-3 p-4 rounded-xl transition-all hover:scale-[1.02] ${theme===k?'ring-1 ring-white/20':''}`}
                      style={{background:`linear-gradient(135deg,${t.a}88,${t.b}66)`,border:theme===k?'1px solid rgba(255,255,255,0.15)':'1px solid rgba(255,255,255,0.05)'}}>
                      {theme===k&&<div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full"></div>}
                      <div className="w-8 h-8 rounded-full flex-shrink-0" style={{background:`linear-gradient(135deg,${t.a},${t.c})`}}></div>
                      <span className="text-white/80 text-sm font-medium">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ FORWARD ══ */}
      {showForwardModal&&(
        <Modal onClose={()=>setShowForwardModal(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-white/70 font-semibold flex items-center gap-2"><Forward className="w-4 h-4"/>Переслать</h3><button onClick={()=>setShowForwardModal(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button></div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {contacts.map(c=>(
                <button key={c.username} onClick={()=>submitForward(c.username)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                  <Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm" online={c.isOnline}/>
                  <div className="text-left"><div className="text-white/70 text-sm">{c.displayName}</div><div className="text-white/25 text-xs">@{c.username}</div></div>
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
            <div className="flex items-center justify-between mb-4"><h3 className="text-white/70 font-semibold">Поиск</h3><button onClick={()=>setShowSearch(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button></div>
            <input type="text" value={searchQuery} onChange={e=>handleSearch(e.target.value)} autoFocus className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20 mb-4" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Username или имя..."/>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {searchResults.map(u=>(
                <div key={u.username} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{background:'rgba(255,255,255,0.03)'}}>
                  <Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm" online={u.isOnline}/>
                  <div className="flex-1"><div className="text-white/70 text-sm font-medium">{u.displayName}</div><div className="text-white/25 text-xs">@{u.username}</div></div>
                  <button onClick={()=>handleAddContact(u.username)} className="px-3 py-1.5 rounded-lg text-white/50 text-xs flex items-center gap-1.5 hover:bg-white/8 transition-colors" style={{background:'rgba(255,255,255,0.05)'}}><UserPlus className="w-3.5 h-3.5"/>Добавить</button>
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
            <div className="flex items-center justify-between mb-4"><h3 className="text-white/70 font-semibold flex items-center gap-2"><Hash className="w-4 h-4"/>Новая группа</h3><button onClick={()=>setShowCreateGroup(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button></div>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <input type="text" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Название группы" required/>
              <input type="text" value={newGroupDesc} onChange={e=>setNewGroupDesc(e.target.value)} className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Описание"/>
              <div><p className="text-white/20 text-xs mb-2">Участники:</p><div className="space-y-1 max-h-40 overflow-y-auto">{contacts.map(c=>(<label key={c.username} className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-white/4 transition-colors"><input type="checkbox" checked={selectedMembers.includes(c.username)} onChange={e=>setSelectedMembers(p=>e.target.checked?[...p,c.username]:p.filter(u=>u!==c.username))}/><Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm"/><span className="text-white/60 text-sm">{c.displayName}</span></label>))}</div></div>
              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>Создать</button>
            </form>
          </div>
        </Modal>
      )}

      {/* ══ GROUP INFO ══ */}
      {showGroupInfo&&activeChat?.type==='group'&&(
        <Modal onClose={()=>setShowGroupInfo(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-white/70 font-semibold">{activeChatData?.name}</h3><button onClick={()=>setShowGroupInfo(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button></div>
            {activeChatData?.description&&<p className="text-white/30 text-sm mb-4">{activeChatData.description}</p>}
            <p className="text-[10px] text-white/15 uppercase tracking-widest mb-3">Участники ({activeChatData?.members?.length})</p>
            <div className="space-y-1.5 mb-4">{activeChatData?.members?.map(m=>{const c=contacts.find(x=>x.username===m)||{username:m,displayName:m};return(<div key={m} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{background:'rgba(255,255,255,0.03)'}}><Avatar username={m} displayName={c.displayName} avatar={avatars[m]} size="sm"/><div className="flex-1"><div className="text-white/70 text-sm">{c.displayName||m}</div><div className="text-white/25 text-xs">@{m}</div></div>{activeChatData?.admins?.includes(m)&&<Crown className="w-3.5 h-3.5 text-yellow-500"/>}</div>);})}</div>
            {activeChatData?.admins?.includes(currentUser?.username)&&(<div className="mb-4"><input type="text" value={addMemberQuery} onChange={e=>searchAddMember(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-white/70 text-sm outline-none placeholder-white/20 mb-2" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Добавить участника..."/>{addMemberResults.filter(u=>!activeChatData.members.includes(u.username)).map(u=>(<div key={u.username} className="flex items-center gap-3 px-3 py-2 rounded-xl mb-1" style={{background:'rgba(255,255,255,0.03)'}}><Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm"/><span className="text-white/60 text-sm flex-1">{u.displayName}</span><button onClick={()=>handleAddMember(u.username)} className="px-2 py-1 rounded-lg text-white/50 text-xs flex items-center gap-1 hover:bg-white/8" style={{background:'rgba(255,255,255,0.05)'}}><UserCheck className="w-3 h-3"/>Добавить</button></div>))}</div>)}
            <button onClick={handleLeaveGroup} className="w-full py-2.5 rounded-xl text-red-400/70 text-sm font-medium hover:bg-red-500/8 transition-colors" style={{border:'1px solid rgba(239,68,68,0.15)'}}>Покинуть группу</button>
          </div>
        </Modal>
      )}

      {/* ══ ADMIN ══ */}
      {showAdminPanel&&currentUser?.isAdmin&&(
        <Modal onClose={()=>setShowAdminPanel(false)} wide>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-white/80 font-semibold text-base flex items-center gap-2"><Shield className="w-4 h-4"/>Панель администратора</h3><button onClick={()=>setShowAdminPanel(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button></div>
            {adminStats&&<div className="grid grid-cols-6 gap-2 mb-5">{[['Всего',adminStats.totalUsers],['Онлайн',adminStats.onlineUsers],['Сообщ.',adminStats.totalMessages],['Чатов',adminStats.totalChats],['Заблок.',adminStats.blockedUsers],['Групп',adminStats.totalGroups]].map(([l,v])=>(<div key={l} className="p-3 rounded-xl text-center" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.05)'}}><div className="text-white/25 text-xs">{l}</div><div className="text-xl font-bold text-white/80">{v}</div></div>))}</div>}
            <div className="flex gap-2 mb-4">{['users','logs'].map(t=>(<button key={t} onClick={()=>setAdminTab(t)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${adminTab===t?'text-white/80':'text-white/25 hover:text-white/50'}`} style={adminTab===t?{background:`linear-gradient(135deg,${T.a}30,${T.b}20)`,border:'1px solid rgba(255,255,255,0.07)'}:{}}>{t==='users'?<><Users className="w-4 h-4"/>Пользователи</>:<><History className="w-4 h-4"/>История</>}</button>))}</div>
            {adminTab==='users'&&(
              <><input type="text" value={adminSearch} onChange={e=>{setAdminSearch(e.target.value);loadAdminData(e.target.value);}} className="w-full px-4 py-2.5 rounded-xl text-white/70 text-sm outline-none placeholder-white/20 mb-3" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}} placeholder="🔍 Поиск..."/>
              <div className="space-y-1.5">{allUsers.map(u=>(
                <div key={u.username} className="px-4 py-3 rounded-xl flex items-center justify-between" style={{background:u.isBlocked?'rgba(239,68,68,0.04)':'rgba(255,255,255,0.02)',border:u.isBlocked?'1px solid rgba(239,68,68,0.1)':'1px solid rgba(255,255,255,0.04)'}}>
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${u.isOnline?'bg-green-400':'bg-gray-700'}`}></div>
                    <div><div className="flex items-center gap-2"><span className="text-white/70 font-medium text-sm">{u.displayName}</span>{u.isAdmin&&<Crown className="w-3.5 h-3.5 text-yellow-500"/>}{u.isBlocked&&<Ban className="w-3.5 h-3.5 text-red-400"/>}</div><div className="text-white/25 text-xs">@{u.username}</div></div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {u.username!=='admin'&&<button onClick={()=>socket.emit('admin_block_user',{target:u.username,block:!u.isBlocked},res=>{if(res.success)loadAdminData(adminSearch);})} className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${u.isBlocked?'text-green-300':'text-orange-300'}`} style={{background:u.isBlocked?'rgba(34,197,94,0.08)':'rgba(251,146,60,0.08)',border:u.isBlocked?'1px solid rgba(34,197,94,0.15)':'1px solid rgba(251,146,60,0.15)'}}><Ban className="w-3 h-3"/>{u.isBlocked?'Разблок.':'Блок.'}</button>}
                    {!u.isAdmin&&<button onClick={()=>handlePromote(u.username)} className="px-2.5 py-1.5 rounded-lg text-xs text-yellow-300 flex items-center gap-1 hover:bg-yellow-500/10 transition-colors" style={{background:'rgba(234,179,8,0.06)',border:'1px solid rgba(234,179,8,0.15)'}}><Crown className="w-3 h-3"/>Повысить</button>}
                    {u.isAdmin&&u.username!=='admin'&&<button onClick={()=>handleDemote(u.username)} className="px-2.5 py-1.5 rounded-lg text-xs text-orange-300 flex items-center gap-1 hover:bg-orange-500/10 transition-colors" style={{background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.15)'}}><Crown className="w-3 h-3"/>Разжаловать</button>}
                    {u.username!=='admin'&&<button onClick={()=>{if(confirm(`Удалить ${u.username}?`))socket.emit('admin_delete_user',u.username,res=>{if(res.success)loadAdminData(adminSearch);});}} className="p-1.5 rounded-lg text-red-400/70 hover:bg-red-500/8 transition-colors" style={{border:'1px solid rgba(239,68,68,0.1)'}}><Trash2 className="w-3.5 h-3.5"/></button>}
                  </div>
                </div>
              ))}</div></>
            )}
            {adminTab==='logs'&&<div className="space-y-1.5">{adminLogs.length===0&&<p className="text-center py-10 text-white/15">Нет действий</p>}{adminLogs.map((log,i)=>(<div key={i} className="px-4 py-3 rounded-xl flex items-center justify-between" style={{background:'rgba(255,255,255,0.02)'}}><div><div className="text-white/60 text-sm">{log.details}</div><div className="text-white/20 text-xs mt-0.5">@{log.admin}</div></div><div className="text-white/20 text-xs flex-shrink-0 ml-4">{fmtTime(log.timestamp)}</div></div>))}</div>}
          </div>
        </Modal>
      )}

      {/* ══ CALLS ══ */}
      {callState==='incoming'&&<IncomingCallOverlay from={callPeer} fromDisplay={contacts.find(c=>c.username===callPeer)?.displayName||callPeer} fromAvatar={avatars[callPeer]} onAccept={acceptCall} onReject={rejectCall}/>}
      {(callState==='calling'||callState==='active')&&<ActiveCallOverlay peer={callPeer} peerDisplay={contacts.find(c=>c.username===callPeer)?.displayName||callPeer} peerAvatar={avatars[callPeer]} duration={callDuration} muted={callMuted} onMute={toggleMute} onEnd={endCall} calling={callState==='calling'} audioRef={remoteAudioRef} remoteStream={remoteStreamRef.current}/>}

      <div style={{position:'fixed',bottom:8,left:'50%',transform:'translateX(-50%)',color:'rgba(255,255,255,0.07)',fontSize:'10px',pointerEvents:'none',letterSpacing:'0.15em',zIndex:100}}>by Meowlentii</div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes logoEntrance { from{opacity:0;transform:translateY(-16px) scale(0.92)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes popIn { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
  @keyframes listItem { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes msgIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px}
  input::placeholder{transition:opacity 0.2s} input:focus::placeholder{opacity:0.4}
`;
