import { loadFromDir } from '../scripts/lib/load.ts';
import { buildSiteData } from '../scripts/lib/derive.ts';
import { constantsFrom } from '../src/model.ts';
import type { RawData } from '../src/types.ts';

export const TODAY = '2026-09-25';
export const loadRawData = (): RawData => loadFromDir('.');
export const loadSite = () => buildSiteData(loadRawData(), TODAY, '2026-09-25T00:00:00Z');
export const constants = () => constantsFrom(loadRawData().model.constants);
/** deep copy so a test can edit data without affecting others */
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

import { buildDocs } from '../scripts/lib/docs.ts';
import { searchDocs } from '../scripts/lib/search-docs.ts';
import { buildEngine, loadEngine } from '../src/search.ts';
import type { SiteData } from '../src/types.ts';
export function buildSearch(data: SiteData = loadSite()) {
  const docs = buildDocs(data.site.search.docs, data.site.doc_superseded, (id) => `#/register?id=${id}`);
  const json = JSON.stringify(buildEngine(searchDocs(data, docs)));
  return { json, engine: loadEngine(json), cfg: { synonyms: data.synonyms, stopWords: data.site.search.stop_words }, docs };
}
