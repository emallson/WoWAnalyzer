import SPELLS from 'common/SPELLS';
import { TALENTS_MONK } from 'common/TALENTS';
import SPECS from 'game/SPECS';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events from 'parser/core/Events';
import Abilities from 'parser/core/modules/Abilities';
import SPELL_CATEGORY from 'parser/core/SPELL_CATEGORY';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import TalentSpellText from 'parser/ui/TalentSpellText';

class FaelineStomp extends Analyzer {
  static dependencies = {
    abilities: Abilities,
    spellUsable: SpellUsable,
  };

  protected abilities!: Abilities;
  protected spellUsable!: SpellUsable;

  resets = 0;
  flsCasts = 0;
  targetsDamaged = 0;
  targetsHealed = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS_MONK.FAELINE_STOMP_TALENT.id);

    if (!this.active) {
      return;
    }

    (options.abilities as Abilities).add({
      spell: TALENTS_MONK.FAELINE_STOMP_TALENT.id,
      category: SPELL_CATEGORY.ROTATIONAL,
      cooldown: 30,
      gcd:
        this.selectedCombatant.spec === SPECS.MISTWEAVER_MONK ? { base: 1500 } : { static: 1000 },
      castEfficiency: {
        suggestion: true,
        recommendedEfficiency: 0.8,
      },
    });

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS_MONK.FAELINE_STOMP_TALENT),
      this.casts,
    );
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.FAELINE_STOMP_RESET),
      this.reset,
    );
    this.addEventListener(
      Events.damage
        .by(SELECTED_PLAYER)
        .spell([SPELLS.FAELINE_STOMP_HEAL, SPELLS.FAELINE_STOMP_PULSE_DAMAGE]),
      this.damage,
    );
    this.addEventListener(
      Events.heal.by(SELECTED_PLAYER).spell(SPELLS.FAELINE_STOMP_HEAL),
      this.heal,
    );
  }

  casts() {
    this.flsCasts += 1;
  }

  reset() {
    if (this.spellUsable.isOnCooldown(TALENTS_MONK.FAELINE_STOMP_TALENT.id)) {
      this.spellUsable.endCooldown(TALENTS_MONK.FAELINE_STOMP_TALENT.id);
      this.resets += 1;
    }
  }

  damage() {
    this.targetsDamaged += 1;
  }

  heal() {
    this.targetsHealed += 1;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL()}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
      >
        <TalentSpellText talent={TALENTS_MONK.FAELINE_STOMP_TALENT}>
          {this.resets} <small>resets</small> <br />
          {(this.targetsDamaged / this.flsCasts).toFixed(2)} <small>Foes Hit per cast</small> <br />
          {(this.targetsHealed / this.flsCasts).toFixed(2)} <small>Allies Hit per cast</small>
        </TalentSpellText>
      </Statistic>
    );
  }
}

export default FaelineStomp;
