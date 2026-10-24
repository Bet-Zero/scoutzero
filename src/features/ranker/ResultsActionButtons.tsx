/**
 * FILE: src/features/ranker/ResultsActionButtons.tsx
 * PURPOSE: Action row on the Player Ranker results screen: adjust, save as list (owners), grid/list view, image download and copy
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Extracted from RankingResults.tsx; download offers the size-aware image layouts
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingResults.tsx
 */
import React from 'react';
import {
  LayoutGrid,
  ListOrdered,
  Edit3,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { ExportDownloadMenu } from './ExportDownloadMenu';
import type { ExportLayout } from './RankingExport';

type ResultsActionButtonsProps = {
  viewType: string;
  onAdjust: () => void;
  // Owners only; omitted hides the button
  onSaveAsList?: () => void;
  saveAsListStatus: 'saving' | 'saved' | 'error' | null;
  savedListMeta: { listId: string; listName: string } | null;
  onToggleView: () => void;
  recommendedLayout: ExportLayout;
  downloading: boolean;
  onDownload: (layout: ExportLayout) => void;
  onCopy: () => void;
};

export const ResultsActionButtons = ({
  viewType,
  onAdjust,
  onSaveAsList,
  saveAsListStatus,
  savedListMeta,
  onToggleView,
  recommendedLayout,
  downloading,
  onDownload,
  onCopy,
}: ResultsActionButtonsProps) => (
  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
    <button
      onClick={onAdjust}
      className="px-3 py-2 text-sm text-white bg-orange-600/80 hover:bg-orange-700 rounded flex items-center transition-colors"
    >
      <Edit3 size={16} className="mr-1" />
      <span className="hidden sm:inline">Adjust Rankings</span>
      <span className="sm:hidden">Adjust</span>
    </button>
    {onSaveAsList && (
      <button
        onClick={onSaveAsList}
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
            <span className="hidden sm:inline">
              {savedListMeta ? 'Update List' : 'Save as List'}
            </span>
            <span className="sm:hidden">
              {savedListMeta ? 'Update' : 'Save'}
            </span>
          </>
        )}
      </button>
    )}
    <button
      onClick={onToggleView}
      className="px-3 py-2 text-sm text-white bg-white/10 rounded hover:bg-white/20 flex items-center transition-colors"
    >
      {viewType === 'grid' ? (
        <>
          <ListOrdered size={16} className="mr-1" />
          <span className="hidden sm:inline">List View</span>
        </>
      ) : (
        <>
          <LayoutGrid size={16} className="mr-1" />
          <span className="hidden sm:inline">Grid View</span>
        </>
      )}
    </button>
    <ExportDownloadMenu
      recommended={recommendedLayout}
      busy={downloading}
      onPick={onDownload}
    />
    <button
      onClick={onCopy}
      className="px-3 py-2 text-sm text-white bg-white/10 rounded hover:bg-white/20 flex items-center transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="mr-1"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z"
        />
      </svg>
      <span className="hidden sm:inline">Copy</span>
    </button>
  </div>
);
