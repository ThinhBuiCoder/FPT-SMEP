// src/routes/team.routes.js
const express = require('express');
const { createTeam, getTeams, getTeamById, updateTeam, addMember, removeMember } = require('../controllers/team.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.post('/',                       createTeam);
router.get('/',                        getTeams);
router.get('/:id',                     getTeamById);
router.put('/:id',                     updateTeam);
router.post('/:id/members',            addMember);
router.delete('/:id/members/:userId',  removeMember);

module.exports = router;
