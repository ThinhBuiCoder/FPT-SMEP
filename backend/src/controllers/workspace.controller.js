// backend/src/controllers/workspace.controller.js
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const Team = require("../models/Team");
const Class = require("../models/Class");
const Student = require("../models/Student");
const Proposal = require("../models/Proposal");
const ProposalVersion = require("../models/ProposalVersion");
const PitchDeck = require("../models/PitchDeck");
const CheckpointSubmission = require("../models/CheckpointSubmission");
const workspacePerm = require("../utils/workspacePermission");
const workspaceAccess = require("../services/workspaceAccess.service");
const { createBulkNotifications } = require("../services/notification.service");

// Use memory storage for Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExtensions = [".pdf", ".ppt", ".pptx"];
  const ext = path.extname(file.originalname).toLowerCase();
  
  const allowedMimeTypes = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ];

  if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Only PDF, PPT, and PPTX files are allowed."), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: fileFilter
}).single("file");

const { uploadToCloudinary } = require('../services/cloudinary.service');

// Helpers for responses
const successResponse = (res, data, message = "") => {
  return res.status(200).json({ success: true, data, message });
};

const errorResponse = (res, message, status = 500) => {
  return res.status(status).json({ success: false, error: message });
};

const teamListPopulate = [
  { path: "classId", select: "classCode subjectCode semester year" },
  { path: "mentorId", select: "name email avatar" },
  { path: "lectureId", select: "name email avatar" },
];

