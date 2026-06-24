// backend/src/routes/workspace.routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/workspace.controller");
const { protect } = require("../middlewares/auth.middleware");

// Protect all workspace routes
router.use(protect);

// Workspace Summary APIs
router.get("/accessible-teams", ctrl.getAccessibleTeams);
router.get("/my-team", ctrl.getMyWorkspace);
router.get("/teams/:teamId", ctrl.getTeamWorkspace);
router.put("/teams/:teamId/project-direction", ctrl.updateProjectDirection);
router.put("/teams/:teamId/project-direction/review", ctrl.reviewProjectDirection);
router.get("/classes/:classId/project-directions", ctrl.getClassProjectDirections);

// Proposal APIs
router.post("/teams/:teamId/proposal", ctrl.createProposal);
router.get("/teams/:teamId/proposal", ctrl.getProposal);
router.put("/proposals/:proposalId", ctrl.updateProposal);
router.put("/proposals/:proposalId/submit", ctrl.submitProposal);

// Proposal Version history APIs
router.get("/proposals/:proposalId/versions", ctrl.getProposalVersions);
router.get("/proposals/:proposalId/versions/:versionId", ctrl.getProposalVersionDetail);
router.post("/proposals/:proposalId/restore/:versionId", ctrl.restoreProposalVersion);

// Pitch Deck upload APIs
router.post("/teams/:teamId/decks/upload", ctrl.uploadPitchDeck);
router.get("/teams/:teamId/decks", ctrl.getPitchDecks);
router.get("/decks/:deckId/download", ctrl.downloadPitchDeck);
router.delete("/decks/:deckId", ctrl.deletePitchDeck);

module.exports = router;
