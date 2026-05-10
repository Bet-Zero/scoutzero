import { RefObject } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'react-hot-toast';
import { antonBase64CSS } from '@/fonts/antonBase64';

type DownloadOptions = {
  pixelRatio?: number;
  backgroundColor?: string;
};

type DownloadFn = (filename: string, options?: DownloadOptions) => Promise<void>;

export const useImageDownload = (ref: RefObject<HTMLElement | null>): DownloadFn => {
  const download: DownloadFn = async (filename, options = {}) => {
    if (!ref.current) return;
    try {
      const match = antonBase64CSS.match(/base64,([^)]+)\)/);
      let styleEl: HTMLStyleElement | undefined;
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

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((r) => setTimeout(r, 100));

      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        // Fonts already loaded via Base64; skip html-to-image font inlining to avoid parsing bugs
        skipFonts: true,
        pixelRatio: options.pixelRatio ?? 2,
        backgroundColor: options.backgroundColor ?? '#111',
      });

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();

      if (styleEl) styleEl.remove();
      toast.success('Image downloaded');
    } catch (err) {
      console.error('Failed to download image', err);
      toast.error('Failed to download image');
    }
  };

  return download;
};