// ─── GET /api/workspace/accessible-teams ─────────────────────────────────────
// Teams the current user may open in Startup Workspace (Admin / Lecturer / Mentor)
exports.getAccessibleTeams = async (req, res) => {
  try {
    const role = (req.user?.role || "").toUpperCase();
    let teams = [];

    if (role === "ADMIN") {
      teams = await Team.find().populate(teamListPopulate).sort({ teamName: 1 });
    } else if (role === "LECTURER" || role === "LECTURE") {
      const classes = await Class.find({ lectureId: req.user._id }).select("_id");
      const classIds = classes.map((c) => c._id);
      teams = await Team.find({
        $or: [{ classId: { $in: classIds } }, { lectureId: req.user._id }],
      })
        .populate(teamListPopulate)
        .sort({ teamName: 1 });
    } else if (role === "MENTOR") {
      const classes = await Class.find({ mentorIds: req.user._id }).select("_id");
      const classIds = classes.map((c) => c._id);
      teams = await Team.find({
        $or: [{ classId: { $in: classIds } }, { mentorId: req.user._id }],
      })
        .populate(teamListPopulate)
        .sort({ teamName: 1 });
    } else if (role === "STUDENT" || role === "USER") {
      const { team } = await workspacePerm.getCurrentStudentWorkspaceContext(req.user);
      if (team?._id) {
        teams = await Team.find({ _id: team._id }).populate(teamListPopulate);
      }
    } else {
      return errorResponse(res, "Access Denied.", 403);
    }

    const teamIds = teams.map((t) => t._id);
    const [proposals, submissions, memberCounts] = await Promise.all([
      Proposal.find({ teamId: { $in: teamIds } }).select("teamId status startupName"),
      CheckpointSubmission.find({ teamId: { $in: teamIds } }).select("teamId files"),
      Student.aggregate([
        { $match: { teamId: { $in: teamIds } } },
        { $group: { _id: "$teamId", count: { $sum: 1 } } },
      ]),
    ]);

    const proposalByTeam = new Map(proposals.map((p) => [p.teamId.toString(), p]));
    const memberByTeam = new Map(memberCounts.map((m) => [m._id.toString(), m.count]));
    const checkpointFilesByTeam = new Map();
    submissions.forEach((sub) => {
      const key = sub.teamId.toString();
      const n = sub.files?.length || 0;
      checkpointFilesByTeam.set(key, (checkpointFilesByTeam.get(key) || 0) + n);
    });

    const list = teams.map((team) => {
      const id = team._id.toString();
      const proposal = proposalByTeam.get(id);
      return {
        _id: team._id,
        teamName: team.teamName,
        teamCode: team.teamCode,
        description: team.description,
        lineageId: team.lineageId,
        previousTeamId: team.previousTeamId,
        nextTeamId: team.nextTeamId,
        isArchived: team.isArchived,
        courseCode: team.courseCode || team.classId?.subjectCode || null,
        semester: team.semester || (team.classId ? `${team.classId.semester || ""}${team.classId.year || ""}` : null),
        class: team.classId,
        mentor: team.mentorId,
        lecturer: team.lectureId,
        memberCount: memberByTeam.get(id) || 0,
        proposalStatus: proposal?.status || null,
        startupName: proposal?.startupName || null,
        checkpointFileCount: checkpointFilesByTeam.get(id) || 0,
      };
    });

    return successResponse(res, { teams: list, role });
  } catch (err) {
    console.error("getAccessibleTeams:", err);
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── GET /api/workspace/my-team ──────────────────────────────────────────────
exports.getMyWorkspace = async (req, res) => {
  try {
    const { student, team, reason } = await workspacePerm.getCurrentStudentWorkspaceContext(req.user);
    if (!student) {
      return successResponse(res, null, "You have not joined any class yet.");
    }

    if (!team) {
      const message = reason === "NO_TEAM_IN_CURRENT_CLASS"
        ? "You have joined this class but have not been assigned to a team yet."
        : "Your saved team no longer matches your current class. Please contact your lecturer or administrator.";
      return successResponse(res, null, message);
    }
    
    // Redirect to getTeamWorkspaceDetails helper
    const workspaceData = await exports.getTeamWorkspaceDetails(team._id);
    return successResponse(res, workspaceData);
  } catch (err) {
    console.error("getMyWorkspace error:", err);
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── GET /api/workspace/teams/:teamId ─────────────────────────────────────────
exports.getTeamWorkspace = async (req, res) => {
  try {
    const { teamId } = req.params;
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);
    
    const workspaceData = await exports.getTeamWorkspaceDetails(teamId);
    return successResponse(res, workspaceData);
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    console.error("getTeamWorkspace error:", err);
    return errorResponse(res, "Server error: " + err.message);
  }
};

// Helper to gather workspace info
exports.getTeamWorkspaceDetails = async (teamId) => {
  const team = await Team.findById(teamId)
    .populate("mentorId", "name email avatar role")
    .populate("lectureId", "name email avatar role")
    .populate("projectDirectionUpdatedBy", "name email role")
    .populate("projectDirectionReviewedBy", "name email role");
    
  if (!team) {
    throw new Error("Team not found");
  }

  const cls = await Class.findById(team.classId)
    .populate("lectureId", "name email avatar role")
    .populate("mentorIds", "name email avatar role");

  const students = await Student.find({ teamId }).populate("userId", "name email avatar role");
  const roleByStudentId = new Map(
    (team.members || []).map((member) => [String(member.studentId), member.roleInTeam || "Member"])
  );
  const workspaceMembers = students.map((student) => ({
    ...student.toObject(),
    roleInTeam: String(team.leaderId || "") === String(student._id)
      ? "Leader"
      : (roleByStudentId.get(String(student._id)) || "Member"),
  }));

  const proposal = await Proposal.findOne({ teamId });
  const lineageTeamIds = team.lineageId
    ? (await Team.find({ lineageId: team.lineageId }).select("_id")).map((item) => item._id)
    : [team._id];
  const pitchDecks = await PitchDeck.find({ teamId: { $in: lineageTeamIds }, status: "ACTIVE" })
    .populate("teamId", "teamName teamCode courseCode semester isArchived")
    .sort({ createdAt: -1 });
  const latestDeck = pitchDecks.find((deck) => String(deck.teamId?._id || deck.teamId) === String(team._id))
    || pitchDecks[0]
    || null;

  let versions = [];
  const lineageProposals = await Proposal.find({ teamId: { $in: lineageTeamIds } }).select("_id teamId");
  const proposalIds = lineageProposals.map((item) => item._id);
  if (proposalIds.length > 0) {
    versions = await ProposalVersion.find({ proposalId: { $in: proposalIds } })
      .populate("changedBy", "name email")
      .populate("teamId", "teamName teamCode courseCode semester isArchived")
      .sort({ createdAt: -1 });
  }

  return {
    team,
    class: cls,
    members: workspaceMembers,
    lecturer: cls?.lectureId || team?.lectureId || null,
    mentor: team?.mentorId || (cls?.mentorIds && cls.mentorIds[0]) || null,
    proposal,
    pitchDecks,
    latestDeck,
    versions
  };
};

// Only the current team leader may write the team's project direction.
exports.updateProjectDirection = async (req, res) => {
  try {
    const { teamId } = req.params;
    const direction = typeof req.body?.projectDirection === "string"
      ? req.body.projectDirection.trim()
      : "";
    const wordCount = direction ? direction.split(/\s+/u).length : 0;

    if (wordCount < 30 || wordCount > 500) {
      return errorResponse(res, "Project direction must contain 30-500 words.", 400);
    }

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, teamId);

    const team = await Team.findById(teamId);
    if (!team) return errorResponse(res, "Team not found", 404);

    const student = await workspacePerm.getStudentForTeam(req.user, team);
    const isLeader = student && String(team.leaderId || "") === String(student._id);
    if (!isLeader) {
      return errorResponse(res, "Only the team leader can update project direction.", 403);
    }

    team.projectDirection = direction;
    team.projectDirectionUpdatedBy = req.user._id;
    team.projectDirectionUpdatedAt = new Date();
    team.projectDirectionStatus = "PENDING";
    await team.save();

    await team.populate("projectDirectionUpdatedBy", "name email role");
    return successResponse(res, {
      projectDirection: team.projectDirection,
      projectDirectionUpdatedBy: team.projectDirectionUpdatedBy,
      projectDirectionUpdatedAt: team.projectDirectionUpdatedAt,
      projectDirectionStatus: team.projectDirectionStatus,
      wordCount,
    }, "Project direction saved.");
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    console.error("updateProjectDirection error:", err);
    return errorResponse(res, "Server error: " + err.message);
  }
};

exports.getClassProjectDirections = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId).select("classCode subjectCode semester year lectureId");
    if (!cls) return errorResponse(res, "Class not found", 404);

    const role = String(req.user?.role || "").toUpperCase();
    const isAssignedLecturer = ["LECTURER", "LECTURE"].includes(role)
      && String(cls.lectureId || "") === String(req.user._id);
    if (!isAssignedLecturer && role !== "ADMIN") {
      return errorResponse(res, "You do not have permission to review this class.", 403);
    }

    const teams = await Team.find({ classId: cls._id, status: { $ne: "REJECTED" } })
      .populate("leaderId", "fullName email rollNumber")
      .populate("projectDirectionUpdatedBy", "name email")
      .populate("projectDirectionReviewedBy", "name email")
      .sort({ projectName: 1, teamName: 1 });

    return successResponse(res, { class: cls, teams });
  } catch (err) {
    console.error("getClassProjectDirections error:", err);
    return errorResponse(res, "Server error: " + err.message);
  }
};

