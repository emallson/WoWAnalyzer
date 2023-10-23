/* eslint-disable @typescript-eslint/no-var-requires */
import { Spec } from 'game/SPECS';
import { Race } from 'parser/core/Combatant';
import PhaseConfig from 'parser/core/PhaseConfig';
import MythicPlusSeasonOne from 'game/raids/mythicplusseasonone';
import MythicPlusSeasonTwo from 'game/raids/mythicplusseasontwo';
import VaultOfTheIncarnates from 'game/raids/vaultoftheincarnates';
import Aberrus from 'game/raids/aberrus';
import Amirdrassil from 'game/raids/amirdrassil';
// import Ulduar from 'game/raids/ulduar';
// import TrialOfTheGrandCrusader from 'game/raids/trialofthegrandcrusader';
import IcecrownCitadel from 'game/raids/icc';

interface EncounterConfig {
  vantusRuneBuffId?: number;
  softMitigationChecks?: {
    physical: [];
    magical: [];
  };
  resultsWarning?: string;
  phases?: { [key: string]: PhaseConfig };
  raceTranslation?: (race: Race, spec?: Spec) => Race;
  disableDeathSuggestion?: boolean;
  disableDowntimeSuggestion?: boolean;
  disableDowntimeStatistic?: boolean;
}
export interface Boss {
  id: number;
  name: string;
  background?: string;
  backgroundPosition?: string;
  headshot?: string;
  icon?: string;
  fight: EncounterConfig;
}
interface Raid {
  bosses: Record<string, Boss>;
}
export interface Phase extends PhaseConfig {
  start: number[];
  end: number[];
}
export interface Dungeon {
  id: number;
  name: string;
  background?: string;
  backgroundPosition?: string;
  headshot?: string;
  icon?: string;
  fight: unknown;
}

const raids = {
  // Dragonflight
  MythicPlusSeasonOne,
  MythicPlusSeasonTwo,
  VaultOfTheIncarnates, // tier 29
  Aberrus, // tier 30
  Amirdrassil, // tier 31
  // Wrath of the Lich King (Classic)
  // Ulduar, // tier 8
  // TrialOfTheGrandCrusader, // tier 9
  IcecrownCitadel, // tier 10
};
export default raids;

export function findByBossId(id: number): Boss | null {
  let boss: Boss | null = null;
  Object.values(raids).some((raid: Raid) => {
    const match = Object.values(raid.bosses).find((boss) => boss.id === id);
    if (match) {
      boss = match;
      return true;
    }
    return false;
  });
  return boss;
}
