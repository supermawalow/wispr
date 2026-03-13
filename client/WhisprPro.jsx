import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Send, Search, UserPlus, LogOut, Shield, Trash2,
  Crown, X, Menu, Mic, MicOff, Play, Pause, Ban, History,
  Plus, UserCheck, Hash, Settings, Phone, PhoneOff, Check,
  MoreVertical, Forward, Pencil, Users, Palette, Camera, AtSign,
  Pin, PinOff, Eye, EyeOff, Clock, Info, MessageSquare,
  Radio, Video, VideoOff, PhoneMissed, PhoneIncoming, PhoneCall, Tv2, CornerUpLeft, Reply, Paperclip, FileText, Download, Globe
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
  const W = fs * 4.8;
  const H = fs * 1.25;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
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
          x={W / 2} y={fs * 0.95}
          textAnchor="middle"
          fontFamily='"Arial Black","Helvetica Neue",sans-serif'
          fontWeight="900"
          fontSize={fs}
          fill="url(#logo-grad)"
          filter="url(#logo-glow)"
          letterSpacing="-2"
        >Whispr</text>
      </svg>
      {sub && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '0.35em', marginTop: 6, textTransform: 'uppercase', fontWeight: 400 }}>MESSENGER</div>}
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
    <div className="fixed inset-0 flex items-center justify-center z-[200]" style={{background:'rgba(0,0,0,0.88)',backdropFilter:'blur(24px)',animation:'fadeIn 0.2s ease'}}>
      <div className="rounded-3xl p-10 text-center w-80 shadow-2xl" style={{background:'rgba(14,14,20,0.98)',border:'1px solid rgba(255,255,255,0.09)',animation:'slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1)'}}>
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

