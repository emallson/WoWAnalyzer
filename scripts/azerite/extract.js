/**
 * This script extracts azerite trait scaling data from the DBC dump in
 * the SIMC repository.
 *
 * Usage:
 *    node extract.js <path-to-simc>/engine/dbc/generated/sc_spell_data.inc > <WoWAnalyzer-path>/src/common/AZERITE_SCALING.generated.json
 */
const argv = require('process').argv;
const fs = require('fs');
const spell_ids = require('./traits.json');

const dbc_dump = argv[2];

const dbc_lines = fs.readFileSync(dbc_dump, { encoding: 'utf8' }).split(/\n/);

// we use regex to find the start locations to pull data from and to
// identify fields.
const SPELL_DATA_COUNT_RE = /#define (PTR_)?SPELL_SIZE \((\d+)\)/;
const SPELL_DATA_START_RE = /static struct spell_data_t/;
const SPELL_DATA_RE = /.*{ "([^"]+)".*?,(.+)}.*\/\* ([\d, ]+) \*\//;

const SPELL_EFFECT_COUNT_RE = /#define __(PTR_)?SPELLEFFECT_SIZE \((\d+)\)/;
const SPELL_EFFECT_START_RE = /static struct spelleffect_data_t/;
const SPELL_EFFECT_DATA_RE = /.*?{ ([^{}}]+).+/;

// get # of spells
let num_spells = -1;
let i = 0;
for (; i < dbc_lines.length; i++) {
  const line = dbc_lines[i];
  const match = line.match(SPELL_DATA_COUNT_RE);
  if (!match) {
    continue;
  }
  num_spells = match[2];
  break;
}

// find the start of the spelldata struct
for (; i < dbc_lines.length; i++) {
  const line = dbc_lines[i];
  const matches = line.search(SPELL_DATA_START_RE);
  if (matches < 0) {
    continue;
  }
  break;
}

i += 1;

const SPELL_DATA = {};
const effects = {};

// read it out. we use the comment associated with it to get the spell
// effect list
//
// Note that JS regex is somewhat limited in that it can't do repeated
// groups
for (let j = 0; j < num_spells; i++, j++) {
  const line = dbc_lines[i];
  const match = line.match(SPELL_DATA_RE);
  if (!match) {
    console.error(line);
    return;
  }
  const [, name, _fields, _effects] = match;
  const fields = _fields.replace(' ', '').split(/,/).map(Number);
  const id = Number(fields[0]);
  const scaling_type = fields[6];
  const effect_list = _effects.split(/, /).map(Number);
  if (spell_ids.includes(id)) {
    SPELL_DATA[id] = {
      name, effect_list,
      scaling_type,
      effects: {},
    };
    for (const effect of effect_list) {
      effects[effect] = id;
    }
  }
}

// now repeat the above, but for effects instead of spells
let num_effects = -1;
for (; i < dbc_lines.length; i++) {
  const line = dbc_lines[i];
  const match = line.match(SPELL_EFFECT_COUNT_RE);
  if (!match) {
    continue;
  }
  num_effects = match[2];
  break;
}

for (; i < dbc_lines.length; i++) {
  const line = dbc_lines[i];
  const matches = line.search(SPELL_EFFECT_START_RE);
  if (matches < 0) {
    continue;
  }
  break;
}

i += 1;

for (let j = 0; j < num_effects; i++, j++) {
  const line = dbc_lines[i];
  const match = line.match(SPELL_EFFECT_DATA_RE);
  if (!match) {
    console.error(line);
    return;
  }
  const fields = match[1].replace(' ', '').split(/,/).map(Number);
  const id = fields[0];
  const effect_type = fields[5];
  const avg_coeff = fields[6];

  if (effects[id]) {
    SPELL_DATA[effects[id]].effects[id] = { type: effect_type, avg: avg_coeff };
  }
}

// dump out the data. to store in a file, just pipe it
console.log(JSON.stringify(SPELL_DATA, null, 2));
