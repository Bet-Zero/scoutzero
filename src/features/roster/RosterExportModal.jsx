import React, { useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';

const RosterExportModal = ({ open, onClose, roster, team }) => {
  const exportData = useMemo(() => {
    if (!roster) return null;
    const formatPlayers = (players = []) =>
      players.map((player) =>
        player
          ? {
              id: player.id,
              name: player.displayName || player.name || 'Unknown Player',
            }
          : null
      );

    return {
      teamId: team?.id || '',
      teamName: team?.teamName || '',
      starters: formatPlayers(roster.starters),
      rotation: formatPlayers(roster.rotation),
      bench: formatPlayers(roster.bench),
      exportedAt: new Date().toISOString(),
    };
  }, [roster, team]);

  const exportJson = exportData ? JSON.stringify(exportData, null, 2) : '';

  const handleCopy = async () => {
    if (!exportJson) return;
    if (!navigator?.clipboard?.writeText) {
      toast.error('Clipboard not available');
      return;
    }
    try {
      await navigator.clipboard.writeText(exportJson);
      toast.success('Roster JSON copied');
    } catch (err) {
      toast.error('Failed to copy roster JSON');
      console.error(err);
    }
  };

  const handleDownload = () => {
    if (!exportJson) return;
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nameBase = team?.nickname || 'roster';
    link.href = url;
    link.download = `${nameBase}_roster.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Roster JSON downloaded');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-6 w-full max-w-2xl bg-[#1a1a1a] text-white rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Export Roster</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>

        <p className="text-sm text-white/60 mb-4">
          Copy or download a JSON snapshot of the current roster.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={handleCopy}
            className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
          >
            Copy roster JSON
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
          >
            Download roster JSON
          </button>
        </div>

        <textarea
          readOnly
          value={exportJson}
          placeholder="Roster export will appear here."
          className="w-full min-h-[240px] bg-neutral-900 text-white/80 text-xs p-3 rounded border border-white/10"
        />
      </DialogContent>
    </Dialog>
  );
};

export default RosterExportModal;
