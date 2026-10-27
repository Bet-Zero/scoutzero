import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useImageDownload } from '@/shared/hooks/useImageDownload';
import { AdjustableRankings } from './AdjustableRankings';
import type { RankerPlayer } from './utils/rankingEngine';
import { getPlayerName } from './utils/playerDisplay';
import { GridCard, ListRow, type RankedColumnItem } from './RankedPlayerCards';
import {
  RankingExport,
  recommendedExportLayout,
  type ExportLayout,
} from './RankingExport';
import { ResultsActionButtons } from './ResultsActionButtons';
import { waitForImages } from './utils/exportImages';

type SaveStatus = 'saving' | 'saved' | 'error' | null;
type SavedListMeta = {
  listId: string;
  listName: string;
};
type RankingResultsProps = {
  ranking?: RankerPlayer[];
  onRankingAdjusted?: (ranking: RankerPlayer[]) => void;
  isOwner?: boolean;
  onSaveAsList?: ((ranking: RankerPlayer[]) => void | Promise<unknown>) | null;
  saveAsListStatus?: SaveStatus;
  savedListMeta?: SavedListMeta | null;
  // Top-N mode: the list size, and the players who didn't make it
  topN?: number | null;
  cutPlayers?: RankerPlayer[];
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const RankingResults = ({
  ranking = [],
  onRankingAdjusted,
  isOwner = false,
  onSaveAsList = null,
  saveAsListStatus = null,
  savedListMeta = null,
  topN = null,
  cutPlayers = [],
}: RankingResultsProps) => {
  const [viewType, setViewType] = useState('list');
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [currentRanking, setCurrentRanking] = useState<RankerPlayer[]>(ranking);
  // Layout of the offscreen export, and whether a download is waiting on it
  const [exportLayout, setExportLayout] = useState<ExportLayout>(() =>
    recommendedExportLayout(ranking.length)
  );
  const [pendingDownload, setPendingDownload] = useState(false);

  const exportViewRef = useRef<HTMLDivElement | null>(null);
  const downloadImage = useImageDownload(exportViewRef);
  // A new function each render; read through a ref so the capture effect runs once
  const downloadImageRef = useRef(downloadImage);
  downloadImageRef.current = downloadImage;

  // Sync if parent ranking changes
  useEffect(() => {
    setCurrentRanking(ranking);
  }, [ranking]);

  // Capture once the chosen layout has rendered and its headshots have loaded
  useEffect(() => {
    if (!pendingDownload) return;
    let cancelled = false;
    const run = async () => {
      if (exportViewRef.current) await waitForImages(exportViewRef.current);
      const date = new Date()
        .toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
        .replace(/,/g, '');
      if (!cancelled) await downloadImageRef.current(`rankings-${date}.png`);
      if (!cancelled) setPendingDownload(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pendingDownload, exportLayout]);

  const handleSaveAdjustments = (adjusted: RankerPlayer[]) => {
    setCurrentRanking(adjusted);
    setIsAdjustMode(false);
    onRankingAdjusted?.(adjusted);
  };

  const handleCopy = () => {
    const text = currentRanking
      .map((p, idx) => `#${idx + 1} ${getPlayerName(p)}`)
      .join('\n');
    // The clipboard can be missing or blocked (e.g. outside https)
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(
        () => toast.success('Ranking copied'),
        () => toast.error("Couldn't copy the ranking")
      );
  };

  const handleExportCSV = () => {
    const rows = currentRanking
      .map((p, idx) => `${idx + 1},"${getPlayerName(p).replace(/"/g, '""')}"`)
      .join('\n');
    const csv = `Rank,Name\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ranking.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadImage = (layout: ExportLayout) => {
    setExportLayout(layout);
    setPendingDownload(true);
  };

  const handleSaveAsList = () => {
    if (!isOwner || !onSaveAsList) return;
    onSaveAsList(currentRanking);
  };

  // ── Adjust mode ──────────────────────────────────────────────────────────────
  if (isAdjustMode) {
    return (
      <AdjustableRankings
        initialRanking={currentRanking}
        onSave={handleSaveAdjustments}
        onCancel={() => setIsAdjustMode(false)}
      />
    );
  }

  // ── Columns helper for list view ─────────────────────────────────────────────
  const createColumns = (cols: number) => {
    const itemsPerCol = Math.ceil(currentRanking.length / cols);
    const columns: RankedColumnItem[][] = Array.from(
      { length: cols },
      () => []
    );
    currentRanking.forEach((player, idx) => {
      const colIndex = Math.floor(idx / itemsPerCol);
      if (colIndex < cols) columns[colIndex].push({ player, rank: idx + 1 });
    });
    return columns;
  };

  // ── Grid view ─────────────────────────────────────────────────────────────────
  const renderGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {currentRanking.map((p, idx) => (
        <GridCard key={p.id} player={p} rank={idx + 1} />
      ))}
    </div>
  );

  // ── List view ─────────────────────────────────────────────────────────────────
  const renderList = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
      {/* Mobile: 1 col */}
      {createColumns(1).map((col, ci) => (
        <div key={ci} className="flex flex-col gap-1.5 sm:hidden">
          {col.map(({ player, rank }) => (
            <ListRow key={player.id} player={player} rank={rank} />
          ))}
        </div>
      ))}
      {/* Tablet: 2 cols */}
      {createColumns(2).map((col, ci) => (
        <div key={ci} className="hidden sm:flex md:hidden flex-col gap-1.5">
          {col.map(({ player, rank }) => (
            <ListRow key={player.id} player={player} rank={rank} />
          ))}
        </div>
      ))}
      {/* Desktop: 3 cols */}
      {createColumns(3).map((col, ci) => (
        <div key={ci} className="hidden md:flex lg:hidden flex-col gap-1.5">
          {col.map(({ player, rank }) => (
            <ListRow key={player.id} player={player} rank={rank} />
          ))}
        </div>
      ))}
      {/* Large: 4 cols */}
      {createColumns(4).map((col, ci) => (
        <div key={ci} className="hidden lg:flex flex-col gap-1.5">
          {col.map(({ player, rank }) => (
            <ListRow key={player.id} player={player} rank={rank} />
          ))}
        </div>
      ))}
    </div>
  );

  // ── Hidden export container (always renders desktop layout for consistent screenshots) ──
  const renderExportContainer = () => (
    <div
      className="fixed top-0 left-0 pointer-events-none -z-50"
      style={{
        transform: 'scale(0.001)',
        transformOrigin: 'top left',
        opacity: 0.01,
      }}
    >
      <RankingExport
        ref={exportViewRef}
        ranking={currentRanking}
        layout={exportLayout}
        title={topN ? `My Top ${topN}` : 'My Rankings'}
      />
    </div>
  );

  return (
    <>
      {renderExportContainer()}

      <div className="mt-6 mx-auto max-w-5xl px-4">
        <div className="flex flex-col items-center mb-4 mt-8 sm:mt-12 gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <h2 className="text-2xl font-bold text-white">
            {topN ? `Your Top ${topN}` : 'Your Rankings'}
          </h2>
          <div className="hidden sm:block">
            <ResultsActionButtons
              viewType={viewType}
              onAdjust={() => setIsAdjustMode(true)}
              onSaveAsList={
                isOwner && onSaveAsList ? handleSaveAsList : undefined
              }
              saveAsListStatus={saveAsListStatus}
              savedListMeta={savedListMeta}
              onToggleView={() =>
                setViewType(viewType === 'grid' ? 'list' : 'grid')
              }
              recommendedLayout={recommendedExportLayout(currentRanking.length)}
              downloading={pendingDownload}
              onDownload={handleDownloadImage}
              onCopy={handleCopy}
            />
          </div>
        </div>

        {viewType === 'grid' ? renderGrid() : renderList()}

        {cutPlayers.length > 0 && (
          <details className="mt-6 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <summary className="cursor-pointer text-sm text-white/60">
              Didn&apos;t make your Top {topN} ({cutPlayers.length})
            </summary>
            <p className="mt-2 text-xs text-white/35">
              Not ranked against each other; closest to making it first.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cutPlayers.map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 rounded bg-white/[0.06] text-white/60 text-xs"
                >
                  {getPlayerName(p)}
                </span>
              ))}
            </div>
          </details>
        )}

        {saveAsListStatus === 'saved' && savedListMeta?.listName && (
          <p className="mt-3 text-sm text-green-300 text-center">
            Saved as List: {savedListMeta.listName}
          </p>
        )}

        <div className="mt-6 sm:hidden">
          <ResultsActionButtons
            viewType={viewType}
            onAdjust={() => setIsAdjustMode(true)}
            onSaveAsList={
              isOwner && onSaveAsList ? handleSaveAsList : undefined
            }
            saveAsListStatus={saveAsListStatus}
            savedListMeta={savedListMeta}
            onToggleView={() =>
              setViewType(viewType === 'grid' ? 'list' : 'grid')
            }
            recommendedLayout={recommendedExportLayout(currentRanking.length)}
            downloading={pendingDownload}
            onDownload={handleDownloadImage}
            onCopy={handleCopy}
          />
        </div>

        <div className="flex justify-center mt-6 mb-6">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-sm text-white bg-white/10 rounded hover:bg-white/20 flex items-center transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="mr-2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z"
              />
            </svg>
            Export to CSV
          </button>
        </div>
      </div>
    </>
  );
};