function ActiveCallOverlay({ peer, peerDisplay, peerAvatar, duration, muted, onMute, onEnd, calling, localStream, remoteStream, callType }) {
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const isVideo = callType === 'video';
  const localVidRef  = useRef(null);
  const remoteVidRef = useRef(null);
  const audioRef     = useRef(null);

  // Подключить локальный поток (своя камера) — только muted
  useEffect(() => {
    if (localVidRef.current && localStream && isVideo) {
      localVidRef.current.srcObject = localStream;
      localVidRef.current.play().catch(()=>{ /* autoplay */ });
    }
  }, [localStream, isVideo]);

  // Подключить удалённый поток (собеседник) — видео + аудио
  useEffect(() => {
    if (!remoteStream) return;
    if (audioRef.current) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(()=>{ /* autoplay */ });
    }
    if (remoteVidRef.current && isVideo) {
      remoteVidRef.current.srcObject = remoteStream;
      remoteVidRef.current.play().catch(()=>{ /* autoplay */ });
    }
  }, [remoteStream, isVideo]);

  if (isVideo) {
    return (
      <div className="fixed inset-0 z-[200]" style={{background:'#000',animation:'fadeIn 0.2s ease'}}>
        {/* Remote — fullscreen */}
        <video ref={remoteVidRef} autoPlay playsInline muted={false}
          className="absolute inset-0 w-full h-full object-cover"
          style={{background:'#0a0a0a'}}/>
        {/* Local — PiP top-right */}
        <video ref={localVidRef} autoPlay playsInline muted
          className="absolute rounded-2xl object-cover"
          style={{top:16,right:16,width:120,height:160,zIndex:10,
            border:'2px solid rgba(255,255,255,0.25)',
            boxShadow:'0 4px 24px rgba(0,0,0,0.8)',
            background:'#1a1a1a'}}/>
        {/* Controls */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center" style={{zIndex:20}}>
          <div className="flex flex-col items-center gap-3 px-8 py-5 rounded-3xl"
            style={{background:'rgba(0,0,0,0.65)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.1)'}}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <Avatar username={peer} displayName={peerDisplay} avatar={peerAvatar} size="sm"/>
              </div>
              <div className="text-left">
                <p className="text-white font-semibold text-sm leading-tight">{peerDisplay||peer}</p>
                <p className={`text-xs font-mono ${calling?'text-white/40 animate-pulse':'text-green-400'}`}>
                  {calling?'Подключение...':fmt(duration)}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              {!calling&&(
                <button onClick={onMute}
                  className={`w-13 h-13 w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${muted?'border border-yellow-500/50':'border border-white/15'}`}
                  style={{background:muted?'rgba(234,179,8,0.2)':'rgba(255,255,255,0.1)'}}>
                  {muted?<MicOff className="w-5 h-5 text-yellow-400"/>:<Mic className="w-5 h-5 text-white/60"/>}
                </button>
              )}
              <button onClick={onEnd}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-90"
                style={{background:'#ef4444',border:'1px solid rgba(239,68,68,0.5)',boxShadow:'0 0 20px rgba(239,68,68,0.4)'}}>
                <PhoneOff className="w-6 h-6 text-white"/>
              </button>
            </div>
          </div>
        </div>
        <audio ref={audioRef} autoPlay playsInline/>
      </div>
    );
  }

  // Аудио-звонок
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]"
      style={{background:'rgba(0,0,0,0.88)',backdropFilter:'blur(24px)',animation:'fadeIn 0.2s ease'}}>
      <div className="rounded-3xl p-10 text-center w-80 shadow-2xl"
        style={{background:'#111116',border:'1px solid rgba(255,255,255,0.08)',animation:'slideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)'}}>
        <div className="mb-5 flex justify-center">
          <Avatar username={peer} displayName={peerDisplay} avatar={peerAvatar} size="lg"/>
        </div>
        <p className="text-white text-xl font-bold mb-1">{peerDisplay||peer}</p>
        <p className={`text-sm mb-8 font-mono tracking-widest ${calling?'text-white/30 animate-pulse':'text-green-400'}`}>
          {calling?'Вызов...':fmt(duration)}
        </p>
        <div className="flex justify-center gap-4">
          {!calling&&(
            <button onClick={onMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 ${muted?'border border-yellow-500/40':'border border-white/10'}`}
              style={{background:muted?'rgba(234,179,8,0.15)':'rgba(255,255,255,0.06)'}}>
              {muted?<MicOff className="w-5 h-5 text-yellow-400"/>:<Mic className="w-5 h-5 text-white/50"/>}
            </button>
          )}
          <button onClick={onEnd}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-90"
            style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)'}}>
            <PhoneOff className="w-6 h-6 text-red-400"/>
          </button>
        </div>
      </div>
      <audio ref={audioRef} autoPlay playsInline/>
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
  
  const [typingUsers, setTypingUsers] = useState({});
  const [avatars, setAvatars] = useState({});

  const [showSearch, setShowSearch] = useState(false);
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchChannelResults, setSearchChannelResults] = useState([]);
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
  const [editBio, setEditBio] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [showSidebar, setShowSidebar] = useState(true);
  // Поиск по сообщениям
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [msgSearchResults, setMsgSearchResults] = useState([]);
  const [msgSearchLoading, setMsgSearchLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // {_id, from, text, type}
  const [drafts, setDrafts] = useState({});
  const [mentionQuery, setMentionQuery] = useState(''); // текущий @query
  const [mentionList, setMentionList] = useState([]); // подходящие участники // { chatKey: text }
  const draftsRef = useRef({});
  // Закреплённое сообщение
  const [pinnedMessage, setPinnedMessage] = useState(null);
  // Профиль пользователя
  const [viewingProfile, setViewingProfile] = useState(null);
  // Счётчики непрочитанных
  const [unreadCounts, setUnreadCounts] = useState({});
  // Статус пользователя
  // status removed
  // Каналы
  const [channels, setChannels] = useState([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelForm, setChannelForm] = useState({name:'',username:'',description:''});
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelSettingsForm, setChannelSettingsForm] = useState({});
  const [channelSearch, setChannelSearch] = useState('');
  const [channelSearchResults, setChannelSearchResults] = useState([]);
  // История звонков
  const [callHistory, setCallHistory] = useState([]);

  // ── AI Bot ──
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const aiEndRef = useRef(null);

  // ── Push Notifications ──
  const [pushEnabled, setPushEnabled] = useState(false);
  const pushEnabledRef = useRef(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  // Видео-звонок
  const [videoEnabled, setVideoEnabled] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  // Кружочки (видео-сообщения)
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoRecordingTime, setVideoRecordingTime] = useState(0);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoTimerRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [sendingFile, setSendingFile] = useState(false);
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [linkPreviews, setLinkPreviews] = useState({}); // {msgId: {title,desc,image,url}} // {data, name, type}
  // Кнопка звонка всегда видна
  const [callType, setCallType] = useState('audio'); // audio | video
  // Горячая клавиша Esc
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') {
        setShowSearch(false); setShowCreateGroup(false); setShowSettings(false);
        setShowGroupInfo(false); setShowAdminPanel(false); setShowForwardModal(false);
        setShowMsgSearch(false); setViewingProfile(null); setMsgMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const currentUserRef = useRef(null);

  const T = THEMES[theme] || THEMES.violet;
  const getChatKey = c => {
    if (!c) return null;
    if (c.type==='group') return `group_${c.id}`;
    if (c.type==='channel') return `channel_${c.id}`;
    return c.id;
  };
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

  useEffect(() => { try { localStorage.setItem('whispr_theme',theme); } catch(e) { /* storage unavailable */ } }, [theme]);

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

  const startCall = useCallback(async (toUsername, ct='audio') => {
    try {
      const isVideo = ct === 'video';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true, sampleRate:48000, channelCount:1 },
        video: isVideo ? { facingMode:'user', width:{ideal:640}, height:{ideal:480} } : false
      });
      localStreamRef.current = stream;
      setCallType(ct);
      const pc = new RTCPeerConnection(ICE);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => {
        const s = e.streams?.[0] || new MediaStream([e.track]);
        remoteStreamRef.current = s;
        // Аудио
        const tryAudio = () => { const a=remoteAudioRef.current||document.getElementById('remoteAudio'); if(a){a.srcObject=s;a.play().catch(()=>{});} };
        tryAudio(); setTimeout(tryAudio, 500);
        // Видео
        if (remoteVideoRef.current) { remoteVideoRef.current.srcObject=s; remoteVideoRef.current.play().catch(()=>{}); }
      };
      pc.onicecandidate = e => { if(e.candidate) socketRef.current?.emit('ice_candidate',{to:toUsername,candidate:e.candidate}); };
      pc.onconnectionstatechange = () => { if(['failed','disconnected','closed'].includes(pc.connectionState)) cleanupCall(); };
      const offer = await pc.createOffer({ offerToReceiveAudio:true, offerToReceiveVideo:isVideo });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('call_offer',{to:toUsername,offer,callType:ct});
      setCallPeer(toUsername); callPeerRef.current=toUsername; setCallState('calling');
    } catch(e) { alert('Нет доступа к ' + (ct==='video'?'камере/микрофону':'микрофону') + ': ' + e.message); cleanupCall(); }
  }, [cleanupCall]);

  const acceptCall = useCallback(async () => {
    try {
      const isVideo = callType === 'video';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true, sampleRate:48000, channelCount:1 },
        video: isVideo ? { facingMode:'user', width:{ideal:640}, height:{ideal:480} } : false
      });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(ICE);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => {
        const s = e.streams?.[0] || new MediaStream([e.track]);
        remoteStreamRef.current = s;
        const tryAudio = () => { const a=remoteAudioRef.current||document.getElementById('remoteAudio'); if(a){a.srcObject=s;a.play().catch(()=>{});} };
        tryAudio(); setTimeout(tryAudio, 500);
        if (remoteVideoRef.current) { remoteVideoRef.current.srcObject=s; remoteVideoRef.current.play().catch(()=>{}); }
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

  const rejectCall = useCallback(() => { socketRef.current?.emit('call_reject',{to:callPeerRef.current,callType}); cleanupCall(); },[cleanupCall,callType]);
  const endCall = useCallback(() => { socketRef.current?.emit('call_end',{to:callPeerRef.current,duration:callDuration,callType}); cleanupCall(); },[cleanupCall,callDuration,callType]);
  const toggleMute = useCallback(() => { localStreamRef.current?.getAudioTracks().forEach(t=>{t.enabled=!t.enabled;}); setCallMuted(m=>!m); },[]);

  useEffect(() => {
    const s = io(SERVER_URL,{transports:['websocket','polling']});
    setSocket(s); socketRef.current=s;
    s.on('new_message', msg => {
      const me = currentUserRef.current?.username;
      const key = msg.from === me ? msg.to : msg.from;
      setMessages(p => ({...p, [key]: [...(p[key]||[]), msg]}));
      // Счётчик непрочитанных
      if (msg.from !== me) {
        setUnreadCounts(p => {
          const active = activeChatRef.current;
          if (active?.type === 'direct' && active.id === key) return p;
          return {...p, [key]: (p[key]||0) + 1};
        });
        // Push notification
        if (pushEnabledRef.current && !document.hasFocus()) {
          const sender = msg.from;
          const body = msg.type==='voice'?'🎤 Голосовое':msg.type==='video'?'📹 Видео':msg.type==='image'?'🖼 Фото':msg.text||'Новое сообщение';
          try { new Notification(sender, { body, icon:'/favicon.ico', tag:`dm_${sender}` }); } catch(e) { /* push unavailable */ }
        }
      }
    });
    s.on('new_group_message', msg => {
      const key = `group_${msg.groupId}`;
      setMessages(p => ({...p, [key]: [...(p[key]||[]), msg]}));
      const me = currentUserRef.current?.username;
      if (msg.from !== me) {
        setUnreadCounts(p => {
          const active = activeChatRef.current;
          if (active?.type === 'group' && active.id === msg.groupId) return p;
          return {...p, [key]: (p[key]||0) + 1};
        });
        // Push notification
        if (pushEnabledRef.current && !document.hasFocus()) {
          try { new Notification(msg.groupName||'Группа', { body:`${msg.from}: ${msg.type==='voice'?'🎤 Голосовое':msg.text||'Сообщение'}`, icon:'/favicon.ico', tag:`grp_${msg.groupId}` }); } catch(e) { /* push unavailable */ }
        }
      }
    });
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
    s.on('call_answered', async({answer}) => {
      try {
        const pc = peerConnectionRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        const pending = [...pendingIceCandidatesRef.current];
        pendingIceCandidatesRef.current = [];
        for (const cand of pending) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch(icErr) { /* expected */ }
        }
        setCallState('active');
        callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      } catch(e) { console.error('call_answered err', e); }
    });
    s.on('ice_candidate', async({candidate}) => { try{ const pc=peerConnectionRef.current; if(pc&&pc.remoteDescription&&pc.remoteDescription.type){ await pc.addIceCandidate(new RTCIceCandidate(candidate)); } else { pendingIceCandidatesRef.current.push(candidate); } }catch(e){console.warn('ICE error',e);} });
    s.on('call_ended', ()=>cleanupCall());
    s.on('call_rejected', ()=>{alert('Звонок отклонён');cleanupCall();});
    s.on('call_failed', ({reason})=>{alert(reason);cleanupCall();});
    s.on('force_disconnect', ({reason})=>{handleLogout();});
    s.on('new_channel_message', msg => {
      const key = `channel_${msg.channelId}`;
      setMessages(p => ({...p, [key]: [...(p[key]||[]), msg]}));
      const me = currentUserRef.current?.username;
      if (msg.from !== me) {
        setUnreadCounts(p => {
          const active = activeChatRef.current;
          if (active?.type==='channel' && active.id===msg.channelId) return p;
          return {...p, [key]: (p[key]||0)+1};
        });
      }
    });
    s.on('channel_updated', ch => setChannels(p => p.map(x => x._id===ch._id ? ch : x)));
    s.on('channel_deleted', ({channelId}) => {
      setChannels(p => p.filter(x => x._id!==channelId));
      setActiveChat(a => (a?.type==='channel'&&a.id===channelId) ? null : a);
    });
    s.on('incoming_call', ({from, offer, callType: ct='audio'}) => {
      callPeerRef.current = from;
      incomingOfferRef.current = offer;
      setCallPeer(from);
      setCallType(ct);      // ← сохраняем тип ДО acceptCall
      setCallState('incoming');
    });
    s.on('message_pinned', ({groupId, messageId, pinnedBy}) => {
      if (messageId) {
        s.emit('get_pinned_message', groupId, res => { if(res.success) setPinnedMessage(p => ({...p, [groupId]: res.message})); });
      } else {
        setPinnedMessage(p => ({...p, [groupId]: null}));
      }
    });
    return ()=>{s.close();cleanupCall();};
  }, []);

  useEffect(()=>{currentUserRef.current=currentUser;},[currentUser]);
  const activeChatRef = useRef(null);
  useEffect(()=>{ activeChatRef.current = activeChat; },[activeChat]);

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
          setCurrentUser(res.user);setContacts(res.contacts||[]);setGroups(res.groups||[]);setChannels(res.channels||[]);
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
  const handleLogin = e => { e.preventDefault();setAuthError('');socket.emit('login',{username,password},res=>{if(res.success){try{localStorage.setItem('whispr_creds',JSON.stringify({u:username.toLowerCase(),p:password}));}catch(e){/* storage unavailable */}setCurrentUser(res.user);setContacts(res.contacts||[]);setGroups(res.groups||[]);setChannels(res.channels||[]);const av={};(res.contacts||[]).forEach(c=>{if(c.avatar)av[c.username]=c.avatar;});if(res.user.avatar)av[res.user.username]=res.user.avatar;setAvatars(av);setIsAuthenticated(true);}else setAuthError(res.error);}); };
  const handleLogout = () => { cleanupCall();try{localStorage.removeItem('whispr_creds');}catch(e){/* storage unavailable */}setIsAuthenticated(false);setCurrentUser(null);setContacts([]);setGroups([]);setActiveChat(null);setMessages({});setUsername('');setPassword('');setDisplayName(''); };

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
    if(editBio.trim()!==currentUser.bio)data.bio=editBio.trim();
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
          try{localStorage.setItem('whispr_creds',JSON.stringify({u:res.user.username,p:savedP}));}catch(e){/* storage unavailable */}
          socket.emit('login',{username:res.user.username,password:savedP},r2=>{if(r2.success){setContacts(r2.contacts||[]);setGroups(r2.groups||[]);}});
        }
        setProfileSuccess('Профиль обновлён!');
        setEditUsername(res.user.username);
        setEditDisplayName(res.user.displayName);
        setEditBio(res.user.bio||'');
      } else setProfileError(res.error);
    });
  };

  const handleSearch = q => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); setSearchChannelResults([]); return; }
    socket.emit('search_users', q, res => {
      if (res.success) {
        setSearchResults(res.results || []);
        setSearchChannelResults(res.channels || []);
      }
    });
  };
  const handleAddContact = u=>{socket.emit('add_contact',u,res=>{if(res.success){setContacts(p=>[...p,res.contact]);if(res.contact.avatar)setAvatars(p=>({...p,[res.contact.username]:res.contact.avatar}));setSearchResults([]);setSearchQuery('');setShowSearch(false);}});};
  const handleRemoveContact = u=>{if(!confirm(`Удалить ${u}?`))return;socket.emit('remove_contact',u,res=>{if(res.success){setContacts(p=>p.filter(c=>c.username!==u));if(activeChat?.id===u)setActiveChat(null);}});};
  const openDirectChat = c=>{
    setActiveChat({type:'direct',id:c.username,data:c});
    setShowSearch(false);setReplyTo(null);setUnreadCounts(p=>({...p,[c.username]:0}));
    const draft = draftsRef.current[c.username] || '';
    setText(draft);socket.emit('load_chat',c.username,res=>{if(res.success)setMessages(p=>({...p,[c.username]:res.messages}));});};
  const openChannelChat = (ch) => {
    setActiveChat({type:'channel', id:ch._id, data:ch});
    setUnreadCounts(p=>({...p,[`channel_${ch._id}`]:0}));
    socket.emit('load_channel_chat', ch._id, res=>{
      if(res.success) setMessages(p=>({...p,[`channel_${ch._id}`]:res.messages}));
    });
  };

  const openGroupChat = g=>{
    setActiveChat({type:'group',id:g._id,data:g});
    setUnreadCounts(p=>({...p,[`group_${g._id}`]:0}));
    const draft = draftsRef.current[`group_${g._id}`] || '';
    setText(draft);
    socket.emit('load_group_chat',g._id,res=>{if(res.success)setMessages(p=>({...p,[`group_${g._id}`]:res.messages}));});
    // Загрузить закреплённое
    socket.emit('get_pinned_message', g._id, res=>{if(res.success&&res.message)setPinnedMessage(p=>({...p,[g._id]:res.message}));});
  };
  const handleSendMessage = e => {
    e.preventDefault();
    const msg = (text||'').trim();
    if (!msg || !activeChat) return;
    const replyData = replyTo ? {replyToId:replyTo._id, replyFrom:replyTo.from, replyText:replyTo.type==='voice'?'🎤 Голосовое':replyTo.type==='video'?'📹 Видео':replyTo.text} : {};
    if (activeChat.type==='direct') socket.emit('send_message', {to:activeChat.id, text:msg, type:'text', ...replyData}, ()=>{});
    else if (activeChat.type==='group') socket.emit('send_group_message', {groupId:activeChat.id, text:msg, type:'text', ...replyData}, ()=>{});
    else if (activeChat.type==='channel') socket.emit('send_channel_message', {channelId:activeChat.id, text:msg, type:'text'}, ()=>{});
    setText(''); setReplyTo(null);
    const key = getChatKey(activeChatRef.current);
    if (key) { draftsRef.current[key]=''; setDrafts(p=>({...p,[key]:''})); }
  };
  const handleTyping = ()=>{if(!activeChat)return;if(activeChat.type==='direct')socket.emit('typing',activeChat.id);else socket.emit('group_typing',activeChat.id);};
  const startEdit = msg=>{setEditingMsgId(msg._id||msg.id);setEditText(msg.text);setMsgMenu(null);};
  const submitEdit = e=>{e.preventDefault();if(!editText.trim())return;socket.emit('edit_message',{messageId:editingMsgId,newText:editText.trim()},res=>{if(res.success){setEditingMsgId(null);setEditText('');}});};
  const deleteMsg = (msg,forAll)=>{socket.emit('delete_message',{messageId:msg._id||msg.id,deleteFor:forAll?'all':'me'},()=>{});setMsgMenu(null);};
  const submitForward = to=>{socket.emit('forward_message',{messageId:forwardMsg._id||forwardMsg.id,toUsername:to},res=>{if(res.success){setShowForwardModal(false);setForwardMsg(null);const c=contacts.find(x=>x.username===to);if(c)openDirectChat(c);}});};
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      const mr = new MediaRecorder(stream, {mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'});
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const chat = activeChatRef.current;
        if (!chat) return;
        const blob = new Blob(audioChunksRef.current, {type:'audio/webm'});
        const r = new FileReader();
        r.onloadend = () => {
          const audioData = r.result;
          if (chat.type === 'direct') socket.emit('send_message', {to:chat.id, text:'', type:'voice', audioData}, res => { if(!res?.success) console.error('Voice send failed:', res); });
          else if (chat.type === 'group') socket.emit('send_group_message', {groupId:chat.id, text:'', type:'voice', audioData}, res => { if(!res?.success) console.error('Voice group send failed:', res); });
        };
        r.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(100); // chunk every 100ms
      setIsRecording(true); setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t+1), 1000);
    } catch(e) { alert('Нет доступа к микрофону: ' + e.message); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); clearInterval(recordingTimerRef.current); setIsRecording(false); setRecordingTime(0); };
  const toggleAudio = (id,data)=>{if(playingAudio===id){setPlayingAudio(null);return;}setPlayingAudio(id);const a=new Audio(data);a.onended=()=>setPlayingAudio(null);a.play();};
  const handleReaction = (mid,emoji)=>{socket.emit('add_reaction',{messageId:mid,emoji},()=>{});setHoveredMsg(null);};
  const handleCreateGroup = e=>{e.preventDefault();if(!newGroupName.trim())return;socket.emit('create_group',{name:newGroupName,description:newGroupDesc,members:selectedMembers},res=>{if(res.success){setShowCreateGroup(false);setNewGroupName('');setNewGroupDesc('');setSelectedMembers([]);openGroupChat(res.group);}});};
  const handleLeaveGroup = ()=>{if(!confirm('Покинуть группу?'))return;socket.emit('leave_group',activeChat.id,res=>{if(res.success){setGroups(p=>p.filter(g=>g._id!==activeChat.id));setActiveChat(null);setShowGroupInfo(false);}});};
  const searchAddMember = q=>{setAddMemberQuery(q);if(q.length<2){setAddMemberResults([]);return;}socket.emit('search_users',q,res=>{if(res.success)setAddMemberResults(res.results);});};
  const handleAddMember = u=>{socket.emit('group_add_member',{groupId:activeChat.id,username:u},res=>{if(res.success){setGroups(p=>p.map(g=>g._id===activeChat.id?res.group:g));setActiveChat(p=>p?{...p,data:res.group}:p);setAddMemberQuery('');setAddMemberResults([]);}else alert(res.error);});};
  const loadAdminData = (search='')=>{socket.emit('admin_get_stats',res=>{if(res.success)setAdminStats(res.stats);});socket.emit('admin_get_users',{search},res=>{if(res.success)setAllUsers(res.users);});socket.emit('admin_get_logs',res=>{if(res.success)setAdminLogs(res.logs);});};
  const handlePromote = u=>{if(!confirm(`Сделать ${u} администратором?`))return;socket.emit('admin_promote_user',u,res=>{if(res.success)loadAdminData(adminSearch);else alert(res.error);});};
  const handleDemote = u=>{if(!confirm(`Разжаловать ${u}?`))return;socket.emit('admin_demote_user',u,res=>{if(res.success)loadAdminData(adminSearch);else alert(res.error);});};
  const handleMsgSearch = (q) => {
    setMsgSearchQuery(q);
    if (!q || q.length < 2) { setMsgSearchResults([]); return; }
    if (!activeChat) return;
    setMsgSearchLoading(true);
    const chatKey = activeChat.type==='group' ? `group_${activeChat.id}` : activeChat.id;
    socket.emit('search_messages', {chatKey, query:q}, res => {
      setMsgSearchLoading(false);
      if (res.success) setMsgSearchResults(res.results);
    });
  };

  const handleBlockUser = (username, block) => {
    socket.emit('block_user', {target: username, block}, res => {
      if (res.success) {
        setContacts(p => p.map(c => c.username===username ? {...c, isBlockedByMe: block} : c));
      }
    });
  };



  const handleViewProfile = (username) => {
    if (!socket || !username) return;
    socket.emit('get_user_profile', username, res => {
      if (res.success) setViewingProfile(res.profile);
      else console.warn('Profile error:', res.error);
    });
  };

  const handleCreateChannel = (e) => {
    e.preventDefault();
    if (!channelForm.name.trim()) return;
    if (!socket) { alert('Нет соединения'); return; }
    const payload = {
      name: channelForm.name.trim(),
      username: channelForm.username.trim() || null,
      description: channelForm.description.trim(),
    };
    socket.emit('create_channel', payload, res => {
      if (!res) { alert('Нет ответа от сервера'); return; }
      if (res.success) {
        setChannels(p => [...p, res.channel]);
        setShowCreateChannel(false);
        setChannelForm({name:'',username:'',description:''});
        openChannelChat(res.channel);
      } else {
        alert('Ошибка: ' + (res.error || 'неизвестная'));
      }
    });
  };

  const handleUpdateChannel = (e) => {
    e.preventDefault();
    socket.emit('update_channel', {channelId: editingChannel._id, ...channelSettingsForm}, res => {
      if (res.success) {
        setChannels(p => p.map(x => x._id===res.channel._id ? res.channel : x));
        setShowChannelSettings(false);
      } else alert(res.error);
    });
  };

  const handleSearchChannels = (q) => {
    setChannelSearch(q);
    if (q.length < 2) { setChannelSearchResults([]); return; }
    socket.emit('search_channels', q, res => {
      if (res.success) setChannelSearchResults(res.channels);
    });
  };

  const loadCallHistory = (withUser) => {
    socket.emit('get_call_history', {withUser}, res => {
      if (res.success) setCallHistory(res.logs);
    });
  };

  // ════════════════════════════════════════
  //  AI BOT (Whispr AI — uses server proxy)
  // ════════════════════════════════════════
  const sendAiMessage = async () => {
    const msg = aiInput.trim();
    if (!msg || aiLoading) return;
    const userMsg = { role: 'user', content: msg };
    const newHistory = [...aiMessages, userMsg];
    setAiMessages(newHistory);
    setAiInput('');
    setAiLoading(true);
    setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const res = await fetch(`${SERVER_URL}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory })
      });
      const data = await res.json();
      if (data.reply) {
        setAiMessages(p => [...p, { role: 'assistant', content: data.reply }]);
      } else {
        setAiMessages(p => [...p, { role: 'assistant', content: '⚠️ ' + (data.error || 'Ошибка') }]);
      }
    } catch (e) {
      setAiMessages(p => [...p, { role: 'assistant', content: '⚠️ Нет соединения с AI' }]);
    }
    setAiLoading(false);
    setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // ════════════════════════════════════════
  //  WEB PUSH NOTIFICATIONS (browser native, free)
  // ════════════════════════════════════════
  const requestPushPermission = async () => {
    if (!('Notification' in window)) { alert('Push не поддерживается в этом браузере'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setPushEnabled(true); pushEnabledRef.current = true;
      new Notification('Whispr', { body: '🔔 Уведомления включены!', icon: '/favicon.ico' });
    } else {
      setPushEnabled(false); pushEnabledRef.current = false;
    }
  };

  const sendPushNotification = (title, body) => {
    if (!pushEnabledRef.current || document.hasFocus()) return;
    try { new Notification(title, { body, icon: '/favicon.ico', silent: false }); } catch(e) { /* push unavailable */ }
  };

  // Инициализация push при загрузке
  React.useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true); pushEnabledRef.current = true;
    }
  }, []);

  // Видео-кружочки
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:320,height:320},audio:true});
      if (videoPreviewRef.current) { videoPreviewRef.current.srcObject=stream; videoPreviewRef.current.play().catch(()=>{}); }
      const vr = new MediaRecorder(stream, {mimeType:'video/webm;codecs=vp8,opus'});
      videoRecorderRef.current = vr; videoChunksRef.current = [];
      vr.ondataavailable = e => videoChunksRef.current.push(e.data);
      vr.onstop = () => {
        const blob = new Blob(videoChunksRef.current, {type:'video/webm'});
        const r = new FileReader();
        r.onloadend = () => {
          const chat = activeChatRef.current;
          if (!chat) return;
          const videoData = r.result;
          if (chat.type==='direct') socket.emit('send_message',{to:chat.id,text:'',type:'video',audioData:videoData}, res=>{ if(!res?.success) console.error('Video send failed:', res); });
          else if (chat.type==='group') socket.emit('send_group_message',{groupId:chat.id,text:'',type:'video',audioData:videoData}, res=>{ if(!res?.success) console.error('Video group send failed:', res); });
        };
        r.readAsDataURL(blob);
        stream.getTracks().forEach(t=>t.stop());
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject=null;
      };
      vr.start(); setIsVideoRecording(true); setVideoRecordingTime(0);
      videoTimerRef.current = setInterval(() => setVideoRecordingTime(t=>t+1), 1000);
    } catch(e) { alert('Нет доступа к камере'); }
  };

  const stopVideoRecording = () => {
    videoRecorderRef.current?.stop();
    clearInterval(videoTimerRef.current);
    setIsVideoRecording(false); setVideoRecordingTime(0);
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    if (!videoEnabled) {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
        vs.getVideoTracks().forEach(t => localStreamRef.current.addTrack(t));
        if (localVideoRef.current) { localVideoRef.current.srcObject = localStreamRef.current; localVideoRef.current.play().catch(()=>{}); }
        peerConnectionRef.current?.getSenders().forEach(s => { if(s.track?.kind==='audio'){} });
        // add video track to peer connection
        vs.getVideoTracks().forEach(t => peerConnectionRef.current?.addTrack(t, localStreamRef.current));
        setVideoEnabled(true);
      } catch(e) { alert('Нет доступа к камере'); }
    } else {
      localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current.removeTrack(t); });
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setVideoEnabled(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const maxMB = file.type.startsWith('video/') ? 40 : file.type.startsWith('image/') ? 10 : 15;
    if (file.size > maxMB * 1024 * 1024) { alert(`Файл слишком большой (макс ${maxMB}МБ)`); return; }
    const r = new FileReader();
    r.onloadend = () => {
      if (file.type.startsWith('image/')) {
        setImagePreview({data: r.result, name: file.name, type: 'image'});
      } else {
        // Отправляем сразу не-изображения
        sendFile(r.result, file.name, file.type);
      }
    };
    r.readAsDataURL(file);
    e.target.value = '';
  };

  const fetchLinkPreview = async (msgId, text) => {
    if (linkPreviews[msgId]) return;
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) return;
    const url = urlMatch[0].replace(/[.,!?)]+$/, '');
    try {
      setLinkPreviews(p => ({...p, [msgId]: {loading:true, url}}));
      const res = await fetch(`${SERVER_URL}/api/link-preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.error || !data.title) {
        setLinkPreviews(p => ({...p, [msgId]: {loading:false, failed:true, url}}));
      } else {
        setLinkPreviews(p => ({...p, [msgId]: {url, title:data.title, desc:data.desc, image:data.image, loading:false}}));
      }
    } catch(e) {
      setLinkPreviews(p => ({...p, [msgId]: {loading:false, failed:true, url}}));
    }
  };

  const sendFile = (data, name, mimeType) => {
    const chat = activeChatRef.current;
    if (!chat || !socket) return;
    setSendingFile(true);
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const msgType = isImage ? 'image' : isVideo ? 'video_file' : 'file';
    const payload = {text: name, type: msgType, audioData: data, fileName: name, fileMime: mimeType};
    const cb = (res) => { setSendingFile(false); if (!res?.success) alert('Ошибка отправки файла'); };
    if (chat.type==='direct') socket.emit('send_message', {to:chat.id, ...payload}, cb);
    else if (chat.type==='group') socket.emit('send_group_message', {groupId:chat.id, ...payload}, cb);
    else if (chat.type==='channel') socket.emit('send_channel_message', {channelId:chat.id, ...payload}, cb);
    setImagePreview(null);
  };

  const handlePinMessage = (msg) => {
    if (!activeChat || activeChat.type !== 'group') return;
    const mid = msg._id || msg.id;
    const alreadyPinned = pinnedMessage?.[activeChat.id]?._id === mid;
    socket.emit('pin_message', {groupId: activeChat.id, messageId: alreadyPinned ? null : mid}, res => {
      if (res.success) {
        setPinnedMessage(p => ({...p, [activeChat.id]: alreadyPinned ? null : msg}));
      }
    });
    setMsgMenu(null);
  };

  const fmtTime = ts=>{const d=new Date(ts),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});};
  const fmtDur = s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const activeChatData = activeChat?.type==='group'
    ? groups.find(g=>g._id===activeChat?.id)||activeChat?.data
    : activeChat?.type==='channel'
    ? channels.find(ch=>ch._id===activeChat?.id)||activeChat?.data
    : contacts.find(c=>c.username===activeChat?.id)||activeChat?.data;
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
      <div className={`relative flex-shrink-0 flex flex-col transition-all duration-300 ${showSidebar?'w-72 translate-x-0':'w-0 -translate-x-72 overflow-hidden'} ${activeChat&&!showSidebar?'absolute z-10 h-full':''}`}
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
              <div className="flex items-center gap-1.5">
<span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>
              </div>
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              <button onClick={()=>{setShowSettings(true);setSettingsTab('account');setEditDisplayName(currentUser?.displayName||'');setEditUsername(currentUser?.username||'');setEditBio(currentUser?.bio||'');setProfileError('');setProfileSuccess('');}} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Настройки"><Settings className="w-4 h-4 text-white/30 hover:text-white/60" /></button>
              {currentUser?.isAdmin&&<button onClick={()=>{setShowAdminPanel(true);loadAdminData();}} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><Shield className="w-4 h-4 text-white/30 hover:text-white/60" /></button>}
              <button onClick={()=>setShowAiChat(true)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Whispr AI"><MessageSquare className="w-4 h-4 text-white/30 hover:text-white/60"/></button>
              <button onClick={pushEnabled ? ()=>{setPushEnabled(false);pushEnabledRef.current=false;} : requestPushPermission}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                title={pushEnabled?'Уведомления вкл':'Включить уведомления'}>
                {pushEnabled
                  ? <span className="text-xs">🔔</span>
                  : <span className="text-xs opacity-30">🔕</span>}
              </button>
              <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><LogOut className="w-4 h-4 text-white/30 hover:text-white/60" /></button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 py-2.5 flex gap-2">
          <button onClick={()=>setShowSearch(true)} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 text-sm hover:text-white/60 hover:bg-white/4 transition-all" style={{border:'1px solid rgba(255,255,255,0.05)'}}>
            <Search className="w-3.5 h-3.5" /><span>Поиск</span>
          </button>
          <div className="relative group/plus">
            <button className="px-3 py-2 rounded-xl hover:bg-white/5 transition-colors" style={{border:'1px solid rgba(255,255,255,0.05)'}}>
              <Plus className="w-4 h-4 text-white/30" />
            </button>
            <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl opacity-0 group-hover/plus:opacity-100 pointer-events-none group-hover/plus:pointer-events-auto transition-all z-50 w-40" style={{background:'rgba(10,10,14,0.98)',border:'1px solid rgba(255,255,255,0.08)'}}>
              <button onClick={()=>setShowCreateGroup(true)} className="w-full px-4 py-2.5 text-left text-white/60 text-sm hover:bg-white/5 flex items-center gap-2 transition-colors"><Hash className="w-4 h-4"/>Группа</button>
              <button onClick={()=>setShowCreateChannel(true)} className="w-full px-4 py-2.5 text-left text-white/60 text-sm hover:bg-white/5 flex items-center gap-2 transition-colors"><Radio className="w-4 h-4"/>Канал</button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 scrollbar-none">
          {contacts.length>0&&<div className="text-[10px] font-semibold text-white/15 uppercase tracking-[0.2em] px-2 pt-2 pb-1.5">Контакты</div>}
          {contacts.map((c,i)=>(
            <div key={c.username} onClick={()=>openDirectChat(c)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group`}
              style={{
                background:activeChat?.type==='direct'&&activeChat.id===c.username?`linear-gradient(135deg,${T.a}18,${T.b}10)`:'transparent',
                border:activeChat?.type==='direct'&&activeChat.id===c.username?`1px solid ${T.a}30`:'1px solid transparent',
                transform:'none',transition:'all 0.15s ease',
                animation:`listItem 0.3s ease ${i*0.04}s both`,
              }}>
              <Avatar username={c.username} displayName={c.displayName} avatar={avatars[c.username]} size="sm" online={c.isOnline} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${activeChat?.type==='direct'&&activeChat.id===c.username?'text-white':'text-white/60'}`}>{c.displayName}</div>
                {drafts[c.username]&&activeChat?.id!==c.username&&<div className="text-xs text-white/25 truncate flex items-center gap-1"><span style={{color:T.a,fontSize:'10px'}}>Черновик:</span>{drafts[c.username]}</div>}
                <div className="text-xs text-white/20 truncate">@{c.username}</div>
              </div>
              {(unreadCounts[c.username]||0)>0 && <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>{unreadCounts[c.username]}</span>}
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
              {(unreadCounts[`group_${g._id}`]||0)>0 && <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>{unreadCounts[`group_${g._id}`]}</span>}
            </div>
          ))}
          {/* Каналы */}
          {channels.length>0&&<div className="text-[10px] font-semibold text-white/15 uppercase tracking-[0.2em] px-2 pt-3 pb-1.5 flex items-center gap-2"><Tv2 className="w-3 h-3"/>Каналы</div>}
          {channels.map((ch,i)=>(
            <div key={ch._id} onClick={()=>openChannelChat(ch)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
              style={{
                background:activeChat?.type==='channel'&&activeChat.id===ch._id?`linear-gradient(135deg,${T.a}22,${T.c||T.b}15)`:undefined,
                border:activeChat?.type==='channel'&&activeChat.id===ch._id?'1px solid rgba(255,255,255,0.07)':'1px solid transparent',
              }}>
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>
                {ch.avatar?<img src={ch.avatar} alt="" className="w-full h-full object-cover"/>:<Radio className="w-4 h-4 text-white"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${activeChat?.type==='channel'&&activeChat.id===ch._id?'text-white':'text-white/60'}`}>{ch.name}</div>
                <div className="text-xs text-white/20">📢 Канал · {ch.subscribers?.length||0} подп.</div>
              </div>
              {(unreadCounts[`channel_${ch._id}`]||0)>0&&<span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>{unreadCounts[`channel_${ch._id}`]}</span>}
            </div>
          ))}
          {contacts.length===0&&groups.length===0&&channels.length===0&&<div className="text-center py-12 text-white/15 text-sm">Нажми «Поиск»<br/>чтобы найти людей</div>}
        </div>
      </div>

      {/* ── CHAT ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',position:'relative',minWidth:0,zIndex:1}}>
        {activeChat ? (
          <div style={{display:'flex',flexDirection:'column',height:'100%',opacity:chatVisible?1:0,transform:chatVisible?'none':'translateY(8px)',transition:'opacity 0.25s ease, transform 0.25s ease'}}>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4" style={{borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.2)'}}>
              <button onClick={()=>setShowSidebar(s=>!s)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0" title="Боковая панель"><Menu className="w-5 h-5 text-white/30 hover:text-white/60 transition-colors" /></button>
              {activeChat.type==='direct'?<div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={()=>handleViewProfile(activeChat.id)}><Avatar username={activeChatData?.username} displayName={activeChatData?.displayName} avatar={avatars[activeChatData?.username]} size="md" online={activeChatData?.isOnline}/></div>:activeChat.type==='channel'?<div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>{activeChatData?.avatar?<img src={activeChatData.avatar} className="w-full h-full rounded-full object-cover" alt=""/>:<Radio className="w-5 h-5 text-white"/>}</div>:<GroupAvatar group={activeChatData} size="md"/>}
              <div className="flex-1 min-w-0">
                <div className="text-white/90 font-semibold truncate">{activeChat.type==='direct'?activeChatData?.displayName:activeChatData?.name}</div>
                <div className="text-xs text-white/25">
                  {activeChat.type==='direct'
                    ? (activeChatData?.isOnline
                      ? <span style={{color:'#4ade80',fontSize:'12px'}} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>онлайн</span>
                      : <span style={{color:'rgba(255,255,255,0.25)',fontSize:'12px'}}>не в сети</span>)
                    : activeChat.type==='channel'
                    ? <span style={{color:'rgba(255,255,255,0.25)',fontSize:'12px'}}>📢 Канал · {activeChatData?.subscribers?.length||0} подп.</span>
                    : <span style={{color:'rgba(255,255,255,0.25)',fontSize:'12px'}}>{activeChatData?.members?.length||0} участников</span>}
                </div>
              </div>

              {activeChat.type==='direct'&&callState==='idle'&&(<>
                <button onClick={()=>startCall(activeChat.id,'audio')} className="p-2 rounded-xl transition-all duration-150 hover:bg-white/6 active:scale-90 flex-shrink-0" title="Аудио звонок"><Phone className="w-4 h-4 text-white/35 hover:text-green-400 transition-colors"/></button>
                <button onClick={()=>startCall(activeChat.id,'video')} className="p-2 rounded-xl transition-all duration-150 hover:bg-white/6 active:scale-90 flex-shrink-0" title="Видео звонок"><Video className="w-4 h-4 text-white/35 hover:text-blue-400 transition-colors"/></button>
                <button onClick={()=>{setShowCallHistory(true);loadCallHistory(activeChat.id);}} className="p-2 rounded-xl transition-all duration-150 hover:bg-white/6 active:scale-90 flex-shrink-0" title="История звонков"><PhoneCall className="w-4 h-4 text-white/20 hover:text-white/50 transition-colors"/></button>
              </>)}
              <button onClick={()=>{setShowMsgSearch(s=>!s);setMsgSearchQuery('');setMsgSearchResults([]);}} className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0" title="Поиск по сообщениям"><Search className="w-4 h-4 text-white/30 hover:text-white/60 transition-colors"/></button>
              {activeChat.type==='group'&&<button onClick={()=>setShowGroupInfo(true)} className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"><Settings className="w-4 h-4 text-white/30"/></button>}
              {activeChat.type==='channel'&&<button onClick={()=>{setEditingChannel(activeChatData);setChannelSettingsForm({name:activeChatData?.name||'',username:activeChatData?.username||'',description:activeChatData?.description||''});setShowChannelSettings(true);}} className="p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0" title="Настройки канала"><Settings className="w-4 h-4 text-white/30"/></button>}
            </div>

            {/* Поиск по сообщениям */}
            {showMsgSearch && (
              <div className="flex-shrink-0 px-4 py-2" style={{borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.15)',animation:'fadeIn 0.2s ease'}}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25"/>
                  <input autoFocus type="text" value={msgSearchQuery} onChange={e=>handleMsgSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-white/80 text-sm outline-none placeholder-white/20"
                    style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}}
                    placeholder="Поиск по сообщениям..."/>
                </div>
                {msgSearchResults.length>0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {msgSearchResults.map(m=>(
                      <div key={m._id} className="px-3 py-2 rounded-xl text-sm text-white/60 cursor-pointer hover:bg-white/5 transition-colors"
                        style={{border:'1px solid rgba(255,255,255,0.05)'}}
                        onClick={()=>{setShowMsgSearch(false);setMsgSearchQuery('');setMsgSearchResults([]);}}>
                        <div className="truncate text-white/80">{m.text}</div>
                        <div className="text-xs text-white/25 mt-0.5">{fmtTime(m.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {msgSearchLoading && <div className="text-center py-2 text-white/25 text-xs">Поиск...</div>}
                {!msgSearchLoading && msgSearchQuery.length>=2 && msgSearchResults.length===0 && <div className="text-center py-2 text-white/25 text-xs">Ничего не найдено</div>}
              </div>
            )}
            {/* Закреплённое сообщение */}
            {activeChat.type==='group' && pinnedMessage?.[activeChat.id] && (
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2" style={{borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)',animation:'fadeIn 0.2s ease'}}>
                <Pin className="w-3.5 h-3.5 text-white/25 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-white/20 uppercase tracking-wider">Закреплено</div>
                  <div className="text-sm text-white/60 truncate">{pinnedMessage[activeChat.id].text}</div>
                </div>
                {activeChatData?.admins?.includes(currentUser?.username) && (
                  <button onClick={()=>handlePinMessage(pinnedMessage[activeChat.id])} className="p-1 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"><PinOff className="w-3.5 h-3.5 text-white/25"/></button>
                )}
              </div>
            )}
            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'1.25rem 1.5rem',display:'flex',flexDirection:'column',gap:'0.25rem'}}>
              {chatMessages.map((msg,idx)=>{
                const isOwn=msg.from===currentUser?.username;
                const mid=msg._id||msg.id;
                const reactions=msg.reactions||{};
                const hasR=Object.keys(reactions).some(e=>reactions[e]?.length>0);
                const isEditing=editingMsgId===mid;
                // Дата-разделитель
                const msgDate=new Date(msg.timestamp);
                const prevMsg=chatMessages[idx-1];
                const showDateSep=!prevMsg||new Date(prevMsg.timestamp).toDateString()!==msgDate.toDateString();
                const todayD=new Date();const yesterdayD=new Date(todayD);yesterdayD.setDate(todayD.getDate()-1);
                const dateLbl=msgDate.toDateString()===todayD.toDateString()?'Сегодня':msgDate.toDateString()===yesterdayD.toDateString()?'Вчера':msgDate.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
                return (
                  <React.Fragment key={mid}>
                  {showDateSep&&<div className="flex justify-center my-4" style={{animation:'fadeIn 0.3s ease'}}><span className="px-4 py-1.5 rounded-full text-xs font-medium" style={{background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.25)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.06)'}}>{dateLbl}</span></div>}
                  <div className={`flex items-end gap-2 ${isOwn?'flex-row-reverse':'flex-row'}`}
                    style={{animation:isOwn&&idx===chatMessages.length-1?'sendBubble 0.38s cubic-bezier(0.34,1.4,0.64,1) both':`msgIn 0.18s cubic-bezier(0.25,0.46,0.45,0.94) ${Math.min(idx,15)*0.012}s both`}}
                    onMouseEnter={()=>{clearTimeout(hoverTimeoutRef.current);setHoveredMsg(mid);}}
                    onMouseLeave={()=>{hoverTimeoutRef.current=setTimeout(()=>setHoveredMsg(null),300);}}>
                    {!isOwn&&activeChat.type==='group'&&<div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={()=>handleViewProfile(msg.from)}><Avatar username={msg.from} displayName={msg.from} avatar={avatars[msg.from]} size="sm"/></div>}
                    <div className="relative max-w-sm">
                      {!isOwn&&activeChat.type==='group'&&<div className="text-xs text-white/25 mb-1 ml-1">{contacts.find(c=>c.username===msg.from)?.displayName||msg.from}</div>}
                      {hoveredMsg===mid&&!isEditing&&(
                        <div className={`absolute ${isOwn?'right-0':'left-0'} -top-9 flex gap-0.5 rounded-xl px-1.5 py-1 z-10 shadow-xl`}
                          style={{background:'rgba(10,10,16,0.97)',border:'1px solid rgba(255,255,255,0.08)',animation:'popIn 0.18s cubic-bezier(0.34,1.8,0.64,1)',backdropFilter:'blur(12px)'}}
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
                        <div className={`rounded-2xl px-4 py-2.5 ${isOwn?'rounded-br-sm':'rounded-bl-sm'}`}
                          style={isOwn
                            ?{background:`linear-gradient(135deg,${T.a},${T.b})`,border:'none',boxShadow:`0 3px 18px ${T.a}35`,transition:'box-shadow 0.2s'}
                            :{background:'rgba(255,255,255,0.066)',border:'1px solid rgba(255,255,255,0.075)',boxShadow:'0 2px 8px rgba(0,0,0,0.28)',transition:'background 0.2s'}}>
                          {msg.replyFrom&&(
                            <div className="mb-1.5 px-2.5 py-1.5 rounded-lg text-xs" style={{background:'rgba(255,255,255,0.07)',borderLeft:`2px solid ${T.a}`}}>
                              <div className="font-semibold mb-0.5" style={{color:T.a}}>{msg.replyFrom}</div>
                              <div className="text-white/40 truncate">{msg.replyText||'...'}</div>
                            </div>
                          )}
                          {/* Превью ссылки */}
                          {msg.type==='text'&&msg.text&&/https?:\/\//.test(msg.text)&&(()=>{
                            const msgId = msg._id||msg.id;
                            if (!linkPreviews[msgId]) { setTimeout(()=>fetchLinkPreview(msgId,msg.text),100); }
                            const lp = linkPreviews[msgId];
                            if (!lp||lp.loading||lp.failed) return null;
                            return (
                              <a href={lp.url} target="_blank" rel="noopener noreferrer"
                                className="block mt-2 rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                                style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',textDecoration:'none'}}>
                                {lp.image&&<img src={lp.image} alt="" className="w-full h-28 object-cover" onError={e=>e.target.style.display='none'}/>}
                                <div className="px-3 py-2">
                                  <div className="text-xs font-semibold text-white/80 truncate">{lp.title}</div>
                                  {lp.desc&&<div className="text-xs text-white/35 mt-0.5 line-clamp-2">{lp.desc}</div>}
                                  <div className="text-xs mt-1 flex items-center gap-1" style={{color:T.a}}><Globe className="w-3 h-3"/>{new URL(lp.url).hostname}</div>
                                </div>
                              </a>
                            );
                          })()}
                          {msg.type==='call_log'?(
                            <div className="flex items-center gap-2.5 py-0.5">
                              {msg.callStatus==='missed'?<PhoneMissed className="w-4 h-4 text-red-400 flex-shrink-0"/>:msg.callStatus==='completed'?<PhoneIncoming className="w-4 h-4 text-green-400 flex-shrink-0"/>:<PhoneOff className="w-4 h-4 text-white/30 flex-shrink-0"/>}
                              <div>
                                <div className={`text-sm font-medium ${msg.callStatus==='missed'?'text-red-400':msg.callStatus==='completed'?'text-green-400/90':'text-white/40'}`}>
                                  {msg.callStatus==='missed'?'Пропущенный звонок':msg.callStatus==='completed'?`Звонок · ${fmtDur(msg.callDuration||0)}`:msg.callSubtype==='video'?'Видеозвонок отменён':'Звонок отменён'}
                                </div>
                                <div className="text-xs text-white/25 flex items-center gap-1">{msg.callSubtype==='video'?<Video className="w-3 h-3"/>:<Phone className="w-3 h-3"/>}{msg.callSubtype==='video'?'Видео':'Аудио'}</div>
                              </div>
                              {isOwn&&<button onClick={()=>startCall(activeChat.id, msg.callSubtype||'audio')} className="ml-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0" title="Перезвонить"><Phone className="w-3.5 h-3.5 text-white/40"/></button>}
                            </div>
                          ):msg.type==='video'?(
                            <div className="relative w-40 h-40 flex-shrink-0">
                              <video
                                src={msg.audioData}
                                className="w-40 h-40 rounded-full object-cover"
                                style={{border:`2px solid ${isOwn?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.12)'}`}}
                                playsInline
                                preload="metadata"
                                onPlay={()=>setPlayingVideo(mid)}
                                onPause={()=>setPlayingVideo(null)}
                                onEnded={()=>setPlayingVideo(null)}
                              />
                              {playingVideo!==mid&&(
                                <div
                                  className="absolute inset-0 flex items-center justify-center rounded-full cursor-pointer"
                                  style={{background:'rgba(0,0,0,0.38)'}}
                                  onClick={()=>{const v=document.querySelector(`video[data-mid="${mid}"]`);if(v){v.play();}else{const all=document.querySelectorAll('video');all.forEach(el=>{if(el.src===msg.audioData||el.currentSrc===msg.audioData)el.play();});}}}
                                >
                                  <Play className="w-10 h-10 text-white/90"/>
                                </div>
                              )}
                            </div>
                          ):msg.type==='image'?(
                            <div className="relative max-w-xs">
                              <img src={msg.audioData} alt={msg.text||'фото'} className="rounded-2xl max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                                style={{maxHeight:'300px',objectFit:'cover'}}
                                onClick={()=>window.open(msg.audioData,'_blank')}/>
                            </div>
                          ):msg.type==='video_file'?(
                            <div className="max-w-xs">
                              <video src={msg.audioData} controls className="rounded-2xl max-w-full" style={{maxHeight:'300px'}} playsInline/>
                            </div>
                          ):msg.type==='file'?(
                            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl min-w-48" style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.07)'}}>
                              <FileText className="w-8 h-8 flex-shrink-0 text-white/50"/>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white/80 truncate font-medium">{msg.text||'Файл'}</div>
                                <div className="text-xs text-white/30">Документ</div>
                              </div>
                              <a href={msg.audioData} download={msg.text||'file'} className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"><Download className="w-4 h-4 text-white/50"/></a>
                            </div>
                          ):msg.type==='voice'?(
                            <div className="flex items-center gap-3 min-w-36">
                              <button onClick={()=>toggleAudio(mid,msg.audioData)} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-105" style={{background:'rgba(255,255,255,0.15)'}}>
                                {playingAudio===mid?<Pause className="w-4 h-4 text-white"/>:<Play className="w-4 h-4 text-white"/>}
                              </button>
                              <div className="flex-1 h-0.5 rounded-full" style={{background:'rgba(255,255,255,0.15)'}}><div className="h-full w-1/2 rounded-full" style={{background:'rgba(255,255,255,0.5)'}}></div></div>
                              <Mic className="w-3 h-3 text-white/30 flex-shrink-0"/>
                            </div>
                          ):(
                            <div style={{color:"rgba(255,255,255,0.92)",fontSize:"14px",lineHeight:"1.5",wordBreak:"break-word"}}>
                              {msg.text.split(/(@\w+)/g).map((part,i)=>
                                part.startsWith('@')
                                  ? <span key={i} style={{color:T.a,fontWeight:600}}>{part}</span>
                                  : part
                              )}
                            </div>
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
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef}/>
              {typingUsers[typingKey]&&<div className="text-xs text-white/25 italic px-2 py-0.5 self-start" style={{animation:'fadeIn 0.2s ease'}}>{activeChat.type==='group'?`${typingUsers[typingKey]} печатает...`:'печатает...'}</div>}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-4 py-4" style={{borderTop:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.15)'}}>
              {mentionList.length>0&&(
                <div className="mb-2 rounded-xl overflow-hidden" style={{background:'rgba(10,10,14,0.98)',border:'1px solid rgba(255,255,255,0.08)'}}>
                  {mentionList.map(m=>(
                    <button key={m} type="button"
                      onClick={()=>{
                        const atIdx=text.lastIndexOf('@');
                        setText(text.slice(0,atIdx)+'@'+m+' ');
                        setMentionList([]);
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-white/5 transition-colors">
                      <Avatar username={m} displayName={m} avatar={avatars[m]} size="xs"/>
                      <span className="text-white/70 text-sm">@{m}</span>
                    </button>
                  ))}
                </div>
              )}
              {imagePreview&&(
                <div className="flex items-center gap-3 mb-2 px-3 py-2 rounded-xl" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <img src={imagePreview.data} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/60 truncate">{imagePreview.name}</div>
                    <div className="text-xs text-white/25">Изображение</div>
                  </div>
                  <button onClick={()=>sendFile(imagePreview.data, imagePreview.name, 'image/jpeg')} disabled={sendingFile}
                    className="px-3 py-1.5 rounded-lg text-xs text-white font-medium flex-shrink-0 hover:opacity-90 disabled:opacity-50"
                    style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>
                    {sendingFile?'...':'Отправить'}
                  </button>
                  <button onClick={()=>setImagePreview(null)} className="p-1 rounded-lg hover:bg-white/5 flex-shrink-0"><X className="w-3.5 h-3.5 text-white/25"/></button>
                </div>
              )}
              {replyTo&&(
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <Reply className="w-3.5 h-3.5 text-white/30 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium" style={{color:T.a}}>{replyTo.from}</div>
                    <div className="text-xs text-white/40 truncate">{replyTo.type==='voice'?'🎤 Голосовое':replyTo.type==='video'?'📹 Видео':replyTo.text}</div>
                  </div>
                  <button onClick={()=>setReplyTo(null)} className="p-1 rounded-lg hover:bg-white/5 flex-shrink-0"><X className="w-3.5 h-3.5 text-white/25"/></button>
                </div>
              )}
              {isVideoRecording?(
                <div className="flex items-center gap-3 px-2 py-2 rounded-2xl" style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)',animation:'fadeIn 0.2s ease'}}>
                  <video ref={videoPreviewRef} muted playsInline className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{border:'2px solid rgba(99,102,241,0.4)'}}/>
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse flex-shrink-0"></div>
                  <span className="text-white/50 text-sm flex-1">Видео {fmtDur(videoRecordingTime)}</span>
                  <button onClick={stopVideoRecording} className="px-3 py-1.5 rounded-xl text-sm text-indigo-300/80 flex items-center gap-2 hover:bg-indigo-500/15 transition-colors flex-shrink-0"><VideoOff className="w-4 h-4"/>Отправить</button>
                </div>
              ):isRecording?(
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',animation:'fadeIn 0.2s ease'}}>
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse flex-shrink-0"></div>
                  <span className="text-white/50 text-sm flex-1">Запись {fmtDur(recordingTime)}</span>
                  <button onClick={stopRecording} className="px-3 py-1.5 rounded-xl text-sm text-red-300/80 flex items-center gap-2 hover:bg-red-500/15 transition-colors flex-shrink-0"><MicOff className="w-4 h-4"/>Отправить</button>
                </div>
              ):(
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input type="text" value={text||''} 
                    onChange={e=>{
                      const val=e.target.value; setText(val); handleTyping();
                      // Автосохранение черновика
                      const key=getChatKey(activeChatRef.current);
                      if(key){draftsRef.current[key]=val;setDrafts(p=>({...p,[key]:val}));}
                      // Mention autocomplete
                      const atIdx=val.lastIndexOf('@');
                      if(atIdx>=0){const q=val.slice(atIdx+1).toLowerCase();const chat=activeChatRef.current;
                        if(chat?.type==='group'){const grp=groups.find(g=>g._id===chat.id);const m=(grp?.members||[]).filter(x=>x.toLowerCase().includes(q)&&x!==currentUser?.username).slice(0,5);setMentionList(m);}
                        else setMentionList([]);}else setMentionList([]);
                    }}
                    className="flex-1 px-4 py-3 rounded-2xl text-white/90 text-sm outline-none placeholder-white/15 min-w-0 transition-all"
                    style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',transition:'border-color 0.15s,background 0.15s'}}
                    onFocus={e=>{e.target.style.borderColor='rgba(255,255,255,0.18)';e.target.style.background='rgba(255,255,255,0.07)';}}
                    onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.06)';e.target.style.background='rgba(255,255,255,0.04)';}}
                    placeholder="Напишите сообщение..."/>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip" className="hidden" onChange={handleFileSelect}/>
                  <button type="button" onClick={()=>fileInputRef.current?.click()} className="p-3 rounded-2xl hover:bg-white/5 transition-colors flex-shrink-0" style={{border:'1px solid rgba(255,255,255,0.06)'}} title="Прикрепить файл"><Paperclip className="w-5 h-5 text-white/25"/></button>
                  <button type="button" onClick={startRecording} className="p-3 rounded-2xl hover:bg-white/5 transition-colors flex-shrink-0" style={{border:'1px solid rgba(255,255,255,0.06)'}}><Mic className="w-5 h-5 text-white/25"/></button>
                  <button type="button" onClick={startVideoRecording} className="p-3 rounded-2xl hover:bg-white/5 transition-colors flex-shrink-0" style={{border:'1px solid rgba(255,255,255,0.06)'}} title="Видео-сообщение"><Video className="w-5 h-5 text-white/25"/></button>
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
          <button onClick={()=>{setReplyTo(msgMenu.msg);setMsgMenu(null);}} className="w-full px-4 py-2.5 text-left text-white/60 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"><CornerUpLeft className="w-4 h-4 text-white/40"/>Ответить</button>
          <button onClick={()=>{setForwardMsg(msgMenu.msg);setShowForwardModal(true);setMsgMenu(null);}} className="w-full px-4 py-2.5 text-left text-white/60 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"><Forward className="w-4 h-4 text-blue-400"/>Переслать</button>
          {activeChat?.type==='group'&&activeChatData?.admins?.includes(currentUser?.username)&&(
            <button onClick={()=>handlePinMessage(msgMenu.msg)} className="w-full px-4 py-2.5 text-left text-white/60 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors">
              <Pin className="w-4 h-4 text-purple-400"/>{pinnedMessage?.[activeChat?.id]?._id===(msgMenu.msg._id||msgMenu.msg.id)?'Открепить':'Закрепить'}
            </button>
          )}
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
                {/* Bio */}
                <div>
                  <label className="text-white/30 text-xs uppercase tracking-widest mb-1.5 block">Bio</label>
                  <textarea value={editBio} onChange={e=>setEditBio(e.target.value.slice(0,200))}
                    className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20 resize-none"
                    style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}
                    placeholder="Расскажи о себе..." rows={2} maxLength={200}/>
                </div>

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
            <input type="text" value={searchQuery} onChange={e=>handleSearch(e.target.value)} autoFocus className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20 mb-4" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Люди, каналы, группы..."/>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {searchResults.map(u=>(
                <div key={u.username} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{background:'rgba(255,255,255,0.03)'}}>
                  <Avatar username={u.username} displayName={u.displayName} avatar={u.avatar} size="sm" online={u.isOnline}/>
                  <div className="flex-1"><div className="text-white/70 text-sm font-medium">{u.displayName}</div><div className="text-white/25 text-xs">@{u.username}</div></div>
                  <button onClick={()=>handleAddContact(u.username)} className="px-3 py-1.5 rounded-lg text-white/50 text-xs flex items-center gap-1.5 hover:bg-white/8 transition-colors" style={{background:'rgba(255,255,255,0.05)'}}><UserPlus className="w-3.5 h-3.5"/>Добавить</button>
                </div>
              ))}
              {searchChannelResults.length>0&&(
                <div className="mt-3">
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-1 pb-2 flex items-center gap-1.5"><Radio className="w-3 h-3"/>Каналы</p>
                  {searchChannelResults.map(ch=>(
                    <div key={ch._id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all hover:bg-white/4"
                      onClick={()=>{
                        if (ch.isSubscribed) {
                          const existing = channels.find(x=>x._id===ch._id)||{...ch,subscribers:[],members:[]};
                          openChannelChat(existing); setShowSearch(false);
                        } else {
                          socket.emit('subscribe_channel', ch._id, res => {
                            if (res.success) { setChannels(p=>[...p,res.channel]); openChannelChat(res.channel); setShowSearch(false); }
                          });
                        }
                      }}>
                      <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>
                        {ch.avatar?<img src={ch.avatar} className="w-full h-full rounded-full object-cover" alt=""/>:<Radio className="w-4 h-4 text-white"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white/70 truncate">{ch.name}{ch.username&&<span className="ml-1 text-white/30 font-normal text-xs">@{ch.username}</span>}</div>
                        <div className="text-xs text-white/25">{ch.subscriberCount} подп.</div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0 font-medium" style={{background:ch.isSubscribed?'rgba(255,255,255,0.05)':'rgba(99,102,241,0.15)',color:ch.isSubscribed?'rgba(255,255,255,0.3)':'rgba(167,139,250,1)'}}>
                        {ch.isSubscribed?'Открыть':'+ Подписаться'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery.length>=2&&searchResults.length===0&&searchChannelResults.length===0&&<p className="text-center py-8 text-white/20 text-sm">Ничего не найдено</p>}
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

      {/* ══ WHISPR AI CHAT ══ */}
      {showAiChat&&(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.75)',backdropFilter:'blur(16px)'}} onClick={()=>setShowAiChat(false)}>
          <div className="w-full max-w-lg flex flex-col rounded-2xl overflow-hidden shadow-2xl" style={{height:'70vh',background:'#0e0e14',border:'1px solid rgba(255,255,255,0.09)'}} onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>✦</div>
                <div>
                  <p className="text-white/90 font-semibold text-sm">Whispr AI</p>
                  <p className="text-white/25 text-xs">Claude Haiku · бесплатно</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {aiMessages.length>0&&<button onClick={()=>setAiMessages([])} className="text-white/20 text-xs hover:text-white/50 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">Очистить</button>}
                <button onClick={()=>setShowAiChat(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><X className="w-4 h-4 text-white/30"/></button>
              </div>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {aiMessages.length===0&&(
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                  <div className="text-4xl mb-3">✦</div>
                  <p className="text-white/40 text-sm font-medium">Whispr AI</p>
                  <p className="text-white/20 text-xs mt-1">Задай любой вопрос</p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center">
                    {['Привет! Кто ты?','Помоги написать сообщение','Переведи на английский'].map(s=>(
                      <button key={s} onClick={()=>{setAiInput(s);}} className="px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/70 transition-colors" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((m,i)=>(
                <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                  {m.role==='assistant'&&<div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mr-2 mt-0.5" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>✦</div>}
                  <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role==='user'?'rounded-br-sm':'rounded-bl-sm'}`}
                    style={m.role==='user'
                      ?{background:`linear-gradient(135deg,${T.a},${T.b})`,color:'#fff',boxShadow:`0 2px 12px ${T.a}40`}
                      :{background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.85)',border:'1px solid rgba(255,255,255,0.07)'}}>
                    {m.content.split('
').map((line,j)=><span key={j}>{line}{j<m.content.split('
').length-1&&<br/>}</span>)}
                  </div>
                </div>
              ))}
              {aiLoading&&(
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mr-2" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>✦</div>
                  <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.07)'}}>
                    <div className="flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{animationDelay:'0ms'}}/>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{animationDelay:'150ms'}}/>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{animationDelay:'300ms'}}/>
                    </div>
                  </div>
                </div>
              )}
              <div ref={aiEndRef}/>
            </div>
            {/* Input */}
            <div className="flex-shrink-0 px-4 pb-4 pt-2">
              <div className="flex gap-2 rounded-2xl p-1" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <input
                  value={aiInput} onChange={e=>setAiInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!aiLoading){e.preventDefault();sendAiMessage();}}}
                  placeholder="Спроси что-нибудь..."
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white/80 outline-none placeholder-white/20"
                  disabled={aiLoading}
                />
                <button onClick={sendAiMessage} disabled={aiLoading||!aiInput.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-1.5 transition-all hover:opacity-85 active:scale-95 disabled:opacity-30"
                  style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>
                  <Send className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {/* ══ ПРОСМОТР ПРОФИЛЯ ══ */}
      {viewingProfile && (
        <Modal onClose={()=>setViewingProfile(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white/70 font-semibold flex items-center gap-2"><Info className="w-4 h-4"/>Профиль</h3>
              <button onClick={()=>setViewingProfile(null)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button>
            </div>
            {/* Аватар + имя */}
            <div className="flex flex-col items-center mb-6">
              <Avatar username={viewingProfile.username} displayName={viewingProfile.displayName} avatar={viewingProfile.avatar} size="lg"/>
              <div className="mt-3 text-center">
                <div className="text-white font-bold text-xl">{viewingProfile.displayName}</div>
                <div className="text-white/30 text-sm">@{viewingProfile.username}</div>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  {viewingProfile.isOnline&&<><span className="w-2 h-2 rounded-full bg-green-400"></span><span className="text-green-400 text-xs">онлайн</span></>}
                  {!viewingProfile.isOnline&&<><span className="w-2 h-2 rounded-full bg-gray-600"></span><span className="text-white/25 text-xs">не в сети</span></>}
                </div>
              </div>
            </div>
            {/* Bio */}
            {viewingProfile.bio && (
              <div className="mb-4 px-4 py-3 rounded-xl" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="text-[10px] text-white/20 uppercase tracking-widest mb-1">О себе</div>
                <div className="text-white/70 text-sm leading-relaxed">{viewingProfile.bio}</div>
              </div>
            )}
            {/* Дата регистрации */}
            <div className="px-4 py-3 rounded-xl mb-4" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="text-[10px] text-white/20 uppercase tracking-widest mb-1">В Whispr с</div>
              <div className="text-white/50 text-sm flex items-center gap-2"><Clock className="w-3.5 h-3.5"/>{new Date(viewingProfile.createdAt).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</div>
            </div>
            {/* Действия */}
            {viewingProfile.username !== currentUser?.username && (
              <div className="flex gap-2">
                <button onClick={()=>{setViewingProfile(null);const contact=contacts.find(c=>c.username===viewingProfile.username);if(contact)openDirectChat(contact);}}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>
                  <MessageSquare className="w-4 h-4"/>Написать
                </button>
                <button onClick={()=>handleBlockUser(viewingProfile.username, !contacts.find(c=>c.username===viewingProfile.username)?.isBlockedByMe)}
                  className="px-4 py-2.5 rounded-xl text-red-400/70 text-sm flex items-center gap-2 hover:bg-red-500/8 transition-colors"
                  style={{border:'1px solid rgba(239,68,68,0.15)'}}>
                  <Ban className="w-4 h-4"/>
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ СОЗДАТЬ КАНАЛ ══ */}
      {showCreateChannel&&(
        <Modal onClose={()=>setShowCreateChannel(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white/70 font-semibold flex items-center gap-2"><Radio className="w-4 h-4"/>Новый канал</h3>
              <button onClick={()=>setShowCreateChannel(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button>
            </div>
            <form onSubmit={handleCreateChannel} className="space-y-3">
              <input type="text" value={channelForm.name} onChange={e=>setChannelForm(p=>({...p,name:e.target.value}))} required
                className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20"
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Название канала"/>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">@</span>
                <input type="text" value={channelForm.username} onChange={e=>setChannelForm(p=>({...p,username:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'')}))} maxLength={32}
                  className="w-full pl-8 pr-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20"
                  style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="username (для поиска, необязательно)"/>
              </div>
              <textarea value={channelForm.description} onChange={e=>setChannelForm(p=>({...p,description:e.target.value}))} rows={2}
                className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20 resize-none"
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Описание (необязательно)"/>
              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>Создать канал</button>
            </form>
            {/* Поиск публичных каналов */}
            <div className="mt-4 pt-4" style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <p className="text-white/20 text-xs mb-2">Найти канал</p>
              <input type="text" value={channelSearch} onChange={e=>handleSearchChannels(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white/70 text-sm outline-none placeholder-white/20 mb-2"
                style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}} placeholder="Поиск каналов..."/>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {channelSearchResults.map(ch=>(
                  <div key={ch._id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{background:'rgba(255,255,255,0.03)'}}>
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}><Radio className="w-4 h-4 text-white"/></div>
                    <div className="flex-1 min-w-0"><div className="text-white/70 text-sm truncate">{ch.name}</div><div className="text-white/25 text-xs">{ch.username?`@${ch.username}`:''} · {ch.subscribers.length} подп.</div></div>
                    {!channels.find(x=>x._id===ch._id)&&(
                      <button onClick={()=>socket.emit('subscribe_channel',ch._id,res=>{if(res.success){setChannels(p=>[...p,res.channel]);openChannelChat(res.channel);setShowCreateChannel(false);}})}
                        className="px-2.5 py-1.5 rounded-lg text-white/50 text-xs hover:bg-white/8" style={{background:'rgba(255,255,255,0.05)'}}>Подписаться</button>
                    )}
                    {channels.find(x=>x._id===ch._id)&&<span className="text-white/25 text-xs">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ НАСТРОЙКИ КАНАЛА ══ */}
      {showChannelSettings&&editingChannel&&(
        <Modal onClose={()=>setShowChannelSettings(false)}>
          <div className="p-6" style={{maxHeight:'80vh',overflowY:'auto'}}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white/70 font-semibold flex items-center gap-2"><Radio className="w-4 h-4"/>Настройки канала</h3>
              <button onClick={()=>setShowChannelSettings(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button>
            </div>
            {/* Аватар канала */}
            <div className="flex justify-center mb-4">
              <label className="relative cursor-pointer group">
                <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>
                  {channelSettingsForm.avatar
                    ? <img src={channelSettingsForm.avatar} className="w-full h-full object-cover" alt=""/>
                    : <Radio className="w-8 h-8 text-white/60"/>}
                </div>
                <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{background:'rgba(0,0,0,0.5)'}}>
                  <Camera className="w-6 h-6 text-white"/>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e=>{
                  const f=e.target.files[0];if(!f)return;
                  const r=new FileReader();
                  r.onloadend=()=>setChannelSettingsForm(p=>({...p,avatar:r.result}));
                  r.readAsDataURL(f);
                }}/>
              </label>
            </div>
            <form onSubmit={handleUpdateChannel} className="space-y-3">
              <input type="text" value={channelSettingsForm.name||''} onChange={e=>setChannelSettingsForm(p=>({...p,name:e.target.value}))} required
                className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20"
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Название канала"/>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">@</span>
                <input type="text" value={channelSettingsForm.username||''} onChange={e=>setChannelSettingsForm(p=>({...p,username:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'')}))}
                  className="w-full pl-8 pr-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20"
                  style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="username (для поиска)"/>
              </div>
              <textarea value={channelSettingsForm.description||''} onChange={e=>setChannelSettingsForm(p=>({...p,description:e.target.value}))} rows={2}
                className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none placeholder-white/20 resize-none"
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)'}} placeholder="Описание канала"/>


              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity" style={{background:`linear-gradient(135deg,${T.a},${T.b})`}}>💾 Сохранить</button>
              <button type="button" onClick={()=>{if(confirm('Удалить канал навсегда?'))socket.emit('delete_channel',editingChannel._id,res=>{if(res.success){setShowChannelSettings(false);setChannels(p=>p.filter(x=>x._id!==editingChannel._id));setActiveChat(null);}});}}
                className="w-full py-2.5 rounded-xl text-red-400/70 text-sm hover:bg-red-500/8 transition-colors" style={{border:'1px solid rgba(239,68,68,0.15)'}}>🗑 Удалить канал</button>
            </form>
          </div>
        </Modal>
      )}

      {/* ══ ИСТОРИЯ ЗВОНКОВ ══ */}
      {showCallHistory&&(
        <Modal onClose={()=>setShowCallHistory(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white/70 font-semibold flex items-center gap-2"><PhoneCall className="w-4 h-4"/>История звонков</h3>
              <button onClick={()=>setShowCallHistory(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-white/30"/></button>
            </div>
            {callHistory.length===0&&<p className="text-center py-8 text-white/20 text-sm">Нет звонков</p>}
            <div className="space-y-2">
              {callHistory.map((log,i)=>{
                const isIncoming = log.to===currentUser?.username;
                const isMissed = log.status==='missed';
                const isCompleted = log.status==='completed';
                const peer = isIncoming ? log.from : log.to;
                const peerContact = contacts.find(c=>c.username===peer);
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.04)'}}>
                    <div className={`p-2 rounded-full flex-shrink-0 ${isMissed?'bg-red-500/10':isCompleted?'bg-green-500/10':'bg-orange-500/10'}`}>
                      {isMissed&&<PhoneMissed className="w-4 h-4 text-red-400"/>}
                      {isCompleted&&(isIncoming?<PhoneIncoming className="w-4 h-4 text-green-400"/>:<Phone className="w-4 h-4 text-green-400"/>)}
                      {log.status==='cancelled'&&<PhoneOff className="w-4 h-4 text-orange-400"/>}
                    </div>
                    <Avatar username={peer} displayName={peerContact?.displayName||peer} avatar={avatars[peer]} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isMissed?'text-red-400':isCompleted?'text-white/70':'text-orange-400'}`}>{peerContact?.displayName||peer}</div>
                      <div className="text-xs text-white/25 flex items-center gap-1.5">
                        {log.type==='video'?<Video className="w-3 h-3"/>:<Phone className="w-3 h-3"/>}
                        {isMissed&&'Пропущенный'}{isCompleted&&`${fmtDur(log.duration||0)}`}{log.status==='cancelled'&&'Отменён'}
                      </div>
                    </div>
                    <div className="text-xs text-white/20 flex-shrink-0">{fmtTime(log.timestamp)}</div>
                    <button onClick={()=>{setShowCallHistory(false);startCall(peer,'audio');}} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors"><Phone className="w-3.5 h-3.5 text-white/30"/></button>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ══ CALLS ══ */}
      {callState==='incoming'&&<IncomingCallOverlay from={callPeer} fromDisplay={contacts.find(c=>c.username===callPeer)?.displayName||callPeer} fromAvatar={avatars[callPeer]} onAccept={acceptCall} onReject={rejectCall}/>}
      {(callState==='calling'||callState==='active')&&<ActiveCallOverlay peer={callPeer} peerDisplay={contacts.find(c=>c.username===callPeer)?.displayName||callPeer} peerAvatar={avatars[callPeer]} duration={callDuration} muted={callMuted} onMute={toggleMute} onEnd={endCall} calling={callState==='calling'} localStream={localStreamRef.current} remoteStream={remoteStreamRef.current} callType={callType}/>}

      <div style={{position:'fixed',bottom:8,left:'50%',transform:'translateX(-50%)',color:'rgba(255,255,255,0.07)',fontSize:'10px',pointerEvents:'none',letterSpacing:'0.15em',zIndex:100}}>by Meowlentii</div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  @keyframes spin { to{transform:rotate(360deg)} }
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.09);border-radius:99px}
  ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.18)}
  *{-webkit-tap-highlight-color:transparent}
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes logoEntrance { from{opacity:0;transform:translateY(-16px) scale(0.92)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes popIn { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
  @keyframes listItem { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes msgIn { from{opacity:0;transform:translateY(7px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes sendBubble { 0%{opacity:0;transform:translateY(16px) scale(0.85)} 50%{transform:translateY(-5px) scale(1.04)} 75%{transform:translateY(2px) scale(0.98)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes pulse-soft { 0%,100%{opacity:1} 50%{opacity:0.5} }

  input::placeholder{transition:opacity 0.2s} input:focus::placeholder{opacity:0.4}
`;
