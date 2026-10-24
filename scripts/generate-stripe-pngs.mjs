import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(fileURLToPath(import.meta.url), '..', '..');
const branding = path.join(root, 'public', 'branding');
const out = path.join(root, 'public');

await sharp(path.join(branding, 'previsio-icon.svg'))
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(out, 'stripe-icon.png'));

await sharp(path.join(branding, 'previsio-logo.svg'))
  .resize(1200, 320, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(out, 'stripe-logo.png'));

const [iconMeta, logoMeta] = await Promise.all([
  sharp(path.join(out, 'stripe-icon.png')).metadata(),
  sharp(path.join(out, 'stripe-logo.png')).metadata(),
]);

console.log(
  `Wrote public/stripe-icon.png (${iconMeta.width}×${iconMeta.height}) and public/stripe-logo.png (${logoMeta.width}×${logoMeta.height}).`,
);