exports.reviewProjectDirection = async (req, res) => {
  try {
    const { decision, comment } = req.body || {};
    const normalizedDecision = String(decision || "").toUpperCase();
    const cleanComment = typeof comment === "string" ? comment.trim() : "";

    if (!["APPROVED", "CHANGES_REQUESTED"].includes(normalizedDecision)) {
      return errorResponse(res, "Decision must be APPROVED or CHANGES_REQUESTED.", 400);
    }
    if (cleanComment.length < 3 || cleanComment.length > 1000) {
      return errorResponse(res, "Review comment must contain 3-1000 characters.", 400);
    }

    const team = await Team.findById(req.params.teamId);
    if (!team) return errorResponse(res, "Team not found", 404);
    if (!team.projectDirection) return errorResponse(res, "This team has not submitted a project direction.", 400);

    const cls = await Class.findById(team.classId).select("classCode lectureId");
    const role = String(req.user?.role || "").toUpperCase();
    const isAssignedLecturer = ["LECTURER", "LECTURE"].includes(role)
      && String(cls?.lectureId || "") === String(req.user._id);
    if (!isAssignedLecturer) {
      return errorResponse(res, "Only the assigned lecturer can review this project direction.", 403);
    }

    team.projectDirectionStatus = normalizedDecision;
    team.projectDirectionReviewComment = cleanComment;
    team.projectDirectionReviewedBy = req.user._id;
    team.projectDirectionReviewedAt = new Date();
    await team.save();

    const students = await Student.find({ teamId: team._id }).select("userId email");
    const recipients = students
      .filter((student) => student.email)
      .map((student) => ({ id: student.userId || null, email: student.email }));
    const decisionText = normalizedDecision === "APPROVED" ? "approved" : "requested changes for";

    await createBulkNotifications(recipients, {
      type: "TEAM",
      title: "Project direction reviewed",
      message: `${req.user.name || "Your lecturer"} ${decisionText} your team's project direction. Comment: ${cleanComment}`,
      link: `/workspace/teams/${team._id}`,
      data: {
        action: "PROJECT_DIRECTION_REVIEWED",
        teamId: team._id,
        classId: team.classId,
        status: normalizedDecision,
      },
      createdBy: req.user._id,
    });

    await team.populate("projectDirectionReviewedBy", "name email role");
    return successResponse(res, { team }, "Project direction reviewed.");
  } catch (err) {
    console.error("reviewProjectDirection error:", err);
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── POST /api/workspace/teams/:teamId/proposal ────────────────────────────────
exports.createProposal = async (req, res) => {
  try {
    const { teamId } = req.params;
    await workspacePerm.assertCanEditTeamWorkspace(req.user, teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, teamId);

    const existingProposal = await Proposal.findOne({ teamId });
    if (existingProposal) {
      return errorResponse(res, "Proposal already exists for this team.", 409);
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return errorResponse(res, "Team not found", 404);
    }

    const newProposal = new Proposal({
      teamId,
      classId: team.classId,
      title: req.body.title || "",
      startupName: req.body.startupName || "",
      tagline: req.body.tagline || "",
      problem: req.body.problem || "",
      solution: req.body.solution || "",
      targetCustomers: req.body.targetCustomers || "",
      valueProposition: req.body.valueProposition || "",
      marketSize: req.body.marketSize || "",
      competitors: req.body.competitors || "",
      businessModel: req.body.businessModel || "",
      revenueModel: req.body.revenueModel || "",
      marketingStrategy: req.body.marketingStrategy || "",
      technology: req.body.technology || "",
      financialPlan: req.body.financialPlan || "",
      roadmap: req.body.roadmap || "",
      teamIntroduction: req.body.teamIntroduction || "",
      status: "DRAFT",
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const savedProposal = await newProposal.save();

    // Create version 1
    const newVersion = new ProposalVersion({
      proposalId: savedProposal._id,
      teamId,
      classId: team.classId,
      versionNumber: 1,
      snapshot: savedProposal.toObject(),
      changeNote: req.body.changeNote || "Initial proposal",
      changedBy: req.user._id
    });
    await newVersion.save();

    return successResponse(res, savedProposal, "Proposal created successfully");
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── GET /api/workspace/teams/:teamId/proposal ─────────────────────────────────
exports.getProposal = async (req, res) => {
  try {
    const { teamId } = req.params;
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const proposal = await Proposal.findOne({ teamId });
    if (!proposal) {
      return errorResponse(res, "Proposal not found for this team.", 404);
    }

    return successResponse(res, proposal);
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── PUT /api/workspace/proposals/:proposalId ─────────────────────────────────
exports.updateProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return errorResponse(res, "Proposal not found.", 404);
    }

    await workspacePerm.assertCanEditTeamWorkspace(req.user, proposal.teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, proposal.teamId);

    // Reset status to DRAFT if it was in any other stage
    if (proposal.status !== "DRAFT") {
      proposal.status = "DRAFT";
    }

    // Assign fields
    const fields = [
      "title", "startupName", "tagline", "problem", "solution", 
      "targetCustomers", "valueProposition", "marketSize", "competitors", 
      "businessModel", "revenueModel", "marketingStrategy", "technology", 
      "financialPlan", "roadmap", "teamIntroduction"
    ];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        proposal[field] = req.body[field];
      }
    });

    proposal.updatedBy = req.user._id;
    const updatedProposal = await proposal.save();

    // Create next version
    const lastVersion = await ProposalVersion.findOne({ proposalId })
      .sort({ versionNumber: -1 });
    const nextVer = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const newVersion = new ProposalVersion({
      proposalId,
      teamId: proposal.teamId,
      classId: proposal.classId,
      versionNumber: nextVer,
      snapshot: updatedProposal.toObject(),
      changeNote: req.body.changeNote || `Updated draft version ${nextVer}`,
      changedBy: req.user._id
    });
    await newVersion.save();

    return successResponse(res, updatedProposal, "Proposal updated successfully");
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── PUT /api/workspace/proposals/:proposalId/submit ──────────────────────────
exports.submitProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return errorResponse(res, "Proposal not found.", 404);
    }

    await workspacePerm.assertCanEditTeamWorkspace(req.user, proposal.teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, proposal.teamId);

    proposal.status = "SUBMITTED";
    proposal.submittedAt = new Date();
    proposal.updatedBy = req.user._id;
    
    const updatedProposal = await proposal.save();

    // Save version history for submission
    const lastVersion = await ProposalVersion.findOne({ proposalId })
      .sort({ versionNumber: -1 });
    const nextVer = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const newVersion = new ProposalVersion({
      proposalId,
      teamId: proposal.teamId,
      classId: proposal.classId,
      versionNumber: nextVer,
      snapshot: updatedProposal.toObject(),
      changeNote: req.body.changeNote || "Submitted proposal",
      changedBy: req.user._id
    });
    await newVersion.save();

    return successResponse(res, updatedProposal, "Proposal submitted successfully");
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── GET /api/workspace/proposals/:proposalId/versions ─────────────────────────
exports.getProposalVersions = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return errorResponse(res, "Proposal not found.", 404);
    }

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, proposal.teamId);

    const versions = await ProposalVersion.find({ proposalId })
      .populate("changedBy", "name email")
      .sort({ versionNumber: -1 });

    return successResponse(res, versions);
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── GET /api/workspace/proposals/:proposalId/versions/:versionId ──────────────
exports.getProposalVersionDetail = async (req, res) => {
  try {
    const { proposalId, versionId } = req.params;
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return errorResponse(res, "Proposal not found.", 404);
    }

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, proposal.teamId);

    const ver = await ProposalVersion.findById(versionId)
      .populate("changedBy", "name email");
      
    if (!ver) {
      return errorResponse(res, "Proposal version not found.", 404);
    }

    return successResponse(res, ver);
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── POST /api/workspace/proposals/:proposalId/restore/:versionId ───────────────
exports.restoreProposalVersion = async (req, res) => {
  try {
    const { proposalId, versionId } = req.params;
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return errorResponse(res, "Proposal not found.", 404);
    }

    await workspacePerm.assertCanEditTeamWorkspace(req.user, proposal.teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, proposal.teamId);

    const ver = await ProposalVersion.findById(versionId);
    if (!ver) {
      return errorResponse(res, "Proposal version not found.", 404);
    }

    // Restore proposal content from snapshot
    const snap = ver.snapshot;
    const fields = [
      "title", "startupName", "tagline", "problem", "solution", 
      "targetCustomers", "valueProposition", "marketSize", "competitors", 
      "businessModel", "revenueModel", "marketingStrategy", "technology", 
      "financialPlan", "roadmap", "teamIntroduction"
    ];
    fields.forEach(field => {
      if (snap[field] !== undefined) {
        proposal[field] = snap[field];
      }
    });

    proposal.status = "DRAFT";
    proposal.updatedBy = req.user._id;

    const restoredProposal = await proposal.save();

    // Create a new version for this restore action
    const lastVersion = await ProposalVersion.findOne({ proposalId })
      .sort({ versionNumber: -1 });
    const nextVer = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const newVersion = new ProposalVersion({
      proposalId,
      teamId: proposal.teamId,
      classId: proposal.classId,
      versionNumber: nextVer,
      snapshot: restoredProposal.toObject(),
      changeNote: `Restored from version ${ver.versionNumber}`,
      changedBy: req.user._id
    });
    await newVersion.save();

    return successResponse(res, restoredProposal, `Restored successfully to version ${ver.versionNumber}`);
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── POST /api/workspace/teams/:teamId/decks/upload ──────────────────────────
exports.uploadPitchDeck = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return errorResponse(res, err.message, 400);
    }

    if (!req.file) {
      return errorResponse(res, "No file uploaded.", 400);
    }

    try {
      const { teamId } = req.params;
      await workspacePerm.assertCanEditTeamWorkspace(req.user, teamId);
      await workspaceAccess.assertCanMutateWorkspace(req.user, teamId);

      const team = await Team.findById(teamId);
      if (!team) {
        return errorResponse(res, "Team not found.", 404);
      }

      // Upload to Cloudinary
      const result = await uploadToCloudinary(req.file.buffer, 'fpt_smep/pitch_decks');

      const proposal = await Proposal.findOne({ teamId });

      // Find max current versionNumber of PitchDeck for this team
      const lastDeck = await PitchDeck.findOne({ teamId, status: "ACTIVE" }).sort({ versionNumber: -1 });
      const nextVer = lastDeck ? lastDeck.versionNumber + 1 : 1;

      // Deactivate all older pitch decks
      await PitchDeck.updateMany({ teamId }, { status: "ARCHIVED" });

      const newDeck = new PitchDeck({
        teamId,
        classId: team.classId,
        proposalId: proposal ? proposal._id : null,
        fileName: req.file.originalname,
        originalName: req.file.originalname,
        fileUrl: result.secure_url,
        publicId: result.public_id,
        fileType: path.extname(req.file.originalname).substring(1).toLowerCase(),
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        versionNumber: nextVer,
        uploadedBy: req.user._id,
        status: "ACTIVE"
      });

      const savedDeck = await newDeck.save();
      return successResponse(res, savedDeck, "Pitch deck uploaded successfully");
    } catch (dbErr) {
      if (dbErr.statusCode === 403) {
        return errorResponse(res, dbErr.message, 403);
      }
      return errorResponse(res, "Upload/Database error: " + dbErr.message);
    }
  });
};

