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

interface SpellList {
  specId: number;
  baselineSpells: number[];
  activeSpells: RetailSpell[];
}

const spellLists: Record<number, SpellList> = {};
for (const specId of specList) {
  if (spellLists[specId]) {
    // due to double indexing, there may be repeated specs.
    continue;
  }
  const spellList = await retailSpellList(retailDbc, specId);
  const data: RetailSpell[] = await loadAll(PRESETS.RETAIL, retailDbc, spellList);

  spellLists[specId] = {
    specId,
    baselineSpells: data
      .filter((spell) => spell.type === SpellType.Class || spell.type === SpellType.Spec)
      .map((spell) => spell.id),
    activeSpells: data
      .filter((spell) => !spell.passive && !spell.hidden && spell.name)
      .map(formatSpell),
  };
}

let file: fs.FileHandle | undefined = undefined;
try {
  const directory = path.join(import.meta.dirname, '..', '..', 'src', 'generated');
  await fs.mkdir(directory, { recursive: true });
  file = await fs.open(path.join(directory, 'RETAIL_SPELLS.json'), 'w');
  await file.writeFile(JSON.stringify(spellLists, null, 2));
} finally {
  await file?.close();
}
