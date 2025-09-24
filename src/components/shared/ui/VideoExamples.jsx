/**
 * Purpose: Display a list of embedded video examples.
 * Inputs: videos (urls[]), titles/labels (optional).
 * Outputs: Responsive iframe list with empty state.
 * Risks: None known.
 * Next TODO: Evaluate stricter URL allowlist needs.
*/
import React from 'react';

const VideoExamples = ({ videoUrls = [] }) => {
  const sanitizedUrls = videoUrls.reduce((acc, url) => {
    if (!url) return acc;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        acc.push(parsed.toString());
      }
    } catch (error) {
      // Skip invalid URL
    }
    return acc;
  }, []);

  if (!sanitizedUrls.length) {
    return (
      <div className="w-full h-40 bg-neutral-700 rounded-xl flex items-center justify-center text-sm text-neutral-400 mt-4">
        No video examples available
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {sanitizedUrls.map((url, index) => (
        <div key={`${url}-${index}`} className="w-full aspect-video">
          <iframe
            className="w-full h-full rounded-xl"
            src={url}
            title={`Video example ${index + 1}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ))}
    </div>
  );
};

export default VideoExamples;
