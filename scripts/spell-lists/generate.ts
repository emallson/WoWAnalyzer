import {
  dbc,
  retailSpecList,
  retailSpellList,
  PRESETS,
  loadAll,
  RetailSpell,
} from '@archon/wow-dbc';
import { SpellType } from '@archon/wow-dbc/src/hydraters/internal/types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const RETAIL_VERSION = '11.0.7.59302';

const retailDbc = dbc(RETAIL_VERSION);

function formatSpell(spell: RetailSpell): RetailSpell {
  const spell_ = spell as Record<string, any>;
  // this is bulky and not needed. omit
  delete spell_.effects;
  return spell_ as RetailSpell;
}

const specList = await retailSpecList(retailDbc);

export interface SpellList {
  specId: number;
  baselineSpells: number[];
  spells: RetailSpell[];
}

const done: Set<number> = new Set();
for (const specId of specList) {
  if (done.has(specId)) {
    // due to double indexing, there may be repeated specs.
    continue;
  }
  const spellList = await retailSpellList(retailDbc, specId);
  const data: RetailSpell[] = await loadAll(PRESETS.RETAIL, retailDbc, spellList);

  const output = {
    specId,
    baselineSpells: data
      .filter((spell) => spell.type === SpellType.Baseline)
      .map((spell) => spell.id),
    spells: data.map(formatSpell),
  } satisfies SpellList;

  let file: fs.FileHandle | undefined = undefined;
  try {
    const directory = path.join(import.meta.dirname, '..', '..', 'src', 'generated', 'retail');
    await fs.mkdir(directory, { recursive: true });
    file = await fs.open(path.join(directory, `spell-list-${specId}.json`), 'w');
    await file.writeFile(JSON.stringify(output, null, 2));
  } finally {
    await file?.close();
  }
}
