import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Send, Users, Search, UserPlus, Settings, LogOut, 
  Circle, Sparkles, Shield, Trash2, Crown, X, Check,
  MoreVertical, Menu
} from 'lucide-react';

const SERVER_URL = 'http://localhost:3001';

export default function WhisprPro() {
  const [socket, setSocket] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Форма входа/регистрации
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Контакты и чаты
  const [contacts, setContacts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  
  // Поиск пользователей
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Админ панель
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  
  // UI
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('new_message', (message) => {
      const chatPartner = message.from === currentUser?.username ? message.to : message.from;
      setMessages(prev => ({
        ...prev,
        [chatPartner]: [...(prev[chatPartner] || []), message]
      }));
    });

    newSocket.on('user_status_change', ({ username, isOnline }) => {
      setContacts(prev => prev.map(c => 
        c.username === username ? { ...c, isOnline } : c
      ));
    });

    newSocket.on('user_typing', ({ from }) => {
      setTypingUsers(prev => ({ ...prev, [from]: true }));
      
      if (typingTimeoutRef.current[from]) {
        clearTimeout(typingTimeoutRef.current[from]);
      }
      
      typingTimeoutRef.current[from] = setTimeout(() => {
        setTypingUsers(prev => {
          const newState = { ...prev };
          delete newState[from];
          return newState;
        });
      }, 2000);
    });

    newSocket.on('force_disconnect', ({ reason }) => {
      alert(reason);
      handleLogout();
    });

    return () => newSocket.close();
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);

  const handleRegister = (e) => {
    e.preventDefault();
    setAuthError('');
    
    socket.emit('register', 
      { username, displayName, password }, 
      (response) => {
        if (response.success) {
          handleLogin(e);
        } else {
          setAuthError(response.error);
        }
      }
    );
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError('');
    
    socket.emit('login', 
      { username, password }, 
      (response) => {
        if (response.success) {
          setCurrentUser(response.user);
          setContacts(response.contacts || []);
          setIsAuthenticated(true);
        } else {
          setAuthError(response.error);
        }
      }
    );
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setContacts([]);
    setActiveChat(null);
    setMessages({});
    setUsername('');
    setPassword('');
    setDisplayName('');
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    socket.emit('search_users', query, (response) => {
      if (response.success) {
        setSearchResults(response.results);
      }
    });
  };

  const handleAddContact = (targetUsername) => {
    socket.emit('add_contact', targetUsername, (response) => {
      if (response.success) {
        setContacts(prev => [...prev, response.contact]);
        setSearchResults([]);
        setSearchQuery('');
        setShowSearch(false);
      }
    });
  };

  const handleRemoveContact = (targetUsername) => {
    if (confirm(`Удалить ${targetUsername} из контактов?`)) {
      socket.emit('remove_contact', targetUsername, (response) => {
        if (response.success) {
          setContacts(prev => prev.filter(c => c.username !== targetUsername));
          if (activeChat === targetUsername) {
            setActiveChat(null);
          }
        }
      });
    }
  };

  const handleOpenChat = (contactUsername) => {
    setActiveChat(contactUsername);
    setShowSearch(false);
    
    socket.emit('load_chat', contactUsername, (response) => {
      if (response.success) {
        setMessages(prev => ({
          ...prev,
          [contactUsername]: response.messages
        }));
      }
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChat) return;
    
    socket.emit('send_message', 
      { to: activeChat, text: inputMessage.trim() },
      (response) => {
        if (response.success) {
          setInputMessage('');
        }
      }
    );
  };

  const handleTyping = () => {
    if (activeChat) {
      socket.emit('typing', activeChat);
    }
  };

  const loadAdminStats = () => {
    socket.emit('admin_get_stats', (response) => {
      if (response.success) {
        setAdminStats(response.stats);
      }
    });
    
    socket.emit('admin_get_users', (response) => {
      if (response.success) {
        setAllUsers(response.users);
      }
    });
  };

  const handleDeleteUser = (targetUsername) => {
    if (confirm(`УДАЛИТЬ пользователя ${targetUsername}? Это необратимо!`)) {
      socket.emit('admin_delete_user', targetUsername, (response) => {
        if (response.success) {
          loadAdminStats();
        } else {
          alert(response.error);
        }
      });
    }
  };

  const handlePromoteUser = (targetUsername) => {
    if (confirm(`Сделать ${targetUsername} администратором?`)) {
      socket.emit('admin_promote_user', targetUsername, (response) => {
        if (response.success) {
          loadAdminStats();
        } else {
          alert(response.error);
        }
      });
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  // AUTH SCREEN
  if (!isAuthenticated) {
    return (
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
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
              Whispr
            </h1>
            <p className="text-white/80 text-sm">Мессенджер нового поколения</p>
          </div>
          
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="relative space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all"
                placeholder="username"
                required
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Имя для отображения
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all"
                  placeholder="Ваше имя"
                  required={isRegistering}
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {authError && (
              <div className="text-red-300 text-sm bg-red-500/20 px-3 py-2 rounded-lg">
                {authError}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-white/20 backdrop-blur-xl border border-white/30 text-white py-3 rounded-xl font-medium hover:bg-white/30 hover:scale-[1.02] transition-all shadow-lg"
            >
              {isRegistering ? 'Зарегистрироваться' : 'Войти'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError('');
              }}
              className="w-full text-white/70 text-sm hover:text-white transition-colors"
            >
              {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
            </button>
          </form>
        </div>

        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
        `}</style>
      </div>
    );
  }

  // MAIN APP
  const activeChatData = contacts.find(c => c.username === activeChat);
  const chatMessages = messages[activeChat] || [];

  return (
    <div className="h-screen relative overflow-hidden flex">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`relative w-80 backdrop-blur-2xl bg-white/10 border-r border-white/20 flex flex-col transition-all ${showSidebar ? '' : '-ml-80'}`}>
        {/* Header */}
        <div className="p-4 border-b border-white/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xl flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white drop-shadow">
                Whispr
              </h2>
            </div>
            <div className="flex gap-1">
              {currentUser?.isAdmin && (
                <button
                  onClick={() => {
                    setShowAdminPanel(true);
                    loadAdminStats();
                  }}
                  className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  title="Админ панель"
                >
                  <Shield className="w-4 h-4 text-white" />
                </button>
              )}
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                title="Выйти"
              >
                <LogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          <p className="text-xs text-white/70">@{currentUser?.username}</p>
        </div>

        {/* Search Button */}
        <div className="p-4">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-full px-4 py-2 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl text-white flex items-center gap-2 hover:bg-white/30 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Найти пользователей</span>
          </button>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Контакты ({contacts.length})</span>
          </div>
          
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.username}
                onClick={() => handleOpenChat(contact.username)}
                className={`px-3 py-3 rounded-xl cursor-pointer transition-all group ${
                  activeChat === contact.username
                    ? 'bg-white/30 backdrop-blur-xl border border-white/40'
                    : 'bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Circle className={`w-2 h-2 ${contact.isOnline ? 'fill-green-400 text-green-400 animate-pulse' : 'fill-gray-400 text-gray-400'}`} />
                    <div>
                      <div className="text-sm font-medium text-white">{contact.displayName}</div>
                      <div className="text-xs text-white/60">@{contact.username}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveContact(contact.username);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded transition-all"
                  >
                    <X className="w-4 h-4 text-white/70" />
                  </button>
                </div>
              </div>
            ))}

            {contacts.length === 0 && (
              <div className="text-center py-8 text-white/60 text-sm">
                Нет контактов.<br/>Используй поиск чтобы добавить!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="relative flex-1 flex flex-col">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 backdrop-blur-2xl bg-white/10 border-b border-white/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="lg:hidden p-2 rounded-lg bg-white/20 hover:bg-white/30"
                >
                  <Menu className="w-5 h-5 text-white" />
                </button>
                <div>
                  <div className="text-white font-medium">{activeChatData?.displayName}</div>
                  <div className="text-xs text-white/60">
                    {activeChatData?.isOnline ? (
                      <span className="flex items-center gap-1">
                        <Circle className="w-2 h-2 fill-green-400 text-green-400" />
                        онлайн
                      </span>
                    ) : (
                      'не в сети'
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((msg) => {
                const isOwn = msg.from === currentUser?.username;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md rounded-2xl px-4 py-3 backdrop-blur-xl transition-all ${
                        isOwn
                          ? 'bg-white/25 border border-white/30 text-white shadow-lg'
                          : 'bg-white/15 border border-white/25 text-white shadow-md'
                      }`}
                    >
                      <div className="text-sm leading-relaxed">{msg.text}</div>
                      <div className="text-xs mt-1 text-white/60">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              
              {typingUsers[activeChat] && (
                <div className="text-sm text-white/70 italic backdrop-blur-sm bg-white/10 inline-block px-3 py-1 rounded-full">
                  печатает...
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 backdrop-blur-2xl bg-white/10 border-t border-white/20">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    handleTyping();
                  }}
                  className="flex-1 px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all"
                  placeholder="Напишите сообщение..."
                />
                <button
                  type="submit"
                  className="bg-white/20 backdrop-blur-xl border border-white/30 text-white px-6 py-3 rounded-xl hover:bg-white/30 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/60">
              <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Выберите чат или найдите собеседника</p>
            </div>
          </div>
        )}
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSearch(false)}>
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Поиск пользователей</h3>
              <button onClick={() => setShowSearch(false)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all mb-4"
              placeholder="Введите username или имя..."
              autoFocus
            />

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((user) => (
                <div key={user.username} className="px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{user.displayName}</div>
                    <div className="text-sm text-white/60">@{user.username}</div>
                  </div>
                  <button
                    onClick={() => handleAddContact(user.username)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm flex items-center gap-1 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>
              ))}

              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8 text-white/60">
                  Ничего не найдено
                </div>
              )}

              {searchQuery.length < 2 && (
                <div className="text-center py-8 text-white/60">
                  Введите минимум 2 символа
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && currentUser?.isAdmin && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdminPanel(false)}>
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="w-6 h-6" />
                Админ Панель
              </h3>
              <button onClick={() => setShowAdminPanel(false)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Stats */}
            {adminStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl">
                  <div className="text-white/70 text-sm">Всего пользователей</div>
                  <div className="text-2xl font-bold text-white">{adminStats.totalUsers}</div>
                </div>
                <div className="p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl">
                  <div className="text-white/70 text-sm">Онлайн</div>
                  <div className="text-2xl font-bold text-white">{adminStats.onlineUsers}</div>
                </div>
                <div className="p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl">
                  <div className="text-white/70 text-sm">Всего сообщений</div>
                  <div className="text-2xl font-bold text-white">{adminStats.totalMessages}</div>
                </div>
                <div className="p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl">
                  <div className="text-white/70 text-sm">Чаты</div>
                  <div className="text-2xl font-bold text-white">{adminStats.totalChats}</div>
                </div>
              </div>
            )}

            {/* Users List */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Все пользователи</h4>
              <div className="space-y-2">
                {allUsers.map((user) => (
                  <div key={user.username} className="px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Circle className={`w-2 h-2 ${user.isOnline ? 'fill-green-400 text-green-400' : 'fill-gray-400 text-gray-400'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{user.displayName}</span>
                          {user.isAdmin && <Crown className="w-4 h-4 text-yellow-400" />}
                        </div>
                        <div className="text-sm text-white/60">
                          @{user.username} • {user.contactsCount} контактов
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!user.isAdmin && (
                        <>
                          <button
                            onClick={() => handlePromoteUser(user.username)}
                            className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm flex items-center gap-1"
                            title="Сделать админом"
                          >
                            <Crown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-center gap-1"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 12, left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '12px', zIndex: 100,
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}>
        by Meowlentii
      </div>
    </div>
  );
}