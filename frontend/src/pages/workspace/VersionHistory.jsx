// frontend/src/pages/workspace/VersionHistory.jsx
import { useState } from 'react';
import { History, Eye, RotateCcw, Calendar, User, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceApi } from '../../api/workspaceApi';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

export default function VersionHistory({ proposalId, versions, isEditable, onRefresh }) {
  const [selectedVer, setSelectedVer] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async (versionId, versionNumber) => {
    if (!window.confirm(`Are you sure you want to restore the proposal to Version ${versionNumber}? This will create a new draft.`)) return;
    setRestoring(true);
    try {
      await workspaceApi.restoreProposalVersion(proposalId, versionId);
      toast.success(`Proposal successfully restored to Version ${versionNumber}!`);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const showDetail = (ver) => {
    setSelectedVer(ver);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-slate-800">Version History</h3>
        </div>
        <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded">
          {versions ? versions.length : 0} saves
        </span>
      </div>

      {versions && versions.length > 0 ? (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {versions.map((ver) => (
            <div 
              key={ver._id} 
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/40 border border-slate-100 hover:bg-slate-50 transition-all"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">v{ver.versionNumber}</span>
                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
                    <Calendar className="w-3 h-3" /> {new Date(ver.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-700 mt-1 truncate" title={ver.changeNote}>
                  {ver.changeNote || 'No change note'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                  <User className="w-2.5 h-2.5" /> {ver.changedBy?.name || 'Unknown'}
                </p>
              </div>

              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => showDetail(ver)}
                  className="p-1.5 border border-slate-200/50 bg-white text-slate-500 rounded-lg hover:text-primary transition-all"
                  title="View Snapshot"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {isEditable && (
                  <button
                    disabled={restoring}
                    onClick={() => handleRestore(ver._id, ver.versionNumber)}
                    className="p-1.5 border border-slate-200/50 bg-white text-slate-500 rounded-lg hover:text-primary transition-all disabled:opacity-50"
                    title="Restore Version"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-slate-400 text-sm italic">
          No version history yet.
        </div>
      )}

      {/* Snapshot Modal Detail */}
      <Modal
        isOpen={selectedVer !== null}
        onClose={() => setSelectedVer(null)}
        title={selectedVer ? `Proposal Snapshot v${selectedVer.versionNumber}` : ''}
        size="lg"
      >
        {selectedVer && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs text-slate-400">Created by <span className="font-semibold text-slate-700">{selectedVer.changedBy?.name}</span> ({selectedVer.changedBy?.email})</p>
                <p className="text-xs text-slate-400 mt-0.5">Date: {new Date(selectedVer.createdAt).toLocaleString()}</p>
              </div>
              <span className="text-xs bg-primary-50 border border-primary-100 text-primary px-2.5 py-0.5 rounded font-bold">
                Note: {selectedVer.changeNote || 'No change note'}
              </span>
            </div>

            <div className="space-y-4 text-slate-700 text-sm max-h-[50vh] overflow-y-auto pr-1">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Startup Name</h4>
                <p className="font-bold text-slate-900 mt-0.5 text-base">{selectedVer.snapshot.startupName || '—'}</p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tagline</h4>
                <p className="italic text-slate-600 mt-0.5">{selectedVer.snapshot.tagline || '—'}</p>
              </div>
              <hr className="border-slate-100" />
              {[
                { label: 'Problem', val: selectedVer.snapshot.problem },
                { label: 'Solution', val: selectedVer.snapshot.solution },
                { label: 'Target Customers', val: selectedVer.snapshot.targetCustomers },
                { label: 'Value Proposition', val: selectedVer.snapshot.valueProposition },
                { label: 'Market Size', val: selectedVer.snapshot.marketSize },
                { label: 'Competitors', val: selectedVer.snapshot.competitors },
                { label: 'Business Model', val: selectedVer.snapshot.businessModel },
                { label: 'Revenue Model', val: selectedVer.snapshot.revenueModel },
                { label: 'Marketing Strategy', val: selectedVer.snapshot.marketingStrategy },
                { label: 'Technology Stack', val: selectedVer.snapshot.technology },
                { label: 'Financial Plan', val: selectedVer.snapshot.financialPlan },
                { label: 'Roadmap', val: selectedVer.snapshot.roadmap },
                { label: 'Team Introduction', val: selectedVer.snapshot.teamIntroduction },
              ].map(({ label, val }) => (
                <div key={label} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100/60">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</h4>
                  <p className="text-slate-700 mt-1 whitespace-pre-line leading-relaxed">{val || '—'}</p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedVer(null)}>
                Close
              </Button>
              {isEditable && (
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => {
                    const verNum = selectedVer.versionNumber;
                    const verId = selectedVer._id;
                    setSelectedVer(null);
                    handleRestore(verId, verNum);
                  }}
                >
                  Restore this version
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
