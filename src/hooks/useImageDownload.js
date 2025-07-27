import { toPng } from 'html-to-image';
import { antonBase64CSS } from '@/fonts/antonBase64';

const useImageDownload = (ref) => {
  const download = async (filename, options = {}) => {
    if (!ref.current) return;
    try {
      // 1. Clone DOM node
      const clone = ref.current.cloneNode(true);

      // 2. Inject @font-face into <style>
      const style = document.createElement('style');
      style.innerHTML = antonBase64CSS;
      clone.prepend(style);

      // 3. Force fontFamily on root clone
      clone.style.fontFamily = 'AntonBase64, sans-serif';

      // 4. Ensure the Base64 font is loaded before export
      const match = antonBase64CSS.match(/base64,([^)]+)\)/);
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
      }

      // 5. Export as PNG using clone
      const dataUrl = await toPng(clone, {
        cacheBust: true,
        skipFonts: false,
        pixelRatio: options.pixelRatio || 2,
        backgroundColor: options.backgroundColor || '#111',
      });

      // 6. Download
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
