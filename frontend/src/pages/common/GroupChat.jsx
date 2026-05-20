import { useState, useEffect, useRef, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';
import { chatApi } from '../../api/chatApi';
import {
  MessageSquare, Send, Users, Shield, GraduationCap, Star,
  Search, Loader2, ArrowLeft, Clock, User, Paperclip
} from 'lucide-react';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const roleColor = (role) => {
  if (role === 'ADMIN') return 'bg-red-50 text-red-700 border-red-100';
  if (role === 'LECTURER') return 'bg-purple-50 text-purple-700 border-purple-100';
  if (role === 'MENTOR') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-blue-50 text-blue-700 border-blue-100';
};

const roleIcon = (role) => {
  if (role === 'ADMIN') return <Shield className="w-3 h-3 text-red-500 shrink-0" />;
  if (role === 'LECTURER') return <GraduationCap className="w-3 h-3 text-purple-500 shrink-0" />;
  if (role === 'MENTOR') return <Star className="w-3 h-3 text-amber-500 shrink-0" />;
  return null;
};

export default function GroupChat() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const initialGroupId = searchParams.get('groupId');

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // ─── Socket.io Connection & Listeners ──────────────────────────────────────
  useEffect(() => {
    // Connect to backend websocket server
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Connected to Socket.io server:', socket.id);
    });

    // Listen to real-time incoming messages
    socket.on('receive_message', (msg) => {
      setMessages((prev) => {
        // Prevent duplicate messages if already present
        const exists = prev.some((m) => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
      // Scroll down
      setTimeout(scrollToBottom, 100);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // ─── Load Channels List ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await chatApi.getChannels();
        const data = res?.data || res || [];
        setChannels(data);

        // Auto-select initial group if provided in query params, else select first channel
        if (data.length > 0) {
          const target = initialGroupId
            ? data.find(c => c._id === initialGroupId)
            : data[0];
          setSelectedChannel(target || data[0]);
        }
      } catch (err) {
        toast.error('Failed to load chat channels');
      } finally {
        setLoadingChannels(false);
      }
    };
    fetchChannels();
  }, [initialGroupId]);

  // ─── Room Join & Message History fetch on channel select ───────────────────
  useEffect(() => {
    if (!selectedChannel || !socketRef.current) return;

    const joinRoomAndLoadHistory = async () => {
      setLoadingMessages(true);
      try {
        // Leave old room if any
        socketRef.current.emit('leave_room', selectedChannel._id);

        // Join new room
        socketRef.current.emit('join_room', selectedChannel._id);

        // Fetch past messages
        const res = await chatApi.getMessages(selectedChannel._id);
        const data = res?.data || res || [];
        setMessages(data);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        toast.error('Failed to load message history');
      } finally {
        setLoadingMessages(false);
      }
    };

    joinRoomAndLoadHistory();
  }, [selectedChannel]);

  // ─── Scroll to Bottom Helper ──────────────────────────────────────────────
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size cannot exceed 10MB');
        return;
      }
      setSelectedFile(file);
    }
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
        const data = res?.data || res;
        attachmentPayload = {
          url: data.url,
          name: data.name,
          fileType: data.fileType
        };
      } catch (err) {
        toast.error(err?.message || 'Failed to upload file');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const messagePayload = {
      chatGroupId: selectedChannel._id,
      senderId: user?._id || user?.id,
      senderName: user?.name || 'Anonymous User',
      senderRole: user?.role || 'STUDENT',
      text: inputText.trim(),
      attachment: attachmentPayload
    };

    // Emit via Socket.io for instant real-time broadcast and DB persist
    socketRef.current.emit('send_message', messagePayload);
    setInputText('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filter channels
  const filteredChannels = channels.filter(c =>
    c.groupName?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
    c.team?.teamName?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
    c.class?.classCode?.toLowerCase()?.includes(searchQuery.toLowerCase())
  );

  if (loadingChannels) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-400 mt-2 font-medium">Initializing chat terminal...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-130px)] max-w-6xl mx-auto flex bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-xs">
      
      {/* 1. Left Channels Sidebar */}
      <div className="w-80 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/50">
        {/* Search header */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search startup channels..."
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
      <div className="flex-1 flex flex-col bg-slate-50/20">
        {selectedChannel ? (
          <>
            {/* Header info */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 leading-tight">{selectedChannel.groupName}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Class: {selectedChannel.class?.classCode || '—'} · Team Code: {selectedChannel.team?.teamCode || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <p className="text-xs text-slate-400 mt-1 font-medium">Syncing history...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                  <MessageSquare className="w-16 h-16 stroke-1 mb-2 animate-bounce" />
                  <p className="text-sm font-semibold">Welcome to the channel chatroom!</p>
                  <p className="text-xs text-slate-400 mt-0.5">Exchange real-time ideas with your members.</p>
                </div>
              ) : (
                messages.map((m, index) => {
                  const isMine = m.senderId?._id === user?._id || m.senderId === user?._id;
                  const senderAvatar = m.senderId?.avatar;
                  const formattedTime = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={m._id || index}
                      className={`flex gap-3 max-w-[80%] ${isMine ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      {senderAvatar ? (
                        <img
                          src={senderAvatar}
                          alt={m.senderName}
                          className="w-8 h-8 rounded-full border border-slate-100 shrink-0 object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                      )}

                      {/* Bubble */}
                      <div className="space-y-1">
                        <div className={`flex items-center gap-1.5 ${isMine ? 'justify-end' : ''}`}>
                          <span className="text-xs font-bold text-slate-800">{m.senderName}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md border flex items-center gap-0.5 uppercase tracking-wider ${roleColor(m.senderRole)}`}>
                            {roleIcon(m.senderRole)}
                            {m.senderRole}
                          </span>
                        </div>

                        <div className={`p-3 rounded-2xl text-sm leading-relaxed break-words relative group ${
                          isMine
                            ? 'bg-primary text-white rounded-tr-none'
                            : 'bg-white border border-slate-200/60 text-slate-800 rounded-tl-none shadow-3xs'
                        }`}>
                          {m.text && <p className="whitespace-pre-line">{m.text}</p>}
                          
                          {m.attachment && m.attachment.url && (
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
                  placeholder={selectedFile ? "Add a message or press Send..." : "Type your real-time message..."}
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
            <p className="text-sm font-semibold">No active chatroom channel</p>
          </div>
        )}
      </div>

    </div>
  );
}
