
// ─── GET /api/classes/:classId/export-excel ──────────────────────────────────
exports.exportClassExcel = async (req, res) => {
  try {
    const classId = req.params.classId;
    const cls = await Class.findById(classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Permission check
    if (req.user.role === 'LECTURER' && cls.lectureId?.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'You do not have permission to export this class', 403);
    }
    if (req.user.role === 'MENTOR') {
      const isMentor = cls.mentorIds && cls.mentorIds.some(m => m.toString() === req.user._id.toString());
      if (!isMentor) return errorResponse(res, 'You do not have permission to export this class', 403);
    }
    if (req.user.role === 'STUDENT') {
      return errorResponse(res, 'Students cannot export class data', 403);
    }

    // Load students
    const students = await Student.find({ classId }).sort({ fullName: 1 });
    // Load teams for this class
    const teams = await Team.find({ classId });
    const teamMap = new Map();
    teams.forEach(t => teamMap.set(t._id.toString(), t));

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(cls.classCode || 'Students', {
      views: [{ state: 'frozen', ySplit: 1 }] // freeze first row
    });

    // Define columns
    sheet.columns = [
      { header: 'RollNumber', key: 'rollNumber', width: 18 },
      { header: 'Fullname', key: 'fullName', width: 30 },
      { header: 'Chuyên ngành', key: 'major', width: 18 },
      { header: 'SubjectCode', key: 'subjectCode', width: 16 },
      { header: 'GroupName', key: 'groupName', width: 20 },
      { header: 'Group EXE201', key: 'groupExe201', width: 20 },
      { header: 'Project Name', key: 'projectName', width: 30 },
      { header: 'Description', key: 'description', width: 50 }
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' } // Yellow
      };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Auto filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length }
    };

    // Add rows
    students.forEach(student => {
      let groupName = '';
      let groupExe201 = '';
      let projectName = '';
      let description = '';

      if (student.teamId) {
        const team = teamMap.get(student.teamId.toString());
        if (team) {
          groupName = team.groupName || '';
          groupExe201 = team.groupExe201 || '';
          projectName = team.projectName || '';
          description = team.description || '';
        }
      }

      const row = sheet.addRow({
        rollNumber: student.rollNumber || '',
        fullName: student.fullName || '',
        major: student.major || '',
        subjectCode: student.subjectCode || cls.subjectCode || '',
        groupName,
        groupExe201,
        projectName,
        description
      });

      // Wrap text in description and add borders
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        if (colNumber === 8) { // Description column
          cell.alignment = { wrapText: true, vertical: 'top' };
        } else {
          cell.alignment = { vertical: 'top' };
        }
      });
    });

    // Prepare response
    const filename = `${cls.classCode || 'class'}_students.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel Error:', err);
    return errorResponse(res, 'Server error during export', 500);
  }
};
