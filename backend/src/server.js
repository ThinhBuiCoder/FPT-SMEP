// src/server.js — Real-Time Socket.io Group Chat Enabled
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const app = require('./app');
const Message = require('./models/Message');

const PORT = process.env.PORT || 5000;

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

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

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
      const { chatGroupId, senderId, senderName, senderRole, text, attachment } = data;

      if (!chatGroupId || !senderId || (!text && !attachment)) {
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

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

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
