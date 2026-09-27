// Post-build: scan everything in dist/ (the site as deployed). Fails on any
// team surname, staff name, GitHub username or email address.
import { loadPrivacy, scanDir } from './lib/privacy.ts';

const hits = scanDir('dist', loadPrivacy('.'));
for (const h of hits) console.error(`ERROR   [privacy] ${h.kind} in ${h.where}: ${h.sample}`);
if (hits.length) process.exit(1);
console.log('privacy: dist/ has no blocked names or email addresses');
