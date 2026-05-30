// src/routes/workshop.routes.js
const express = require('express');
const {
  getWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  checkInWorkshop,
  getWorkshopAttendance,
  verifyWorkshopAttendance,
  verifyAllWorkshopAttendance,
} = require('../controllers/workshop.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/', getWorkshops);
router.post('/', createWorkshop);
router.put('/:id', updateWorkshop);
router.delete('/:id', deleteWorkshop);

router.post('/:id/check-in', checkInWorkshop);
router.get('/:id/attendance', getWorkshopAttendance);
router.put('/:id/attendance/verify-all', verifyAllWorkshopAttendance);
router.put('/:id/attendance/:studentId/verify', verifyWorkshopAttendance);

module.exports = router;
