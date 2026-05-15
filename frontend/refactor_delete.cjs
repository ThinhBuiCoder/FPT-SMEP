const fs = require('fs');

function refactorConfirm(filePath, itemType, deleteApiCall, deleteSuccessStateUpdate) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('ConfirmDialog')) return; // Already refactored

  // 1. Add import
  if (!content.includes('ConfirmDialog')) {
    content = content.replace(
      "import Button from '../../components/ui/Button';",
      "import Button from '../../components/ui/Button';\nimport ConfirmDialog from '../../components/ui/ConfirmDialog';"
    );
  }

  // 2. Add state
  const stateRegex = /const \[isModalOpen, setIsModalOpen\] = useState\(false\);/;
  if (stateRegex.test(content)) {
    content = content.replace(
      stateRegex,
      `const [isModalOpen, setIsModalOpen] = useState(false);\n  const [deleteTarget, setDeleteTarget] = useState(null);\n  const [isDeleting, setIsDeleting] = useState(false);`
    );
  }

  // 3. Replace handleDelete and add confirmDelete
  const handleDeleteRegex = /const handleDelete = async \((.*?)\) => {[\s\S]*?};/;
  const match = content.match(handleDeleteRegex);
  if (match) {
    const params = match[1]; // e.g. "id, name" or "id"
    const newHandleDelete = `
  const handleDelete = (${params}) => {
    setDeleteTarget({ ${params} });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      ${deleteApiCall.replace(/ID_PLACEHOLDER/g, 'deleteTarget.id').replace(/deleteTarget\.id/g, params.includes('id') ? 'deleteTarget.id' : 'deleteTarget._id')}
      ${deleteSuccessStateUpdate.replace(/ID_PLACEHOLDER/g, 'deleteTarget.id')}
      toast.success('${itemType} deleted!');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete ${itemType.toLowerCase()}');
    } finally {
      setIsDeleting(false);
    }
  };`;
    content = content.replace(handleDeleteRegex, newHandleDelete);
  }

  // 4. Add ConfirmDialog at the end of JSX before final </div>
  const confirmJSX = `
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={\`Delete ${itemType}\`}
        description={\`Are you sure you want to delete \${deleteTarget?.name || deleteTarget?.title || 'this item'}? This action cannot be undone.\`}
        isSubmitting={isDeleting}
      />
    </div>
  );
};`;
  content = content.replace(/    <\/div>\s*\);\s*};\s*export default/g, confirmJSX + '\nexport default');

  fs.writeFileSync(filePath, content);
  console.log('Refactored:', filePath);
}

refactorConfirm(
  './src/pages/admin/UserManagement.jsx',
  'User',
  'await userApi.delete(ID_PLACEHOLDER);',
  'setUsers(users.filter(u => u._id !== ID_PLACEHOLDER));'
);

refactorConfirm(
  './src/pages/admin/ClassManagement.jsx',
  'Class',
  'await classApi.delete(ID_PLACEHOLDER);',
  'setClasses(classes.filter(c => c._id !== ID_PLACEHOLDER));'
);

refactorConfirm(
  './src/pages/common/MilestoneTracking.jsx',
  'Milestone',
  'await milestoneApi.delete(ID_PLACEHOLDER);',
  'setMilestones(milestones.filter(m => m._id !== ID_PLACEHOLDER));'
);

refactorConfirm(
  './src/pages/common/MentoringSessions.jsx',
  'Session',
  'await mentoringApi.delete(ID_PLACEHOLDER);',
  'setSessions(sessions.filter(s => s._id !== ID_PLACEHOLDER));'
);
