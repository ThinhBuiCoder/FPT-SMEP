const express = require('express');
const ctrl = require('../controllers/dataBank.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN', 'LECTURER'));

router.get('/columns', ctrl.getColumns);
router.get('/classes', ctrl.getClasses);
router.post('/classes/:classId/sync', ctrl.syncClass);
router.post('/workbook/inspect', ctrl.uploadExcel, ctrl.inspectWorkbook);
router.post('/imports/preview', ctrl.uploadExcel, ctrl.previewImport);
router.post('/imports/:batchId/commit', ctrl.uploadExcel, ctrl.commitImport);
router.get('/datasets', ctrl.getDatasets);
router.post('/exports/preview', ctrl.exportPreview);
router.post('/exports/download', ctrl.downloadExport);
router.post('/grid/columns', ctrl.addGridColumn);
router.delete('/grid/columns', ctrl.deleteGridColumn);
router.post('/grid/rows', ctrl.addGridRow);
router.delete('/grid/rows', ctrl.deleteGridRow);
router.patch('/grid/cells', ctrl.editGridCell);
router.delete('/grid/cells', ctrl.clearGridCell);
router.get('/imports/history', ctrl.getHistory);
router.post('/imports/:batchId/rollback', ctrl.rollbackBatch);
router.get('/field-history', ctrl.getFieldHistory);
router.get('/templates', ctrl.getTemplates);
router.post('/templates', ctrl.saveTemplate);
router.put('/templates/:id', ctrl.saveTemplate);
router.delete('/templates/:id', ctrl.deleteTemplate);

module.exports = router;
