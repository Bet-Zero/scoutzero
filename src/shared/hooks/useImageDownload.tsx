import { RefObject } from 'react';
import { Download } from 'lucide-react';
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

// Every iOS browser runs on WebKit; desktop Chrome/Edge also say AppleWebKit
const isWebKit = () =>
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome\/|Chromium|Android/.test(navigator.userAgent);

const capturePasses = () => (isWebKit() ? 3 : 1);

// Phones save pictures through the share sheet ("Save Image" puts it in Photos);
// a link download there is dropped once the tap is a few seconds old
const shouldShare = (file: File) =>
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] }) &&
  window.matchMedia?.('(pointer: coarse)').matches;

const shareFile = (file: File) => navigator.share({ files: [file] });

const isCancel = (err: unknown) =>
  err instanceof DOMException && err.name === 'AbortError';

// One toast per export: "Preparing image…" turns into the result in place
const TOAST_ID = 'image-export';

// Shown from the tap, so the wait before the capture starts is covered too
export const showPreparingImage = () =>
  toast.loading('Preparing image…', { id: TOAST_ID });

// The share sheet needs a fresh tap when building the image took too long
const offerSaveButton = (file: File) => {
  toast(
    (t) => (
      <div className="flex items-center gap-4">
        <span className="text-sm">Your image is ready</span>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id);
            shareFile(file).catch((err) => {
              if (!isCancel(err)) toast.error("Couldn't save the image");
            });
          }}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow active:scale-95"
        >
          <Download size={16} aria-hidden="true" />
          Save image
        </button>
      </div>
    ),
    {
      id: TOAST_ID,
      duration: 30000,
      icon: null,
      style: {
        background: '#1f1f1f',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.15)',
      },
    }
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
    showPreparingImage();
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

      const capture = (el: HTMLElement) =>
        toBlob(el, {
          cacheBust: true,
          // Fonts already loaded via Base64; skip html-to-image font inlining to avoid parsing bugs
          skipFonts: true,
          pixelRatio: options.pixelRatio ?? 2,
          backgroundColor: options.backgroundColor ?? '#111',
        });
      // Safari draws the picture before its images have decoded, leaving them
      // blank; repeat captures fill them in, so keep the last one
      let blob = await capture(ref.current);
      for (let pass = 1; pass < capturePasses(); pass++) {
        blob = await capture(ref.current);
      }

      if (!blob) throw new Error('Image capture returned nothing');

      const file = new File([blob], filename, { type: 'image/png' });
      if (shouldShare(file)) {
        toast.dismiss(TOAST_ID);
        try {
          await shareFile(file);
        } catch (err) {
          if (isCancel(err)) return;
          offerSaveButton(file);
        }
        return;
      }

      linkDownload(blob, filename);
      toast.success('Image downloaded', { id: TOAST_ID });
    } catch (err) {
      console.error('Failed to download image', err);
      toast.error('Failed to download image', { id: TOAST_ID });
    } finally {
      styleEl?.remove();
    }
  };

  return download;
};
