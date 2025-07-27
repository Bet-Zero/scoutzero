import { toPng } from 'html-to-image';
import { antonBase64CSS } from '@/fonts/antonBase64';

const useImageDownload = (ref) => {
  const download = async (filename, options = {}) => {
    if (!ref.current) return;
    try {
      // 1. Ensure the Base64 font is loaded and injected before export
      const match = antonBase64CSS.match(/base64,([^)]+)\)/);
      let styleEl;
      if (match) {
        const font = new FontFace(
          'AntonBase64',
          `url(data:font/woff2;base64,${match[1]}) format('woff2')`,
          { weight: '400', style: 'normal' }
        );
        await font.load();
        document.fonts.add(font);
        await document.fonts.load('1em AntonBase64');
        await document.fonts.ready;

        // Inject @font-face so html-to-image clone retains the font
        styleEl = document.createElement('style');
        styleEl.textContent = antonBase64CSS;
        ref.current.prepend(styleEl);
      }

      // 2. Wait a frame so layout has time to settle
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 100));

      // 3. Export as PNG using the element directly
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        // Avoid html-to-image font parsing bugs by skipping font
        // inlining. Fonts are already loaded via Base64.
        skipFonts: true,
        pixelRatio: options.pixelRatio || 2,
        backgroundColor: options.backgroundColor || '#111',
      });

      // 4. Download
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();

      if (styleEl) styleEl.remove();
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  return download;
};

export default useImageDownload;
