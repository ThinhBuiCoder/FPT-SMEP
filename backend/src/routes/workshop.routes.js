// src/routes/workshop.routes.js
const express = require('express');
const {
  getWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
} = require('../controllers/workshop.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/', getWorkshops);
router.post('/', createWorkshop);
router.put('/:id', updateWorkshop);
router.delete('/:id', deleteWorkshop);

module.exports = router;
