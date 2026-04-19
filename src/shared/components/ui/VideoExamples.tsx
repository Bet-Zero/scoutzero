/**
 * FILE: src/shared/components/ui/VideoExamples.tsx
 * PURPOSE: Manage and display video example links with optional YouTube embeds.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-22: Added link management UI and YouTube validation (Phase 3)
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-3-videos/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { VideoExample } from '@/schemas/players_v2';
import {
  buildVideoExample,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  isYouTubeUrl,
  normalizeVideoExampleList,
} from '@/shared/utils/videoExamples';

export type VideoExamplesProps = {
  contextKey: string | number | null | undefined;
  videos?: unknown;
  onChange?: (videos: VideoExample[]) => void;
  maxVideos?: number;
};

const VideoExamples = ({
  contextKey,
  videos = [],
  onChange,
  maxVideos = 5,
}: VideoExamplesProps) => {
  const normalizedVideos = useMemo(
    () => normalizeVideoExampleList(videos),
    [videos]
  );
  const [urlInput, setUrlInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setUrlInput('');
    setLabelInput('');
    setExpanded({});
  }, [contextKey]);

  const handleAdd = () => {
    const next = buildVideoExample(urlInput, labelInput);
    if (!next) return;
    onChange?.([...normalizedVideos, next]);
    setUrlInput('');
    setLabelInput('');
  };

  const handleDelete = (index: number) => {
    onChange?.(normalizedVideos.filter((_, i) => i !== index));
  };

  const handleLabelChange = (index: number, value: string) => {
    const next = normalizedVideos.map((item, i) =>
      i === index ? { ...item, label: value } : item
    );
    onChange?.(next);
  };

  const toggleExpanded = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const urlWarning =
    urlInput.trim().length > 0 && !isYouTubeUrl(urlInput)
      ? 'Non-YouTube link: it will save, but may not embed.'
      : null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-neutral-400 mb-2">
        <span>Video Examples</span>
        <span>
          {normalizedVideos.length}/{maxVideos}{' '}
          {normalizedVideos.length >= maxVideos ? '(soft limit)' : null}
        </span>
      </div>

      <div className="bg-neutral-900 rounded-xl border border-neutral-700 p-3 space-y-3">
        <div className="space-y-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="YouTube URL"
            className="w-full bg-neutral-950 text-white text-sm px-3 py-2 rounded-lg border border-neutral-700 outline-none"
          />
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Label (optional)"
            className="w-full bg-neutral-950 text-white text-sm px-3 py-2 rounded-lg border border-neutral-700 outline-none"
          />
          {urlWarning && (
            <div className="text-xs text-amber-400">{urlWarning}</div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!urlInput.trim()}
              className="px-3 py-1.5 rounded-md bg-white text-neutral-900 text-xs font-semibold disabled:opacity-40"
            >
              Add Video
            </button>
          </div>
        </div>

        {normalizedVideos.length === 0 && (
          <div className="text-sm text-neutral-400 text-center py-6">
            No video examples added yet.
          </div>
        )}

        {normalizedVideos.length > 0 && (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {normalizedVideos.map((video, index) => {
              const label = video.label?.trim() || `Example ${index + 1}`;
              const youtubeEmbed = getYouTubeEmbedUrl(video.url);
              const thumbnail = getYouTubeThumbnailUrl(video.url);
              const canEmbed = Boolean(youtubeEmbed);
              const isExpanded = Boolean(expanded[index]);

              return (
                <div
                  key={`${video.url}-${index}`}
                  className="rounded-lg border border-neutral-700 p-2 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-white">
                      {label}
                    </div>
                    <div className="flex items-center gap-2">
                      {canEmbed && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(index)}
                          className="text-xs text-neutral-300 hover:text-white"
                        >
                          {isExpanded ? 'Hide' : 'Play'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(index)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {!isYouTubeUrl(video.url) && (
                    <div className="text-xs text-amber-400">
                      Non-YouTube link saved. Embed unavailable.
                    </div>
                  )}

                  <input
                    type="text"
                    value={video.label || ''}
                    onChange={(e) => handleLabelChange(index, e.target.value)}
                    placeholder="Edit label"
                    className="w-full bg-neutral-950 text-white text-xs px-2 py-1 rounded-md border border-neutral-700 outline-none"
                  />

                  {canEmbed && !isExpanded && thumbnail && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(index)}
                      className="w-full aspect-video rounded-lg overflow-hidden border border-neutral-800"
                    >
                      <img
                        src={thumbnail}
                        alt={label}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  )}

                  {canEmbed && isExpanded && (
                    <div className="w-full aspect-video">
                      <iframe
                        className="w-full h-full rounded-lg"
                        src={youtubeEmbed}
                        title={`${label} video`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  )}

                  {!canEmbed && (
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-300 underline break-all"
                    >
                      Open link
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoExamples;
