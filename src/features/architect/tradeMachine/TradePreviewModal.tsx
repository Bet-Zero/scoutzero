import React, { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useImageDownload } from '@/shared/hooks/useImageDownload';
import TradeExportCapture from './TradeExportCapture';
import type { TradePreviewModalProps } from './tradePreviewExportTypes';

const TradePreviewModal = ({
  open,
  onClose,
  teams = [],
  previewAuthority,
  snapshotValidationDetails,
  yearKey,
}: TradePreviewModalProps) => {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.6);

  useLayoutEffect(() => {
    if (!open) return;

    const updateScale = () => {
      if (!exportRef.current) return;
      const height = exportRef.current.offsetHeight;
      const availableHeight = window.innerHeight - 80;
      const heightScale = availableHeight / height;
      const availableWidth = window.innerWidth - 40;
      const widthScale = Math.min(availableWidth, 1200) / 1200;
      setScale(Math.min(heightScale, widthScale, 1));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const observer = new ResizeObserver(updateScale);
    if (exportRef.current) observer.observe(exportRef.current);

    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
    };
  }, [open]);

  const downloadImage = useImageDownload(exportRef);
  const handleDownload = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    downloadImage('trade.png', { backgroundColor: '#111', pixelRatio: 2 });
  };

  if (!open) return null;

  return (
    <>
      <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
        <TradeExportCapture
          ref={exportRef}
          teams={teams}
          previewAuthority={previewAuthority}
          snapshotValidationDetails={snapshotValidationDetails}
          yearKey={yearKey}
        />
      </div>
      <div
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 overflow-auto"
        onClick={onClose}
      >
        <div
          className="relative mx-auto"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            width: '1200px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl border border-white/20 shadow-2xl overflow-hidden bg-[#111] relative">
            <button
              onClick={onClose}
              className="absolute top-2 left-2 text-white/60 hover:text-white z-20"
              title="Close"
            >
              <X size={36} />
            </button>
            <TradeExportCapture
              teams={teams}
              previewAuthority={previewAuthority}
              snapshotValidationDetails={snapshotValidationDetails}
              yearKey={yearKey}
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
              <button
                onClick={handleDownload}
                className="bg-neutral-200 text-black text-lg font-semibold px-4 py-1.5 rounded shadow-lg hover:bg-neutral-300 transition"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TradePreviewModal;
