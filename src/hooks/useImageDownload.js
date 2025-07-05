import { toPng } from 'html-to-image';

const useImageDownload = (ref) => {
  const download = async (filename, options = {}) => {
    if (!ref.current) return;
    try {
      const font = new FontFace(
        'AntonLocal',
        "url('/fonts/Anton.woff2') format('woff2')",
        { display: 'swap' }
      );
      await font.load();
      document.fonts.add(font);
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        skipFonts: true,
        pixelRatio: options.pixelRatio || 2,
        backgroundColor: options.backgroundColor || '#111',
      });

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  return download;
};

export default useImageDownload;