// ─── GET /api/workspace/teams/:teamId/decks ──────────────────────────────────
exports.getPitchDecks = async (req, res) => {
  try {
    const { teamId } = req.params;
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const decks = await PitchDeck.find({ teamId })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    return successResponse(res, decks);
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── GET /api/workspace/decks/:deckId/download ───────────────────────────────
exports.downloadPitchDeck = async (req, res) => {
  try {
    const { deckId } = req.params;
    const deck = await PitchDeck.findById(deckId);
    if (!deck) {
      return errorResponse(res, "Pitch deck not found.", 404);
    }

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, deck.teamId);

    if (!deck.fileUrl) {
      return errorResponse(res, "File not found.", 404);
    }

    // Since it's on Cloudinary, we should ideally redirect to the URL or provide it
    return res.redirect(deck.fileUrl);
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};

// ─── DELETE /api/workspace/decks/:deckId ─────────────────────────────────────
exports.deletePitchDeck = async (req, res) => {
  try {
    const { deckId } = req.params;
    const deck = await PitchDeck.findById(deckId);
    if (!deck) {
      return errorResponse(res, "Pitch deck not found.", 404);
    }

    await workspacePerm.assertCanEditTeamWorkspace(req.user, deck.teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, deck.teamId);

    deck.status = "ARCHIVED";
    await deck.save();

    return successResponse(res, null, "Pitch deck archived successfully");
  } catch (err) {
    if (err.statusCode === 403) {
      return errorResponse(res, err.message, 403);
    }
    return errorResponse(res, "Server error: " + err.message);
  }
};
