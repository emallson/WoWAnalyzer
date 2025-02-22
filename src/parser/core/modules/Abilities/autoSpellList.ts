// note: these MUST be import types! not regular imports!
import type { RetailSpell } from '@archon/wow-dbc';
import type { SpellList } from '../../../../../scripts/spell-lists/generate';
import { type SpellbookAbility } from '../Ability';
import type Combatant from 'parser/core/Combatant';
import SPELL_CATEGORY from 'parser/core/SPELL_CATEGORY';
import type { WithModifiers } from '@archon/wow-dbc/src/hydraters/effects';

export default function autoSpellBook(
  spells: SpellList,
): (combatant: Combatant) => SpellbookAbility[] {
  return (combatant) =>
    spells.spells
      .filter((spell) => !spell.passive && spell.hidden !== 'always' && spell.name)
      .map((spell) => generateAbility(combatant, spell, spells));
}

function generateAbility(
  combatant: Combatant,
  generated: RetailSpell,
  spellList: SpellList,
): SpellbookAbility {
  return {
    spell: generated.id,
    name: generated.name,
    enabled:
      isKnown(combatant, generated, spellList) && !isOverridden(combatant, generated, spellList),
    gcd: generateGcd(combatant, generated.gcd, spellList),
    cooldown: generateCooldown(combatant, generated.cooldown, spellList),
    charges: generateCharges(combatant, generated.charges, spellList),
    category: generateCategory(combatant, generated),
  };
}

function mergeModifiers<T extends Record<string, any>>(
  combatant: Combatant,
  value: WithModifiers<T>,
  spellList: SpellList,
): T {
  if (!value.modifiers) {
    return value;
  }

  return value.modifiers
    .filter((mod) => mod.requiredSpells.every((id) => isKnownSpellId(combatant, id, spellList)))
    .reduce(
      (result, modifier) => {
        for (const key of Object.keys(modifier)) {
          if (key === 'requiredSpells') {
            continue;
          }
          result[key as keyof T] = mergeModifierValue(result[key], modifier[key]);
        }
        return result;
      },
      { ...value, modifiers: undefined },
    );
}

function mergeModifierValue<T>(left: T, right: T): T {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return (left + right) as T;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return left || right;
  }

  throw new Error(`unable to merge modifier values ${left} and ${right}`);
}

function generateGcd(
  combatant: Combatant,
  generated: RetailSpell['gcd'],
  spellList: SpellList,
): SpellbookAbility['gcd'] {
  if (!generated) {
    return undefined;
  }

  const { duration, hasted } = mergeModifiers(combatant, generated, spellList);

  if (hasted) {
    return {
      base: duration,
    };
  }

  return {
    static: generated.duration,
  };
}

function generateCooldown(
  combatant: Combatant,
  generated: RetailSpell['cooldown'],
  spellList: SpellList,
): SpellbookAbility['cooldown'] {
  if (!generated) {
    return undefined;
  }

  const { duration, hasted } = mergeModifiers(combatant, generated, spellList);
  if (hasted) {
    return (haste) => duration / 1000 / (1 + haste);
  }

  return duration / 1000;
}

function generateCategory(combatant: Combatant, generated: RetailSpell): SPELL_CATEGORY {
  if ((generated.cooldown?.duration ?? 0) >= 60000) {
    return SPELL_CATEGORY.COOLDOWNS;
  }
  return SPELL_CATEGORY.ROTATIONAL;
}

function generateCharges(
  combatant: Combatant,
  generated: RetailSpell['charges'],
  spellList: SpellList,
): SpellbookAbility['charges'] {
  if (!generated) {
    return undefined;
  }

  const { max } = mergeModifiers(combatant, generated, spellList);
  return max;
}

function isKnownSpellId(combatant: Combatant, id: number, spellList: SpellList): boolean {
  const spell = spellList.spells.find((spell) => spell.id === id);
  return Boolean(spell && isKnown(combatant, spell, spellList));
}

function isKnown(combatant: Combatant, generated: RetailSpell, spellList: SpellList): boolean {
  if (generated.type === 'talent') {
    return generated.granted || generated.requiresTalentEntry.some((id) => combatant.hasTalent(id));
  }
  if (generated.type === 'learned') {
    return isKnownSpellId(combatant, generated.taughtBy, spellList);
  }
  return spellList.baselineSpells.includes(generated.id);
}

function isOverridden(combatant: Combatant, generated: RetailSpell, spellList: SpellList): boolean {
  return spellList.spells.some((spell) => {
    return spell.overrides === generated.id && isKnown(combatant, spell, spellList);
  });
}
