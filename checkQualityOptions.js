import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const headshotsDir = path.join(__dirname, 'public', 'assets', 'headshots');

async function reconvertToHighQualityWebp() {
  try {
    // We need the original PNG files to re-convert at higher quality
    console.log('ERROR: Original PNG files have been deleted!');
    console.log(
      'We cannot re-convert to higher quality without the original PNG files.'
    );
    console.log('');
    console.log('Options:');
    console.log('1. Restore PNG files from backup if available');
    console.log('2. Keep current WebP files (80% quality)');
    console.log('3. Download original headshots again if source is available');
  } catch (error) {
    console.error('Error during reconversion:', error);
  }
}

reconvertToHighQualityWebp();
