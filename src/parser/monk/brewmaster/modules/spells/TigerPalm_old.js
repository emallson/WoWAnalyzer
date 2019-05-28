import SPELLS from 'common/SPELLS';
import Analyzer from 'parser/core/Analyzer';

import SharedBrews from '../core/SharedBrews';

const TIGER_PALM_REDUCTION = 1000;

class TigerPalm extends Analyzer {
  static dependencies = {
    brews: SharedBrews,
  };

  normalHits = 0;
  bocHits = 0;

  cdr = 0;
  wastedCDR = 0;

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

  on_byPlayer_cast(event) {
    if (SPELLS.TIGER_PALM.id !== event.ability.guid) {
      return;
    }
    const actualReduction = this.brews.reduceCooldown(TIGER_PALM_REDUCTION);
    this.cdr += actualReduction;
    this.wastedCDR += TIGER_PALM_REDUCTION - actualReduction;

    if(this.selectedCombatant.hasBuff(SPELLS.BLACKOUT_COMBO_BUFF.id)) {
      this.bocHits += 1;
    } else {
      this.normalHits += 1;
    }
  }
}

export default TigerPalm;
