import { createElement, RefObject } from 'react';
import { toBlob } from 'html-to-image';
import { toast } from 'react-hot-toast';
import { antonBase64CSS } from '@/fonts/antonBase64';

type DownloadOptions = {
  pixelRatio?: number;
  backgroundColor?: string;
};

type DownloadFn = (
  filename: string,
  options?: DownloadOptions
) => Promise<void>;

// Phones save pictures through the share sheet ("Save Image" puts it in Photos);
// a link download there is dropped once the tap is a few seconds old
const shouldShare = (file: File) =>
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] }) &&
  window.matchMedia?.('(pointer: coarse)').matches;

const shareFile = (file: File) => navigator.share({ files: [file] });

const isCancel = (err: unknown) =>
  err instanceof DOMException && err.name === 'AbortError';

// The share sheet needs a fresh tap when building the image took too long
const offerSaveButton = (file: File) => {
  toast(
    (t) =>
      createElement(
        'span',
        { className: 'flex items-center gap-3' },
        'Your image is ready',
        createElement(
          'button',
          {
            type: 'button',
            className: 'rounded bg-white/10 px-3 py-1 font-semibold',
            onClick: () => {
              toast.dismiss(t.id);
              shareFile(file).catch((err) => {
                if (!isCancel(err)) toast.error("Couldn't save the image");
              });
            },
          },
          'Save image'
        )
      ),
    { duration: 30000 }
  );
};

const linkDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking right away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const useImageDownload = (
  ref: RefObject<HTMLElement | null>
): DownloadFn => {
  const download: DownloadFn = async (filename, options = {}) => {
    if (!ref.current) return;
    let styleEl: HTMLStyleElement | undefined;
    try {
      const match = antonBase64CSS.match(/base64,([^)]+)\)/);
      if (match) {
        const font = new FontFace(
          'AntonBase64',
          `url(data:font/woff2;base64,${match[1]}) format('woff2')`,
          { weight: '400', style: 'normal' }
        );
        await font.load();
        // FontFaceSet.add() exists at runtime; TS DOM lib may not include it in all versions
        (document.fonts as FontFaceSet & { add(f: FontFace): void }).add(font);
        await document.fonts.load('1em AntonBase64');
        await document.fonts.ready;

        styleEl = document.createElement('style');
        styleEl.textContent = antonBase64CSS;
        ref.current.prepend(styleEl);
      }

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      await new Promise<void>((r) => setTimeout(r, 100));

      const blob = await toBlob(ref.current, {
        cacheBust: true,
        // Fonts already loaded via Base64; skip html-to-image font inlining to avoid parsing bugs
        skipFonts: true,
        pixelRatio: options.pixelRatio ?? 2,
        backgroundColor: options.backgroundColor ?? '#111',
      });

      if (!blob) throw new Error('Image capture returned nothing');

      const file = new File([blob], filename, { type: 'image/png' });
      if (shouldShare(file)) {
        try {
          await shareFile(file);
        } catch (err) {
          if (isCancel(err)) return;
          offerSaveButton(file);
        }
        return;
      }

      linkDownload(blob, filename);
      toast.success('Image downloaded');
    } catch (err) {
      console.error('Failed to download image', err);
      toast.error('Failed to download image');
    } finally {
      styleEl?.remove();
    }
  };

  return download;
};
