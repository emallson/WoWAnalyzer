import React from 'react';
import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events from 'parser/core/Events';
import StatTracker from 'parser/shared/modules/StatTracker';
import SPELLS from 'common/SPELLS';
import SpellLink from 'common/SpellLink';
import HIT_TYPES from 'game/HIT_TYPES';
import MAGIC_SCHOOLS from 'game/MAGIC_SCHOOLS';
import { STATISTIC_ORDER } from 'interface/others/StatisticBox';
import StatisticWrapper from 'interface/others/StatisticWrapper';
import STAT, { getClassNameColor, getIcon, getName } from 'parser/shared/modules/features/STAT';
import { formatNumber } from 'common/format';
import InformationIcon from 'interface/icons/Information';
import Tab from 'interface/others/Tab';

// General Traits
import Gemhide from 'parser/shared/modules/spells/bfa/azeritetraits/Gemhide';
import CrystallineCarapace from 'parser/shared/modules/spells/bfa/azeritetraits/CrystallineCarapace';
import LaserMatrix from 'parser/shared/modules/spells/bfa/azeritetraits/LaserMatrix';

import { BASE_AGI } from '../../constants';
import CelestialFortune from '../spells/CelestialFortune';
import GiftOfTheOx from '../spells/GiftOfTheOx';
import MasteryValue from '../core/MasteryValue';
import Stagger from '../core/Stagger';
import AgilityValue from './AgilityValue';
import { diminish, ULDIR_K, MPLUS_K } from '../constants/Mitigation';

// Traits
import FitToBurst from '../spells/azeritetraits/FitToBurst';
import StaggeringStrikes from '../spells/azeritetraits/StaggeringStrikes';
import TrainingOfNiuzao from '../spells/azeritetraits/TrainingOfNiuzao';

function formatGain(gain) {
  if(typeof gain === 'number') {
    return formatNumber(gain);
  } else if(gain.low !== undefined && gain.high !== undefined) {
    return `${formatNumber(gain.low)} - ${formatNumber(gain.high)}`;
  }
  return null;
}

function formatWeight(gain, avg, norm) {
  if(typeof gain === 'number') {
    return (gain / avg / norm).toFixed(2);
  } else if(gain.low !== undefined && gain.high !== undefined) {
    return `${(gain.low / avg / norm).toFixed(2)} - ${(gain.high / avg / norm).toFixed(2)}`;
  }
  return null;
}

function calculateTotalGain(gain) {
  const { low, high } = gain
    .filter(({isLoaded}) => isLoaded !== false)
    .reduce(({low, high}, {amount}) => {
    if(typeof amount === 'number') {
      low += amount;
      high += amount;
    } else if(amount.low !== undefined && amount.high !== undefined) {
      low += amount.low;
      high += amount.high;
    }
    return {
      low, high
    };
  }, { low: 0, high: 0 });

  if(low === high) {
    return low;
  }

  return { 
    low, high
  };
}

function makeIcon(stat) {
  const Icon = getIcon(stat);
  return <Icon
    style={{
      height: '1.6em',
      width: '1.6em',
      marginRight: 10,
    }}
  />;
}

export default class MitigationSheet extends Analyzer {
  static dependencies = {
    masteryValue: MasteryValue,
    agilityValue: AgilityValue,
    cf: CelestialFortune,
    stats: StatTracker,
    stagger: Stagger,
    gotox: GiftOfTheOx,

    // Traits
    ftb: FitToBurst,
    ss: StaggeringStrikes,
    ton: TrainingOfNiuzao,
    gemhide: Gemhide,
    carapace: CrystallineCarapace,
    laserMatrix: LaserMatrix,
  };

  K = null;

  armorDamageMitigated = 0;
  versDamageMitigated = 0;
  versHealing = 0;

  static statsToAvg = ['agility', 'armor', 'versatility', 'mastery', 'crit'];
  _lastStatUpdate = null;
  _avgStats = {};

  get masteryDamageMitigated() {
    return this.masteryValue.expectedMitigation;
  }

  get masteryHealing() {
    return this.masteryValue.totalMasteryHealing;
  }

  _critBonusHealing = 0;

  get agiDamageMitigated() {
    return this.agilityValue.totalAgiPurified;
  }

  get agiDamageDodged() {
    return this.masteryValue.expectedMitigation - this.masteryValue.noAgiExpectedDamageMitigated;
  }

  get agiHealing() {
    return this.agilityValue.totalAgiHealing;
  }

