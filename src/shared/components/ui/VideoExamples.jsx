/**
 * Purpose: Display a list of embedded video examples.
 * Inputs: videos (urls[]), titles/labels (optional).
 * Outputs: Responsive iframe list with empty state.
 * Risks: Missing sandbox/allow; duplicate titles; no URL validation; no lazy loading.
 * Next TODO: Add allow/sandbox & loading="lazy"; unique titles; sanitize/whitelist URLs.
 */
import React from 'react';

const VideoExamples = ({ videoUrls = [] }) => {
  if (!videoUrls.length) {
    return (
      <div className="w-full h-40 bg-neutral-700 rounded-xl flex items-center justify-center text-sm text-neutral-400 mt-4">
        No video examples available
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {videoUrls.map((url) => (
        <div key={url} className="w-full aspect-video">
          <iframe
            className="w-full h-full rounded-xl"
            src={url}
            title="Video example"
            allowFullScreen
          />
        </div>
      ))}
    </div>
  );
};

export default VideoExamples;
