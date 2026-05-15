// src/routes/startupIdea.routes.js
const express = require('express');
const {
  createStartupIdea, getStartupIdeas, getStartupIdeaById,
  updateStartupIdea, deleteStartupIdea, submitForReview,
} = require('../controllers/startupIdea.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.post('/', createStartupIdea);
router.get('/', getStartupIdeas);
router.get('/:id', getStartupIdeaById);
router.put('/:id', updateStartupIdea);
router.delete('/:id', deleteStartupIdea);
router.post('/:id/submit', submitForReview);

module.exports = router;
