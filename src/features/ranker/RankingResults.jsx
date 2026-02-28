import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  ListOrdered,
  Download,
  Edit3,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import useImageDownload from '@/hooks/useImageDownload';
import AdjustableRankings from './AdjustableRankings';

const getPlayerName = (player) =>
  player.bio?.displayName || player.display_name || player.name || '—';

const getHeadshotSrc = (player) =>
  player.headshot ||
  player.headshotUrl ||
  `/assets/headshots/${player.player_id || player.id}.png`;

const getLogoSrc = (player) => {
  const team = player.team;
  if (!team) return null;
  return `/assets/logos/${team.toLowerCase()}.png`;
};

// ─── Grid Card ────────────────────────────────────────────────────────────────

const GridCard = ({ player, rank }) => {
  const headshot = getHeadshotSrc(player);
  const logoSrc = getLogoSrc(player);

  return (
    <div className="bg-gradient-to-b from-[#2a2a2a] to-[#1f1f1f] rounded-lg overflow-hidden border border-white/25 shadow-xl">
      {/* Headshot with rank overlay */}
      <div className="aspect-square w-full overflow-hidden bg-[#0a0a0a] relative border-b border-white/15">
        <img
          src={headshot}
          alt={getPlayerName(player)}
          className="w-full h-full object-cover"
          loading="eager"
          decoding="async"
          onError={(e) => {
            e.target.src = '/assets/headshots/default.png';
          }}
        />
        <div className="absolute top-2 left-2 bg-neutral-900/80 backdrop-blur-sm text-white font-bold text-lg px-1.5 py-0.5 rounded shadow-xl border border-white/20">
          {rank}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-gradient-to-b from-[#1f1f1f] to-[#1a1a1a] border-t border-white/20">
        <div className="text-white font-medium truncate text-sm mb-1">
          {getPlayerName(player)}
        </div>
        <div className="flex items-center gap-1.5">
          {logoSrc && (
            <img
              src={logoSrc}
              alt=""
              className="w-4 h-4 object-contain flex-shrink-0"
              loading="eager"
              decoding="async"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <span className="text-white/60 text-xs truncate">
            {player.team?.toUpperCase() || '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── List Row ─────────────────────────────────────────────────────────────────

const ListRow = ({ player, rank }) => {
  const headshot = getHeadshotSrc(player);
  const logoSrc = getLogoSrc(player);

  return (
    <div className="bg-white/5 rounded p-2 flex items-center gap-2">
      <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full font-bold text-white/80 text-sm flex-shrink-0">
        {rank}
      </div>
      <img
        src={headshot}
        alt=""
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        loading="eager"
        decoding="async"
        onError={(e) => {
          e.target.src = '/assets/headshots/default.png';
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate text-sm">
          {getPlayerName(player)}
        </div>
        <div className="flex items-center gap-1 text-white/60 text-xs">
          {logoSrc && (
            <img
              src={logoSrc}
              alt=""
              className="w-3.5 h-3.5 object-contain flex-shrink-0"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <span>{player.team?.toUpperCase() || '—'}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RankingResults = ({
  ranking = [],
  onRankingAdjusted,
  isOwner = false,
  onSaveAsList = null,
  saveAsListStatus = null,
  savedListMeta = null,
}) => {
  const [viewType, setViewType] = useState('list');
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [currentRanking, setCurrentRanking] = useState(ranking);
  const [isDownloading, setIsDownloading] = useState(false);

  const exportViewRef = useRef(null);
  const downloadImage = useImageDownload(exportViewRef);

  // Sync if parent ranking changes
  useEffect(() => {
    setCurrentRanking(ranking);
  }, [ranking]);

  const handleSaveAdjustments = (adjusted) => {
    setCurrentRanking(adjusted);
    setIsAdjustMode(false);
    onRankingAdjusted?.(adjusted);
  };

  const handleCopy = () => {
    const text = currentRanking
      .map((p, idx) => `#${idx + 1} ${getPlayerName(p)}`)
      .join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
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

  const handleDownloadImage = async () => {
    setIsDownloading(true);
    const date = new Date()
      .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      .replace(/,/g, '');
    try {
      await downloadImage(`rankings-${date}.png`);
    } finally {
      setIsDownloading(false);
    }
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
  const createColumns = (cols) => {
    const itemsPerCol = Math.ceil(currentRanking.length / cols);
    const columns = Array(cols).fill(null).map(() => []);
    currentRanking.forEach((player, idx) => {
      const colIndex = Math.floor(idx / itemsPerCol);
      if (colIndex < cols) columns[colIndex].push({ player, rank: idx + 1 });
    });
    return columns;
  };

  // ── Action buttons ────────────────────────────────────────────────────────────
  const ActionButtons = () => (
    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
      <button
        onClick={() => setIsAdjustMode(true)}
        className="px-3 py-2 text-sm text-white bg-orange-600/80 hover:bg-orange-700 rounded flex items-center transition-colors"
      >
        <Edit3 size={16} className="mr-1" />
        <span className="hidden sm:inline">Adjust Rankings</span>
        <span className="sm:hidden">Adjust</span>
      </button>
      {isOwner && onSaveAsList && (
        <button
          onClick={handleSaveAsList}
          disabled={saveAsListStatus === 'saving'}
          className={`
            px-3 py-2 text-sm rounded flex items-center transition-colors disabled:opacity-50
            ${
              saveAsListStatus === 'saved'
                ? 'text-green-300 bg-green-500/20 border border-green-500/30'
                : saveAsListStatus === 'error'
                  ? 'text-red-300 bg-red-500/20 border border-red-500/30'
                  : 'text-white bg-blue-600/80 hover:bg-blue-700'
            }
          `}
        >
          {saveAsListStatus === 'saving' ? (
            <>
              <div className="w-3.5 h-3.5 mr-1 border-2 border-blue-100/30 border-t-blue-100 rounded-full animate-spin" />
              <span className="hidden sm:inline">Saving...</span>
            </>
          ) : saveAsListStatus === 'saved' ? (
            <>
              <CheckCircle size={16} className="mr-1" />
              <span className="hidden sm:inline">Saved as List</span>
            </>
          ) : saveAsListStatus === 'error' ? (
            <>
              <AlertCircle size={16} className="mr-1" />
              <span className="hidden sm:inline">Save Failed</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Save as List</span>
              <span className="sm:hidden">Save</span>
            </>
          )}
        </button>
      )}
      <button
        onClick={() => setViewType(viewType === 'grid' ? 'list' : 'grid')}
        className="px-3 py-2 text-sm text-white bg-white/10 rounded hover:bg-white/20 flex items-center transition-colors"
      >
        {viewType === 'grid' ? (
          <><ListOrdered size={16} className="mr-1" /><span className="hidden sm:inline">List View</span></>
        ) : (
          <><LayoutGrid size={16} className="mr-1" /><span className="hidden sm:inline">Grid View</span></>
        )}
      </button>
      <button
        onClick={handleDownloadImage}
        disabled={isDownloading}
        className="px-3 py-2 text-sm text-white bg-white/10 rounded hover:bg-white/20 flex items-center transition-colors disabled:opacity-50"
      >
        <Download size={16} className="mr-1" />
        <span className="hidden sm:inline">{isDownloading ? 'Downloading…' : 'Download'}</span>
      </button>
      <button
        onClick={handleCopy}
        className="px-3 py-2 text-sm text-white bg-white/10 rounded hover:bg-white/20 flex items-center transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z" />
        </svg>
        <span className="hidden sm:inline">Copy</span>
      </button>
    </div>
  );

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
      style={{ transform: 'scale(0.001)', transformOrigin: 'top left', opacity: 0.01 }}
    >
      <div ref={exportViewRef} className="bg-neutral-950 p-12 w-[1200px]">
        <div className="mb-6">
          <h1 className="text-5xl font-black uppercase tracking-wide text-white">
            My Rankings
          </h1>
          <div className="mt-3 h-0.5 w-1/4 bg-white/20" />
          <div className="mt-3 text-base text-white/60">
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
        <div className="grid grid-cols-6 gap-4 mt-6">
          {currentRanking.slice(0, 42).map((p, idx) => (
            <GridCard key={p.id} player={p} rank={idx + 1} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderExportContainer()}

      <div className="mt-6 mx-auto max-w-5xl px-4">
        <div className="flex flex-col items-center mb-4 mt-8 sm:mt-12 gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <h2 className="text-2xl font-bold text-white">Your Rankings</h2>
          <div className="hidden sm:block">
            <ActionButtons />
          </div>
        </div>

        {viewType === 'grid' ? renderGrid() : renderList()}

        {saveAsListStatus === 'saved' && savedListMeta?.listName && (
          <p className="mt-3 text-sm text-green-300 text-center">
            Saved as List: {savedListMeta.listName}
          </p>
        )}

        <div className="mt-6 sm:hidden">
          <ActionButtons />
        </div>

        <div className="flex justify-center mt-6 mb-6">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-sm text-white bg-white/10 rounded hover:bg-white/20 flex items-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z" />
            </svg>
            Export to CSV
          </button>
        </div>
      </div>
    </>
  );
};

export default RankingResults;
