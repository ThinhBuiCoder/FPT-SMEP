import { useState, useEffect, useRef, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';
import { chatApi } from '../../api/chatApi';
import {
  MessageSquare, Send, Users, Shield, GraduationCap, Star,
  Search, Loader2, Clock, User, Paperclip, Pencil, X,
  ChevronRight, BadgeCheck, UserCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');
// ─── Role helpers ────────────────────────────────────────────────────────────
const roleConfig = {
  ADMIN:    { color: 'bg-red-50 text-red-700 border-red-200',     icon: <Shield       className="w-3 h-3 text-red-500 shrink-0" />,     label: 'Admin' },
  LECTURER: { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <GraduationCap className="w-3 h-3 text-purple-500 shrink-0" />, label: 'Lecturer' },
  MENTOR:   { color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: <Star         className="w-3 h-3 text-amber-500 shrink-0" />,    label: 'Mentor' },
  STUDENT:  { color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: null,                                                            label: 'Student' },
};

const normalizeRole = (r = '') => r.toUpperCase();

const roleBadge = (role) => {
  const cfg = roleConfig[normalizeRole(role)] || roleConfig.STUDENT;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
};

// ─── Avatar fallback ─────────────────────────────────────────────────────────
const Avatar = ({ src, name, size = 'md' }) => {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  const initial = (name || '?')[0].toUpperCase();
  if (src) return <img src={src} alt={name} className={`${sz} rounded-full border border-slate-200 object-cover shrink-0`} />;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shrink-0`}>
      {initial}
    </div>
  );
};

// ─── Members Panel ───────────────────────────────────────────────────────────
function MembersPanel({ chatGroupId, currentUserId, onClose, onNicknameChange }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [nickInput, setNickInput] = useState('');
  const [saving, setSaving]     = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await chatApi.getMembers(chatGroupId);
      setData(res?.data || res);
    } catch {
      toast.error('Could not load member list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatGroupId) fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatGroupId]);

  // Pre-fill current user nickname
  useEffect(() => {
    if (data?.members) {
      const me = data.members.find(m => m.userId?.toString() === currentUserId?.toString());
      setNickInput(me?.nickname || '');
    }
  }, [data, currentUserId]);

  const handleSaveNickname = async () => {
    setSaving(true);
    try {
      await chatApi.updateNickname(chatGroupId, nickInput.trim() || null);
      toast.success('Nickname updated!');
      setEditing(false);
      // Notify parent to update nicknameMap immediately
      if (onNicknameChange) {
        onNicknameChange(currentUserId, nickInput.trim() || null);
      }
      fetchMembers();
    } catch {
      toast.error('Could not save nickname.');
    } finally {
      setSaving(false);
    }
  };

  const myMember = data?.members?.find(m => m.userId?.toString() === currentUserId?.toString());

  return (
    <div className="w-72 border-l border-slate-100 flex flex-col shrink-0 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm text-slate-800">Members</span>
          {data?.members && (
            <span className="text-xs text-slate-400 font-medium">({data.members.length})</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* My Nickname section */}
      {myMember !== undefined && (
        <div className="mx-3 my-3 p-3 rounded-xl border border-primary-100 bg-primary-50/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary-700 flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5" /> Your Nickname
            </span>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] text-primary hover:text-primary-700 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
          {editing ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={nickInput}
                onChange={e => setNickInput(e.target.value)}
                maxLength={50}
                placeholder="Enter nickname..."
                className="flex-1 text-xs px-2.5 py-1.5 border border-primary-200 rounded-lg focus:outline-none focus:border-primary bg-white"
                onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(); if (e.key === 'Escape') setEditing(false); }}
                autoFocus
              />
              <button
                onClick={handleSaveNickname}
                disabled={saving}
                className="px-2.5 py-1.5 bg-primary text-white text-xs rounded-lg font-semibold hover:bg-primary-600 disabled:opacity-50 cursor-pointer transition-all"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-700">
              {myMember?.nickname ? (
                <span className="text-primary-700">{myMember.nickname}</span>
              ) : (
                <span className="text-slate-400 italic text-xs">No nickname set</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Members list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {loading ? (
          <div className="flex justify-center pt-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : !data?.members?.length ? (
          <p className="text-xs text-center text-slate-400 pt-6">No members found.</p>
        ) : (
          data.members.map((m, i) => (
            <div
              key={m.userId || m.studentId || i}
              className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Avatar src={m.avatar} name={m.displayName} size="sm" />
              <div className="flex-1 min-w-0">
                {/* Nickname (nếu có) hiển thị nổi bật */}
                {m.nickname ? (
                  <>
                    <p className="text-xs font-bold text-primary-700 break-words leading-snug">
                      {m.nickname}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium break-words leading-snug mt-0.5">
                      {m.displayName || 'Unknown'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-slate-800 break-words leading-snug">
                    {m.displayName || 'Unknown'}
                  </p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {roleBadge(m.role)}
                  {m.userId?.toString() === currentUserId?.toString() && (
                    <span className="text-[9px] text-primary font-bold bg-primary-50 border border-primary-100 px-1.5 py-0.5 rounded-md">
                      You
                    </span>
                  )}
                </div>
                {m.email && (
                  <p className="text-[10px] text-slate-400 break-words mt-0.5">{m.email}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main GroupChat Component ─────────────────────────────────────────────────
export default function GroupChat() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const initialGroupId = searchParams.get('groupId');

  const [channels, setChannels]             = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages]             = useState([]);
  const [inputText, setInputText]           = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [showMembers, setShowMembers]       = useState(false);
  // userId → nickname map cho channel đang chọn
  const [nicknameMap, setNicknameMap]       = useState({});

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading]       = useState(false);

  const socketRef        = useRef(null);
  const chatEndRef       = useRef(null);
  const fileInputRef     = useRef(null);
  const selectedChannelRef = useRef(null); // track current channel for reconnect

  // ─── Socket.io ───────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Re-join room after connect/reconnect
      if (selectedChannelRef.current) {
        socket.emit('join_room', selectedChannelRef.current._id);
      }
    });

    socket.on('receive_message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 100);
    });

    return () => socket.disconnect();
  }, []);

  // ─── Load Channels ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await chatApi.getChannels();
        const data = res?.data || res || [];
        setChannels(data);
        if (data.length > 0) {
          const target = initialGroupId ? data.find(c => c._id === initialGroupId) : data[0];
          setSelectedChannel(target || data[0]);
        }
      } catch {
        toast.error('Could not load chat channels.');
      } finally {
        setLoadingChannels(false);
      }
    };
    fetchChannels();
  }, [initialGroupId]);

  // ─── Join Room, Load History & build Nickname Map ───────────────────────────
  useEffect(() => {
    if (!selectedChannel || !socketRef.current) return;
    selectedChannelRef.current = selectedChannel; // track for reconnect
    const joinAndLoad = async () => {
      setLoadingMessages(true);
      setShowMembers(false);
      setNicknameMap({});
      try {
        socketRef.current.emit('leave_room', selectedChannel._id);
        // Only join if socket is already connected; connect handler handles the rest
        if (socketRef.current.connected) {
          socketRef.current.emit('join_room', selectedChannel._id);
        }

        // Load messages & members concurrently
        const [msgRes, memberRes] = await Promise.allSettled([
          chatApi.getMessages(selectedChannel._id),
          chatApi.getMembers(selectedChannel._id),
        ]);

        if (msgRes.status === 'fulfilled') {
          setMessages(msgRes.value?.data || msgRes.value || []);
          setTimeout(scrollToBottom, 100);
        } else {
          toast.error('Could not load message history.');
        }

        // Build { userId: nickname } map
        if (memberRes.status === 'fulfilled') {
          const members = memberRes.value?.data?.members || memberRes.value?.members || [];
          const map = {};
          members.forEach(m => {
            if (m.userId && m.nickname) {
              map[m.userId.toString()] = m.nickname;
            }
          });
          setNicknameMap(map);
        }
      } finally {
        setLoadingMessages(false);
      }
    };
    joinAndLoad();
  }, [selectedChannel]);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must not exceed 10MB'); return; }
    setSelectedFile(file);
  };

  // ─── Send Message ─────────────────────────────────────────────────────────
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedChannel || !socketRef.current) return;
    if (!inputText.trim() && !selectedFile) return;

    let attachmentPayload = null;
    if (selectedFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await chatApi.uploadFile(formData);
        const d = res?.data || res;
        attachmentPayload = { url: d.url, name: d.name, fileType: d.fileType };
      } catch (err) {
        toast.error(err?.message || 'Upload failed');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const myId = (user?._id || user?.id || '').toString();
    const myNickname = nicknameMap[myId] || null;

    // Normalize role to uppercase ENUM value expected by backend schema
    const validRoles = ['ADMIN', 'LECTURER', 'STUDENT', 'MENTOR'];
    const rawRole = (user?.role || 'STUDENT').toUpperCase();
    const senderRole = validRoles.includes(rawRole) ? rawRole : 'STUDENT';

    if (!myId) {
      toast.error('Không thể gửi tin nhắn: chưa xác thực người dùng.');
      return;
    }

    if (!socketRef.current?.connected) {
      toast.error('Mất kết nối real-time. Đang thử kết nối lại...');
      return;
    }

    socketRef.current.emit('send_message', {
      chatGroupId: selectedChannel._id,
      senderId:    user?._id || user?.id,
      senderName:  myNickname || user?.name || 'Anonymous',
      senderRole,
      text:        inputText.trim(),
      attachment:  attachmentPayload,
    });
    setInputText('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredChannels = channels.filter(c =>
    c.groupName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.team?.teamName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.class?.classCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loadingChannels) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-400 mt-2 font-medium">Loading chat...</p>
      </div>
    );
  }

  const currentUserId = user?._id || user?.id;

  return (
    <div className="h-[calc(100vh-130px)] max-w-7xl mx-auto flex bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-xs">

      {/* 1. Left Channels Sidebar */}
      <div className="w-72 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/50">
        {/* Search header */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search chat groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-all bg-slate-50/30"
            />
          </div>
        </div>

        {/* Channels listing */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredChannels.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 font-medium">
              No chat groups found.
            </div>
          ) : (
            filteredChannels.map((c) => {
              const isSelected = selectedChannel?._id === c._id;
              const lastMsgText = c.lastMessage?.text || 'No messages yet';
              const lastMsgSender = c.lastMessage?.senderName ? `${c.lastMessage.senderName}: ` : '';

              return (
                <button
                  key={c._id}
                  onClick={() => setSelectedChannel(c)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 relative ${
                    isSelected
                      ? 'bg-primary-50/80 border-primary-100 text-primary shadow-xs'
                      : 'hover:bg-slate-100/60 text-slate-700'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Group name in EXE201g format */}
                    <p className={`font-bold text-sm truncate ${isSelected ? 'text-primary' : 'text-slate-800'}`}>
                      {c.groupName}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                      {c.class?.classCode || 'Startup Group'}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-1">
                      <span className="font-semibold">{lastMsgSender}</span>{lastMsgText}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Right Chat Screen */}
      <div className="flex-1 flex flex-col bg-slate-50/20 min-w-0">
        {selectedChannel ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 leading-tight text-base">
                    {selectedChannel.groupName}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Class: {selectedChannel.class?.classCode || '—'} · {selectedChannel.team?.teamCode || 'General'}
                  </p>
                </div>
              </div>

              {/* Toggle Members Panel */}
              <button
                onClick={() => setShowMembers(v => !v)}
                title="View members"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  showMembers
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Members</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showMembers ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Messages + optional Members panel */}
            <div className="flex-1 flex overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <p className="text-xs text-slate-400 mt-1 font-medium">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <MessageSquare className="w-16 h-16 stroke-1 mb-2 animate-bounce" />
                    <p className="text-sm font-semibold">Welcome to the group chat!</p>
                    <p className="text-xs text-slate-400 mt-0.5">Start the conversation with your group.</p>
                  </div>
                ) : (
                  messages.map((m, index) => {
                    const isMine = m.senderId?._id === currentUserId || m.senderId === currentUserId;
                    const senderAvatar = m.senderId?.avatar;
                    const formattedTime = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    // Ưu tiên nickname từ map; fallback về senderName đã lưu
                    const senderId = (m.senderId?._id || m.senderId || '').toString();
                    const resolvedName = (senderId && nicknameMap[senderId]) || m.senderName;
                    const hasNickname  = senderId && !!nicknameMap[senderId];

                    return (
                      <div
                        key={m._id || index}
                        className={`flex gap-3 max-w-[80%] ${isMine ? 'ml-auto flex-row-reverse' : ''}`}
                      >
                        {/* Avatar */}
                        {senderAvatar ? (
                          <img src={senderAvatar} alt={resolvedName} className="w-8 h-8 rounded-full border border-slate-100 shrink-0 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 border border-slate-300 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        )}

                        {/* Bubble */}
                        <div className="space-y-1">
                          <div className={`flex items-center gap-1.5 flex-wrap ${isMine ? 'justify-end' : ''}`}>
                            {/* Tên hiển thị: nickname (primary) + tên thật nhỏ bên cạnh */}
                            <span className={`text-xs font-bold ${hasNickname ? 'text-primary-700' : 'text-slate-800'}`}>
                              {resolvedName}
                            </span>
                            {hasNickname && (
                              <span className="text-[10px] text-slate-400 font-medium">({m.senderName})</span>
                            )}
                            {roleBadge(m.senderRole)}
                          </div>

                          <div className={`p-3 rounded-2xl text-sm leading-relaxed break-words ${
                            isMine
                              ? 'bg-primary text-white rounded-tr-none'
                              : 'bg-white border border-slate-200/60 text-slate-800 rounded-tl-none shadow-3xs'
                          }`}>
                            {m.text && <p className="whitespace-pre-line">{m.text}</p>}

                            {m.attachment?.url && (
                              <div className="mt-2 max-w-xs">
                                {m.attachment.fileType === 'image' ? (
                                  <a href={m.attachment.url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={m.attachment.url}
                                      alt={m.attachment.name || 'Attachment'}
                                      className="max-w-full max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={m.attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold ${
                                      isMine
                                        ? 'bg-primary-600/50 border-primary-500 text-white hover:bg-primary-600'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    } transition-all`}
                                  >
                                    <Paperclip className="w-4 h-4 shrink-0" />
                                    <span className="truncate max-w-[150px]">{m.attachment.name || 'Download file'}</span>
                                  </a>
                                )}
                              </div>
                            )}

                            <span className={`text-[9px] mt-1.5 block opacity-60 text-right flex items-center justify-end gap-1 ${
                              isMine ? 'text-primary-100' : 'text-slate-400'
                            }`}>
                              <Clock className="w-2.5 h-2.5" />
                              {formattedTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Members Panel */}
              {showMembers && (
                <MembersPanel
                  chatGroupId={selectedChannel._id}
                  currentUserId={currentUserId}
                  onClose={() => setShowMembers(false)}
                  onNicknameChange={(userId, nickname) => {
                    setNicknameMap(prev => {
                      const next = { ...prev };
                      if (nickname) {
                        next[userId.toString()] = nickname;
                      } else {
                        delete next[userId.toString()];
                      }
                      return next;
                    });
                  }}
                />
              )}
            </div>

            {/* Input Form */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0 space-y-2">
              {uploading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Uploading file...</span>
                </div>
              )}
              {selectedFile && (
                <div className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-semibold">{selectedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-red-500 hover:text-red-700 font-bold shrink-0 ml-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed,text/plain"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-500 transition-all cursor-pointer shrink-0"
                  title="Upload image or file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={selectedFile ? 'Add a message or press Send...' : 'Type a message...'}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-all bg-slate-50/20"
                />
                <button
                  type="submit"
                  disabled={uploading || (!inputText.trim() && !selectedFile)}
                  className="px-4 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-600 disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Send <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <MessageSquare className="w-16 h-16 stroke-1 mb-2" />
            <p className="text-sm font-semibold">No chat channel selected</p>
          </div>
        )}
      </div>

    </div>
  );
}
