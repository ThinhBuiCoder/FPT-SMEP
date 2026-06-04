// src/controllers/tracking.controller.js
const AuthEvent = require('../models/AuthEvent');
const User      = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Tạo chuỗi ngày YYYY-MM-DD dạng local ISO (UTC+7 hoặc server timezone)
 * để nhóm thống kê theo ngày.
 */
const toDateString = (date) => date.toISOString().slice(0, 10);

/**
 * Lấy danh sách N ngày gần nhất (bao gồm hôm nay) dạng YYYY-MM-DD
 */
const getLastNDays = (n) => {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateString(d));
  }
  return days;
};

/**
 * GET /api/tracking/auth-stats
 * Chỉ Admin được gọi. Trả về thống kê toàn hệ thống.
 */
const getAuthStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7; // mặc định 7 ngày, có thể truyền ?days=30

    // ── Mốc thời gian ──────────────────────────────────────────
    const now       = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 00:00:00 local
    const periodStart = new Date(todayStart);
    periodStart.setDate(todayStart.getDate() - (days - 1));

    // ── Tổng số user ───────────────────────────────────────────
    const totalUsers = await User.countDocuments();

    // ── Tổng sự kiện theo loại ─────────────────────────────────
    const [totalRegisters, totalLogins, failedLogins] = await Promise.all([
      AuthEvent.countDocuments({ eventType: 'REGISTER' }),
      AuthEvent.countDocuments({ eventType: 'LOGIN' }),
      AuthEvent.countDocuments({ eventType: 'LOGIN_FAILED' }),
    ]);

    // ── Hôm nay ────────────────────────────────────────────────
    const [todayRegisters, todayLogins] = await Promise.all([
      AuthEvent.countDocuments({ eventType: 'REGISTER', createdAt: { $gte: todayStart } }),
      AuthEvent.countDocuments({ eventType: 'LOGIN',    createdAt: { $gte: todayStart } }),
    ]);

    // ── Active users hôm nay (login thành công, distinct userId) ─
    const activeUsersResult = await AuthEvent.distinct('userId', {
      eventType: 'LOGIN',
      success: true,
      userId: { $ne: null },
      createdAt: { $gte: todayStart },
    });
    const activeUsersToday = activeUsersResult.length;

    // ── loginRate & registerRate theo ngày (aggregate) ─────────
    const [loginAgg, registerAgg] = await Promise.all([
      AuthEvent.aggregate([
        { $match: { eventType: 'LOGIN', createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AuthEvent.aggregate([
        { $match: { eventType: 'REGISTER', createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Chuyển aggregate result thành Map để lookup nhanh
    const loginMap    = Object.fromEntries(loginAgg.map(r    => [r._id, r.count]));
    const registerMap = Object.fromEntries(registerAgg.map(r => [r._id, r.count]));

    // Điền đủ N ngày (kể cả ngày có 0 event)
    const allDays = getLastNDays(days);
    const loginRate = allDays.map(d => ({ date: d, count: loginMap[d] || 0 }));
    const registerRate = allDays.map(d => ({ date: d, count: registerMap[d] || 0 }));

    // ── Thống kê user theo role ────────────────────────────────
    const roleAgg = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const roleStats = roleAgg.map(r => ({ role: r._id, count: r.count }));

    return successResponse(res, {
      totalUsers,
      totalRegisters,
      totalLogins,
      failedLogins,
      todayRegisters,
      todayLogins,
      activeUsersToday,
      loginRate,
      registerRate,
      roleStats,
      periodDays: days,
    });
  } catch (err) {
    console.error('TrackingStats error:', err);
    return errorResponse(res, 'Lỗi khi lấy thống kê tracking.', 500);
  }
};

/**
 * GET /api/tracking/online-users
 * Trả về danh sách user online, offline gần đây, tổng online.
 * Chỉ Admin được gọi.
 */
const getOnlineUsers = async (req, res) => {
  try {
    // Lấy danh sách userId đang online từ socket presence map
    const onlineUsersMap = req.app.get('onlineUsers');
    const onlineUserIds = onlineUsersMap
      ? [...new Set(onlineUsersMap.values())]
      : [];

    // Lấy thông tin chi tiết user đang online
    const onlineUserDocs = onlineUserIds.length > 0
      ? await User.find({ _id: { $in: onlineUserIds } })
          .select('name email role avatar lastSeen isOnline')
          .lean()
      : [];

    // Lấy user "recently active" (lastSeen trong 24h qua, nhưng không online)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentlyActiveUsers = await User.find({
      _id: { $nin: onlineUserIds },
      lastSeen: { $gte: twentyFourHoursAgo },
    })
      .select('name email role avatar lastSeen isOnline')
      .sort({ lastSeen: -1 })
      .limit(50)
      .lean();

    // Tổng số user toàn hệ thống
    const totalUsers = await User.countDocuments();

    // Format output
    const onlineList = onlineUserDocs.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      lastSeen: u.lastSeen,
      status: 'online',
    }));

    const recentList = recentlyActiveUsers.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      lastSeen: u.lastSeen,
      status: 'offline',
    }));

    return successResponse(res, {
      onlineCount: onlineList.length,
      totalUsers,
      onlineUsers: onlineList,
      recentlyActive: recentList,
    });
  } catch (err) {
    console.error('OnlineUsers error:', err);
    return errorResponse(res, 'Lỗi khi lấy danh sách online users.', 500);
  }
};

module.exports = { getAuthStats, getOnlineUsers };
