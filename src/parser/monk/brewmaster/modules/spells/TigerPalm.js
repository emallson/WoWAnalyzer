import SPELLS from 'common/SPELLS';
import FunctionalAnalyzer from 'parser/core/FunctionalAnalyzer';

import SharedBrews from '../core/SharedBrews';

const TIGER_PALM_REDUCTION = 1000;

export default class TigerPalm extends FunctionalAnalyzer {
  static dependencies = {
    brews: SharedBrews,
  };

  cdr = 0;
  wastedCdr = 0;

  constructor(...args) {
    super(...args);

    const SELECTED_PLAYER = this.selectedCombatant.id;

    this.register(
      'bocHits', 
      events => {
        return events.casts(SPELLS.TIGER_PALM.id, SELECTED_PLAYER)
          .withBuff(SPELLS.BLACKOUT_COMBO_BUFF.id)
          .count();
      }
    );

    this.register(
      'normalHits', 
      events => {
        return events.casts(SPELLS.TIGER_PALM.id, SELECTED_PLAYER)
          .withoutBuff(SPELLS.BLACKOUT_COMBO_BUFF.id)
          .count();
      }
    );

    this.registerOperator(events => {
      return events.casts(SPELLS.TIGER_PALM.id, SELECTED_PLAYER)
        .forEach(() => {
          const actualReduction = this.brews.reduceCooldown(TIGER_PALM_REDUCTION);
          this.cdr += actualReduction;
          this.wastedCDR += TIGER_PALM_REDUCTION - actualReduction;
        });
    });
  }

  get bocEmpoweredThreshold() {
    if(!this.selectedCombatant.hasTalent(SPELLS.BLACKOUT_COMBO_TALENT.id)) {
      return null;
    }
    return {
      actual: this.bocHits / (this.bocHits + this.normalHits),
      isLessThan: {
        minor: 0.95,
        average: 0.9,
        major: 0.85,
      },
      style: 'percentage',
    };
  }
}