  get wdpsHealing() {
    return this.gotox.wdpsBonusHealing;
  }

  constructor(...args) {
    super(...args);

    const fight = this.owner.fight;
    if(fight.size === 5) {
      this.K = MPLUS_K;
    } else {
      this.K = ULDIR_K[fight.difficulty];
    }

    this._lastStatUpdate = fight.start_time;
    this._avgStats = MitigationSheet.statsToAvg.reduce((obj, stat) => {
      obj[stat] = this.stats._pullStats[stat];
      return obj;
    }, {});

    this.addEventListener(Events.heal.by(SELECTED_PLAYER), this._onCritHeal);
    this.addEventListener(Events.heal.by(SELECTED_PLAYER), this._onHealVers);
    this.addEventListener(Events.damage.to(SELECTED_PLAYER), this._onDamageTaken);
    this.addEventListener('changestats', this._updateStats);
    this.addEventListener(Events.fightend, this._finalizeStats);
  }

  _onCritHeal(event) {
    if(event.hitType !== HIT_TYPES.CRIT || event.ability.guid === SPELLS.CELESTIAL_FORTUNE_HEAL.id) {
      return;
    }

    // counting absorbed healing because we live in a Vectis world
    const totalHeal = event.amount + (event.overheal || 0) + (event.absorbed || 0);
    this._critBonusHealing += Math.max(totalHeal / 2 - (event.overheal || 0), 0); // remove overhealing from the bonus healing
  }

  _onHealVers(event) {
    if(event.ability.guid === SPELLS.CELESTIAL_FORTUNE_HEAL.id) {
      return; // CF is unaffected by vers
    }

    const totalHeal = event.amount + (event.overheal || 0) + (event.absorbed || 0);
    const originalHeal = totalHeal / (1 + this.stats.currentVersatilityPercentage);
    this.versHealing += Math.max(totalHeal - originalHeal - (event.overheal || 0), 0);
  }

  _onDamageTaken(event) {
    if(event.hitType === HIT_TYPES.DODGE) {
      return; // no damage taken, can't do anything
    }
    if(event.unmitigatedAmount === undefined) {
      this.log('Missing unmitigated amount', event);
      return;
    }
    let armorMitigated = 0;
    if(event.ability.type === MAGIC_SCHOOLS.ids.PHYSICAL) {
      armorMitigated = this._mitigate(event, diminish(this.stats.currentArmorRating, this.K));
    }
    // vers mitigation is half the damage/heal %
    const versMitigated = this._mitigate(event, this.stats.currentVersatilityPercentage / 2, armorMitigated);

    this.armorDamageMitigated += armorMitigated;
    this.versDamageMitigated += versMitigated;
  }

  _mitigate(event, drPct, alreadyMitigated = 0) {
    return (event.unmitigatedAmount - alreadyMitigated) * drPct;
  }

  _updateStats(event) {
    const timeDelta = event.timestamp - this._lastStatUpdate;
    if(timeDelta === 0) {
      return; // old stats did nothing
    }
    this._lastStatUpdate = event.timestamp;

    const stats = event.before;

    MitigationSheet.statsToAvg.forEach(stat => {
      this._avgStats[stat] += stats[stat] * timeDelta;
    });
  }

  _finalizeStats(event) {
    const timeDelta = event.timestamp - this._lastStatUpdate;
    this._lastStatUpdate = event.timestamp;

    const stats = this.stats._currentStats;

    MitigationSheet.statsToAvg.forEach(stat => {
      this._avgStats[stat] += stats[stat] * timeDelta;
      this._avgStats[stat] /= this.owner.fightDuration;
    });

  }

  get normalizer() {
    return this.armorDamageMitigated / this._avgStats.armor;
  }

