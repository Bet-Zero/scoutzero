// src/features/lists/ListPreviewModal.jsx
import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import ListExportWrapper from './ListExportWrapper';

const ListPreviewModal = ({
  open,
  onClose,
  players = [],
  tiers = [],
  playersMap = {},
  isRanked = false,
  exportType = 'list',
  compact = false,
  twoColumn = true,
  title = '',
  subtitle = '',
}) => {
  if (!open) return null;

  const previewRef = useRef(null);

  const handleDownload = async () => {
    if (!previewRef.current) return;
    try {
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        backgroundColor: '#111',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `${title || 'list'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download list', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-auto">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      <div
        className="relative mx-auto transform"
        style={{
          transform: 'scale(0.6)',
          transformOrigin: 'center',
          width: '1200px',
        }}
      >
        <div ref={previewRef} className="rounded-2xl border border-white/20 shadow-2xl overflow-hidden bg-[#111]">
          <ListExportWrapper
            players={players}
            tiers={tiers}
            playersMap={playersMap}
            isExport
            isRanked={isRanked}
            exportType={exportType}
            compact={compact}
            twoColumn={twoColumn}
            title={title}
            subtitle={subtitle}
          />
        </div>
      </div>
      <div className="absolute bottom-7 left-1/2 transform -translate-x-1/2 z-30">
        <button
          onClick={handleDownload}
          className="bg-neutral-200 text-black text-[10px] px-[8px] py-[4px] rounded shadow-md hover:bg-neutral-400 transition"
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default ListPreviewModal;
