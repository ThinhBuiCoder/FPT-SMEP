// src/server.js — Real-Time Socket.io Group Chat Enabled
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const app = require('./app');
const Message = require('./models/Message');
const User = require('./models/User');
const ChatGroup = require('./models/ChatGroup');

const PORT = process.env.PORT || 5000;
const MESSAGE_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '👏']);

// Create HTTP server wrapping express app
const server = http.createServer(app);

// Attach Socket.io
const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// ── In-memory presence map: socketId → userId ─────────────────
const onlineUsers = new Map(); // socketId → userId

/**
 * Tính danh sách userId unique đang online
 */
const getOnlineUserIds = () => [...new Set(onlineUsers.values())];

/**
 * Broadcast danh sách online users tới tất cả connected clients
 */
const broadcastOnlineUsers = () => {
  const userIds = getOnlineUserIds();
  io.emit('online_users', { count: userIds.length, userIds });
};

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // ── Presence: user đăng ký online ──────────────────────────
  socket.on('user_online', async (userId) => {
    if (!userId) return;
    onlineUsers.set(socket.id, userId);
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
    } catch (err) {
      console.warn('[Presence] Could not update online status:', err.message);
    }
    broadcastOnlineUsers();
  });

  // User joins their team's chat group room
  socket.on('join_room', (chatGroupId) => {
    socket.join(chatGroupId);
    console.log(`👥 Socket ${socket.id} joined room: ${chatGroupId}`);
  });

  // User leaves a room
  socket.on('leave_room', (chatGroupId) => {
    socket.leave(chatGroupId);
    console.log(`🚪 Socket ${socket.id} left room: ${chatGroupId}`);
  });

  // Real-time message receiver
  socket.on('send_message', async (data) => {
    try {
      const { chatGroupId, senderId, senderName, senderRole, text, attachment, sticker, mentions } = data;

      if (!chatGroupId || !senderId || (!text && !attachment && !sticker)) {
        console.error('⚠️ Invalid send_message data received:', data);
        return;
      }

      // Persist to MongoDB
      const savedMessage = await Message.create({
        chatGroupId,
        senderId,
        senderName,
        senderRole,
        text: text || '',
        messageType: sticker ? 'STICKER' : 'TEXT',
        sticker: sticker || null,
        mentions: Array.isArray(mentions) ? mentions : [],
        attachment: attachment || null,
      });

      // Populate senderId for consistent frontend avatars/rendering
      const populated = await Message.findById(savedMessage._id)
        .populate('senderId', 'name email avatar');

      // Broadcast to everyone in the room
      io.to(chatGroupId).emit('receive_message', populated);
      console.log(`💬 Message broadcasted in ${chatGroupId}: "${text}" by ${senderName}`);
    } catch (err) {
      console.error('❌ Error handling send_message socket event:', err.message);
    }
  });

  // ── Presence: disconnect ─────────────────────────────────────
  socket.on('edit_message', async (data) => {
    try {
      const { messageId, senderId, text } = data;
      if (!messageId || !senderId || !text?.trim()) return;

      const message = await Message.findById(messageId);
      if (!message || message.isRevoked) return;
      if (message.senderId.toString() !== senderId.toString()) return;

      message.text = text.trim();
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      const populated = await Message.findById(message._id)
        .populate('senderId', 'name email avatar');
      io.to(message.chatGroupId.toString()).emit('message_updated', populated);
    } catch (err) {
      console.error('Error handling edit_message socket event:', err.message);
    }
  });

  socket.on('revoke_message', async (data) => {
    try {
      const { messageId, senderId } = data;
      if (!messageId || !senderId) return;

      const message = await Message.findById(messageId);
      if (!message || message.isRevoked) return;
      if (message.senderId.toString() !== senderId.toString()) return;

      message.text = '';
      message.attachment = null;
      message.sticker = null;
      message.reactions = [];
      message.isRevoked = true;
      message.revokedAt = new Date();
      await message.save();

      const populated = await Message.findById(message._id)
        .populate('senderId', 'name email avatar');
      io.to(message.chatGroupId.toString()).emit('message_revoked', populated);
    } catch (err) {
      console.error('Error handling revoke_message socket event:', err.message);
    }
  });

  socket.on('react_message', async (data) => {
    try {
      const { messageId, userId, emoji } = data;
      if (!messageId || !userId || !MESSAGE_REACTIONS.has(emoji)) return;

      const [message, reactingUser] = await Promise.all([
        Message.findById(messageId),
        User.findById(userId).select('name role'),
      ]);
      if (!message || message.isRevoked || !reactingUser) return;

      const group = await ChatGroup.findById(message.chatGroupId).select('members');
      if (!group) return;
      const isMember = reactingUser.role === 'ADMIN' || group.members.some(
        (member) => member.userId?.toString() === userId.toString()
      );
      if (!isMember) return;

      const existingIndex = message.reactions.findIndex(
        (reaction) => reaction.userId.toString() === userId.toString()
      );

      if (existingIndex >= 0 && message.reactions[existingIndex].emoji === emoji) {
        message.reactions.splice(existingIndex, 1);
      } else if (existingIndex >= 0) {
        message.reactions[existingIndex].emoji = emoji;
        message.reactions[existingIndex].userName = reactingUser.name || '';
      } else {
        message.reactions.push({
          userId,
          emoji,
          userName: reactingUser.name || '',
        });
      }

      await message.save();
      const populated = await Message.findById(message._id)
        .populate('senderId', 'name email avatar')
        .populate('reactions.userId', 'name avatar');

      io.to(message.chatGroupId.toString()).emit('message_reaction_updated', populated);
    } catch (err) {
      console.error('Error handling react_message socket event:', err.message);
    }
  });

  socket.on('disconnect', async () => {
    const userId = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);

    if (userId) {
      // Chỉ set offline nếu user không có socket nào khác đang connect
      const stillOnline = getOnlineUserIds().includes(userId);
      if (!stillOnline) {
        try {
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        } catch (err) {
          console.warn('[Presence] Could not update offline status:', err.message);
        }
      }
      broadcastOnlineUsers();
    }

    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ── Expose io & onlineUsers for REST API ────────────────────────
app.set('io', io);
app.set('onlineUsers', onlineUsers);


const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log('\n🚀 ─────────────────────────────────────');
    console.log(`   FPT Startup Platform API`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   DB: MongoDB`);
    console.log(`   Real-Time: Socket.io Enabled`);
    console.log('─────────────────────────────────────\n');
  });
};

process.on('SIGINT', () => {
  console.log('\n👋 Bye!');
  process.exit(0);
});

start();