  get results() {
    return {
      armor: {
        icon: (
          <img
            src="/img/shield.png"
            style={{ 
              border: 0,
              marginRight: 10,
            }}
            alt="Shield"
          />
        ),
        name: 'Armor',
        className: 'stat-stamina',
        avg: this._avgStats.armor,
        gain: [
          { name: 'Physical Damage Mitigated', amount: this.armorDamageMitigated },
        ],
        weight: 1,
      },
      wdps: {
        icon: (
          <img
            src="/img/sword.png"
            style={{ 
              border: 0,
              marginRight: 10,
            }}
            alt="Sword"
          />
        ),
        name: 'Weapon DPS',
        className: 'stat-criticalstrike',
        avg: this.gotox._wdps,
        gain: [
          { name: <><SpellLink id={SPELLS.GIFT_OF_THE_OX_1.id} /> Healing</>, amount: this.wdpsHealing },
        ],
      },
      [STAT.AGILITY]: {
        icon: makeIcon(STAT.AGILITY),
        name: getName(STAT.AGILITY),
        className: getClassNameColor(STAT.AGILITY),
        avg: this._avgStats.agility - BASE_AGI,
        gain: [
          { name: <><SpellLink id={SPELLS.GIFT_OF_THE_OX_1.id} /> Healing</>, amount: this.agiHealing },
          { 
            name: 'Dodge', 
            amount: { 
              low: this.agiDamageDodged * (1 - this.stagger.pctPurified), 
              high: this.agiDamageDodged 
            },
            isLoaded: this.masteryValue._loaded,
          },
          { name: <>Extra <SpellLink id={SPELLS.PURIFYING_BREW.id} /> Effectiveness</>, amount: this.agiDamageMitigated },
        ],
      },
      [STAT.MASTERY]: {
        icon: makeIcon(STAT.MASTERY),
        name: getName(STAT.MASTERY),
        className: getClassNameColor(STAT.MASTERY),
        avg: this._avgStats.mastery,
        gain: [
          { name: <><SpellLink id={SPELLS.GIFT_OF_THE_OX_1.id} /> Healing</>, amount: this.masteryHealing },
          { 
            name: 'Dodge', 
            amount:{
              low: this.masteryDamageMitigated * (1 - this.stagger.pctPurified),
              high: this.masteryDamageMitigated,
            },
            isLoaded: this.masteryValue._loaded,
          },
        ],
        tooltip: 'Estimated only after the "Expected Mitigation by Mastery" stat is loaded.',
      },
      [STAT.VERSATILITY]: {
        icon: makeIcon(STAT.VERSATILITY),
        name: getName(STAT.VERSATILITY),
        className: getClassNameColor(STAT.VERSATILITY),
        avg: this._avgStats.versatility,
        gain: [
          { name: 'Damage Mitigated', amount: this.versDamageMitigated },
          { name: 'Additional Healing', amount: this.versHealing },
        ]
      },
      [STAT.CRITICAL_STRIKE]: {
        icon: makeIcon(STAT.CRITICAL_STRIKE),
        name: getName(STAT.CRITICAL_STRIKE),
        className: getClassNameColor(STAT.CRITICAL_STRIKE),
        avg: this._avgStats.crit,
        gain: [
          { name: <><SpellLink id={SPELLS.CELESTIAL_FORTUNE_HEAL.id} /> Healing</>, amount: this.cf.totalHealing },
          { name: 'Critical Heals', amount: this._critBonusHealing }
        ],
      },
    };
  }

  get traitResults() {
    const scale = this.results.armor._scale;
    return {
      [SPELLS.FIT_TO_BURST.id]: {
        active: this.ftb.active,
        gain: this.ftb.totalHealing,
        weight: this.ftb.totalHealing / scale,
      },
      [SPELLS.STAGGERING_STRIKES.id]: {
        active: this.ss.active,
        gain: this.ss.staggerRemoved,
        weight: this.ss.staggerRemoved / scale,
      },
      [SPELLS.GEMHIDE.id]: {
        active: this.gemhide.active,
        gain: this.gemhide.avgArmor / this._avgStats.armor * this.armorDamageMitigated,
        weight: this.gemhide.avgArmor,
        tooltip: 'Avoidance is not counted.',
      },
      [SPELLS.CRYSTALLINE_CARAPACE.id]: {
        active: this.carapace.active,
        gain: this.carapace.avgArmor / this._avgStats.armor * this.armorDamageMitigated,
        weight: this.carapace.avgArmor,
      },
      [SPELLS.LASER_MATRIX.id]: {
        active: this.laserMatrix.active,
        gain: this.laserMatrix.selfHealing,
        weight: this.laserMatrix.selfHealing / scale,
        tooltip: 'Only self-healing is counted.',
      },
      [SPELLS.TRAINING_OF_NIUZAO.id]: {
        active: this.ton.active,
        gain: {
          low: this.ton.avgMastery / this._avgStats.mastery * this.masteryDamageMitigated * (1 - this.stagger.pctPurified),
          high: this.ton.avgMastery / this._avgStats.mastery * this.masteryDamageMitigated,
        },
        weight: this.ton.avgMastery * this.results[STAT.MASTERY].weight,
        isLoaded: this.masteryValue._loaded,
      },
    };
  }

