import React from 'react';

import SPELLS from 'common/SPELLS';
import SpellLink from 'common/SpellLink';
import { formatNumber } from 'common/format';
import Analyzer from 'parser/core/Analyzer';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import GlobalCooldown from 'parser/paladin/retribution/modules/core/GlobalCooldown';

const CAST_BUFFER = 500;

class Crusade extends Analyzer {
	static dependencies = {
    abilityTracker: AbilityTracker,
    globalCooldown: GlobalCooldown,
	};

	constructor(...args) {
    super(...args);
		this.active = this.selectedCombatant.hasTalent(SPELLS.CRUSADE_TALENT.id);
	}

	crusadeCastTimestamp = 0;
	badFirstGlobal = 0;
  gcdBuffer = 0;

	on_byPlayer_cast(event) {
		const spellId = event.ability.guid;
		if (spellId !== SPELLS.CRUSADE_TALENT.id) {
			return;
		}
    this.crusadeCastTimestamp = event.timestamp;
    this.gcdBuffer = this.globalCooldown.getGlobalCooldownDuration(spellId);
	}

	on_byPlayer_applybuffstack(event) {
		const spellId = event.ability.guid;
		if (spellId !== SPELLS.CRUSADE_TALENT.id) {
			return;
		}
		if(this.crusadeCastTimestamp && event.timestamp > (this.crusadeCastTimestamp + CAST_BUFFER + this.gcdBuffer)) {
			this.badFirstGlobal++;
		}
		this.crusadeCastTimestamp = null;
	}

	get badGlobalPercent() {
		return this.badFirstGlobal / this.abilityTracker.getAbility(SPELLS.CRUSADE_TALENT.id).casts;
	}

	get suggestionThresholds() {
		return {
			actual: 1 - this.badGlobalPercent,
			isLessThan: {
				minor: 1,
				average: 0.75,
				major: 0.5,
			},
			style: 'percentage',
		};
	}

	suggestions(when) {
		when(this.suggestionThresholds).addSuggestion((suggest, actual) => {
			return suggest(<>You want to build stacks of <SpellLink id={SPELLS.CRUSADE_TALENT.id} icon /> as quickly as possible. Make sure you are using <SpellLink id={SPELLS.TEMPLARS_VERDICT.id} icon /> or <SpellLink id={SPELLS.DIVINE_STORM.id} icon /> almost instantly after casting <SpellLink id={SPELLS.CRUSADE_TALENT.id} icon />.</>)
				.icon(SPELLS.CRUSADE_TALENT.icon)
				.actual(`${formatNumber(this.badFirstGlobal)} bad first global(s)`)
				.recommended(`0 is recommended`);
		});
	}
}

export default Crusade;
