import { toPng } from 'html-to-image';
import { antonBase64CSS } from '@/fonts/antonBase64';

const waitForImages = async (root) => {
  if (!root) return;

  const images = Array.from(root.querySelectorAll('img'));

  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth !== 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const handleDone = () => {
          img.removeEventListener('load', handleDone);
          img.removeEventListener('error', handleDone);
          resolve();
        };

        img.addEventListener('load', handleDone, { once: true });
        img.addEventListener('error', handleDone, { once: true });
      });
    })
  );
};

const useImageDownload = (ref) => {
  const download = async (filename, options = {}) => {
    if (!ref.current) return;
    let styleEl;
    let originalStyles = null;
    try {
      // 1. Ensure the Base64 font is loaded and injected before export
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

        // Inject @font-face so html-to-image clone retains the font
        styleEl = document.createElement('style');
        styleEl.textContent = antonBase64CSS;
        ref.current.prepend(styleEl);
      }

      // 2. Temporarily make the container fully visible for mobile browsers
      const element = ref.current;
      originalStyles = {
        top: element.style.top,
        visibility: element.style.visibility,
        zIndex: element.style.zIndex,
        pointerEvents: element.style.pointerEvents,
      };

      element.style.top = '0';
      element.style.visibility = 'visible';
      element.style.zIndex = '-1';
      element.style.pointerEvents = 'none';

      // 3. Ensure all images are fully loaded before rendering
      await waitForImages(ref.current);

      // 4. Wait for layout to settle
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 300));

      // 5. Export as PNG
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        skipFonts: true,
        pixelRatio: options.pixelRatio || 2,
        backgroundColor: options.backgroundColor || '#111',
        filter: () => true,
        async beforeDrawImage(node) {
          if (node.tagName === 'IMG' && node.src.endsWith('.svg')) {
            try {
              const response = await fetch(node.src);
              const svgText = await response.text();
              const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
              node.src = svgDataUrl;
            } catch (err) {
              console.warn('Failed to embed SVG:', err);
            }
          }
          return node;
        },
      });

      // 6. Download
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
    } finally {
      if (originalStyles && ref.current) {
        ref.current.style.top = originalStyles.top;
        ref.current.style.visibility = originalStyles.visibility;
        ref.current.style.zIndex = originalStyles.zIndex;
        ref.current.style.pointerEvents = originalStyles.pointerEvents;
      }
      if (styleEl) {
        styleEl.remove();
      }
    }
  };

  return download;
};

export default useImageDownload;