  statEntries() {
    return Object.entries(this.results).map(([stat, result]) => {
      const { icon, className, name, avg, gain, tooltip } = result;

      const totalGain = calculateTotalGain(gain);

      const rows = gain.map(({ name, amount: gain, isLoaded }, i) => {
        let gainEl;
        if(isLoaded !== false) {
          gainEl = formatGain(gain);
        } else {
          gainEl = <dfn data-tip="Not Yet Loaded">NYL</dfn>;
        }

        let valueEl;
        if(isLoaded !== false) {
          valueEl = formatWeight(gain, avg, this.normalizer);
        } else {
          valueEl = <dfn data-tip="Not Yet Loaded">NYL</dfn>;
        }

        return (
          <tr key={`${stat}-${i}`}>
            <td style={{paddingLeft: '5em'}}>
              {name}
            </td>
            <td className="text-right">
              {gainEl}
            </td>
            <td className="text-right">
              {valueEl}
            </td>
          </tr>
        );
      });

      return (
        <>
        <tr key={stat}>
          <td className={className}>
              {icon}{' '}
              {tooltip ? <dfn data-tip={tooltip}>{name}</dfn> : name}
          </td>
          <td className="text-right">
            <b>{formatGain(totalGain)}</b>
          </td>
          <td className="text-right">
            <b>{formatWeight(totalGain, avg, this.normalizer)}</b>
          </td>
        </tr>
        {rows}
        </>
      )
    });
  }

  traitEntries() {
    return Object.entries(this.traitResults)
      .filter(([id, {active}]) => active)
      .sort(([ida, {weight: a}], [idb, {weight: b}]) => b - a)
      .map(([id, result]) => {
        const { gain, isLoaded, tooltip } = result;
        const numTraits = this.selectedCombatant.traitRanks(id).length;

        let gainEl;
        if(isLoaded !== false) {
          gainEl = formatGain(gain);
        } else {
          gainEl = <dfn data-tip="Not Yet Loaded">NYL</dfn>;
        }

        let valueEl;
        if(isLoaded !== false) {
          valueEl = formatWeight(gain, numTraits, this.normalizer);
        } else {
          valueEl = <dfn data-tip="Not Yet Loaded">NYL</dfn>;
        }

        return (
          <tr key={id}>
            <td>
              {numTraits}x <SpellLink id={Number(id)} />
              {tooltip ? (
                <>{' '}<InformationIcon data-tip={tooltip} /></>
              ) : null}
            </td>
            <td className="text-right">
              {gainEl}
            </td>
            <td className="text-right">
              {valueEl}
            </td>
          </tr>
        );
      });
  }

  entries() {
    return (
      <>
      <thead>
        <tr>
          <th>
            <b>Stat</b>
          </th>
          <th className="text-right">
            <b>Total</b>
          </th>
          <th className="text-right">
            <dfn data-tip="Value per rating. Normalized so Armor is always 1.00."><b>Normalized</b></dfn>
          </th>
        </tr>
      </thead>
      <tbody>
        {this.statEntries()}
      </tbody>
      <thead>
        <tr>
          <th><b>Trait</b></th>
          <th className="text-right">
            <b>Total</b>
          </th>
          <th className="text-right">
            <dfn data-tip="Amount of Armor equal to this trait's effective healing. The average value is used when a trait has a range of effectiveness."><b>≈ Armor</b></dfn>
          </th>
        </tr>
      </thead>
      <tbody>
        {this.traitEntries()}
      </tbody>
      </>
    );
  }

  tab() {
    return {
      title: 'Mitigation Values',
      url: 'mitigation-sheet',
      render: () => (
        <Tab>
          <div style={{ marginTop: -10, marginBottom: -10 }}>
            <div style={{padding: '1em'}}>Relative value of different stats for mitigation on this specific log measured by <em>Effective Healing</em>. <b>These values are not stat weights, and should not be used with Pawn or other stat-weight addons.</b></div>
            <div style={{padding: '1em'}}><b>Effective Healing</b> is the amount of damage that was either <em>prevented</em> or <em>healed</em> by an ability. These values are calculated using the actual circumstances of this encounter. While these are informative for understanding the effectiveness of various stats, they may not necessarily be the best way to gear. The stat values are likely to differ based on personal play, fight, raid size, items used, talents chosen, etc.<br /><br />DPS gains are not included in any of the stat values.</div>
            <table className="data-table" style={{ marginTop: 10, marginBottom: 10 }}>
              {this.entries()}
            </table>
          </div>
        </Tab>
      ),
    };
  }
}
