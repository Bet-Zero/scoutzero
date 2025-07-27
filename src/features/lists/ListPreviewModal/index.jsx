// src/features/lists/ListPreviewModal.jsx
import React, { useRef, useLayoutEffect, useState } from 'react';
import useImageDownload from '@/hooks/useImageDownload';
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
  const [scale, setScale] = useState(0.6);

  useLayoutEffect(() => {
    const updateScale = () => {
      if (!previewRef.current) return;

      const height = previewRef.current.offsetHeight; // measure unscaled height
      const availableHeight = window.innerHeight - 80; // leave breathing room
      const heightScale = availableHeight / height;

      const availableWidth = window.innerWidth - 40;
      const widthScale = Math.min(availableWidth, 1200) / 1200;

      const newScale = Math.min(heightScale, widthScale, 1);
      setScale(newScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const observer = new ResizeObserver(updateScale);
    if (previewRef.current) observer.observe(previewRef.current);

    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
    };
  }, []);

  const downloadImage = useImageDownload(previewRef);

  const handleDownload = () => {
    downloadImage(`${title || 'list'}.png`, {
      backgroundColor: '#111',
      pixelRatio: 2,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 overflow-auto"
      onClick={onClose}
    >
      <div
        className="relative mx-auto transform"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          width: '1200px',
        }}
      >
        <div
          ref={previewRef}
          className="rounded-2xl border border-white/20 shadow-2xl overflow-hidden bg-[#111] relative"
        >
          <div
            style={{
              fontFamily: 'AntonLocal, AntonBase64',
              opacity: 0,
              position: 'absolute',
            }}
          >
            preload
          </div>
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
      <div className="absolute bottom-4 right-4 z-30">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="bg-neutral-200 text-black text-[10px] px-[8px] py-[4px] rounded shadow-md hover:bg-neutral-400 transition"
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default ListPreviewModal;
