// Validates data/*.yaml. Errors exit non-zero (the build fails); warnings are
// printed and shown in the site's health panel.
import { loadFromDir } from './lib/load.ts';
import { buildSiteData } from './lib/derive.ts';
import { errorsOf, warningsOf } from './lib/checks.ts';
import { todayIso } from './lib/today.ts';

const data = buildSiteData(loadFromDir('.'), todayIso());
const errors = errorsOf(data.derived.findings);
const warnings = warningsOf(data.derived.findings);

for (const w of warnings) console.log(`warning [${w.code}] ${w.message}`);
for (const e of errors) console.error(`ERROR   [${e.code}] ${e.message}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length) process.exit(1);
