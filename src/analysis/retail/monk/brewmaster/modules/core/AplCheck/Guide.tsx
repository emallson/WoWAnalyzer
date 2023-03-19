import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/monk';
import { SpellLink } from 'interface';
import { Section, SubSection, useEvents, useInfo } from 'interface/guide';
import Block, {
  AplSubSection,
  Category,
  SequenceDisplay,
} from 'interface/guide/components/Apl/blocks';
import { defaultExplainers } from 'interface/guide/components/Apl/violations/claims';
import Explanation from 'interface/guide/components/Explanation';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import { Highlight } from '../../spells/Shuffle/GuideSection';
import { rules, apl, BrewmasterApl, check, chooseApl } from '../AplCheck';
import AplChoiceDescription from './AplChoiceDescription';
import explainSCK, { filterSCK } from './explainSCK';

const EKTechBlock = () => (
  <Block category={Category.CastSequence} rules={[rules.EK_TECH]}>
    Use <SpellLink id={SPELLS.SPINNING_CRANE_KICK_BRM} /> to trigger the bonus damage from{' '}
    <SpellLink id={talents.EXPLODING_KEG_TALENT} />.
    <SequenceDisplay
      sequence={[
        talents.EXPLODING_KEG_TALENT,
        SPELLS.SPINNING_CRANE_KICK_BRM,
        SPELLS.SPINNING_CRANE_KICK_BRM,
      ]}
    />
  </Block>
);

const BdbBlock = () => (
  <Block category={Category.MaintainDebuff} rules={[rules.BDB]}>
    Re-apply <SpellLink id={talents.BONEDUST_BREW_TALENT} /> when it drops.
  </Block>
);

const RjwBlock = () => (
  <Block category={Category.MaintainBuff} rules={[rules.RJW]}>
    <p>
      Refresh <SpellLink id={talents.RUSHING_JADE_WIND_TALENT} />.
    </p>
    <small>It is okay to refresh early.</small>
  </Block>
);

const FillerBlock = () => (
  <Block category={Category.Filler} rules={rules.fillers}>
    <p>Cast these when you have nothing else to do:</p>
    <ul>
      <li>
        <SpellLink id={SPELLS.SPINNING_CRANE_KICK_BRM} /> if there are multiple enemies
      </li>
      <li>
        <SpellLink id={SPELLS.TIGER_PALM} /> if there is only one enemy
      </li>
    </ul>
  </Block>
);

const BlackoutComboBlocks = () => (
  <>
    <EKTechBlock />
    <BdbBlock />
    <Block category={Category.Talent} rules={[SPELLS.BLACKOUT_KICK_BRM, rules.BOC_BOF]}>
      <p>
        Use <SpellLink id={SPELLS.BLACKOUT_KICK_BRM} /> to activate{' '}
        <SpellLink id={talents.BLACKOUT_COMBO_TALENT} />.
      </p>
      <p>
        Only use <SpellLink id={talents.BREATH_OF_FIRE_TALENT} /> if{' '}
        <SpellLink id={talents.BLACKOUT_COMBO_TALENT} /> is active.
      </p>
      <small>
        (You can spend <SpellLink id={talents.BLACKOUT_COMBO_TALENT} /> on other things.)
      </small>
    </Block>
    <Block category={Category.Core} rules={[rules.BOC_KS, talents.RISING_SUN_KICK_TALENT]}>
      <p>Use these abilities on cooldown:</p>
      <ul>
        <li>
          <SpellLink id={talents.RISING_SUN_KICK_TALENT} />
        </li>
        <li>
          <SpellLink id={talents.KEG_SMASH_TALENT} />
        </li>
      </ul>
    </Block>
    <RjwBlock />
    <FillerBlock />
  </>
);

const ChpDfBBlocks = () => (
  <>
    <EKTechBlock />
    <BdbBlock />
    <Block category={Category.Talent} rules={rules.CHP_DFB_BOF}>
      <p>
        Use <SpellLink id={talents.BREATH_OF_FIRE_TALENT} /> as often as possible.
      </p>
    </Block>
    <Block
      category={Category.Core}
      rules={[SPELLS.BLACKOUT_KICK_BRM, talents.RISING_SUN_KICK_TALENT, talents.KEG_SMASH_TALENT]}
    >
      <p>Use these abilities on cooldown:</p>
      <ul>
        <li>
          <SpellLink id={SPELLS.BLACKOUT_KICK_BRM} />
        </li>
        <li>
          <SpellLink id={talents.RISING_SUN_KICK_TALENT} />
        </li>
        <li>
          <SpellLink id={talents.KEG_SMASH_TALENT} />
        </li>
      </ul>
    </Block>
    <RjwBlock />
    <FillerBlock />
  </>
);

const blockComponents: Record<BrewmasterApl, (() => JSX.Element) | undefined> = {
  [BrewmasterApl.BlackoutCombo]: BlackoutComboBlocks,
  [BrewmasterApl.ChPDfB]: ChpDfBBlocks,
  [BrewmasterApl.Fallback]: undefined,
};

const explainers = {
  explainSCK,
  overcast: defaultExplainers.overcastFillers,
  // rethinking the lack of explainer priority here. we want to show custom text explaining the change to SCK, but doing so requires post-processing of the droppedRule results
  dropped: filterSCK(defaultExplainers.droppedRule),
};

export default function RotationGuideSection(): JSX.Element | null {
  const info = useInfo();
  const events = useEvents();

  if (!info) {
    return null;
  }

  const result = check(events, info);

  const aplType = chooseApl(info);
  const Blocks = blockComponents[aplType] ?? (() => null);

  return (
    <Section title="Core Rotation">
      <p>
        The Brewmaster rotation is driven by a <em>priority list</em>. When using an ability, you
        should try to use the one that is <em>highest</em> on the list. Doing this improves your
        damage by prioritizing high-damage, high-impact spells like{' '}
        <SpellLink id={talents.RISING_SUN_KICK_TALENT.id} /> and{' '}
        <SpellLink id={talents.KEG_SMASH_TALENT.id} /> over low-priority "filler" spells like{' '}
        <SpellLink id={SPELLS.TIGER_PALM.id} />.
      </p>
      <AplChoiceDescription aplChoice={chooseApl(info)} />
      <AplSubSection apl={apl(info)} result={result} explainers={explainers}>
        <Blocks />
      </AplSubSection>
      <SubSection title="Major Cooldowns">
        <Explanation>
          <p>
            Major cooldowns like <SpellLink id={talents.WEAPONS_OF_ORDER_TALENT} /> are a major
            contributor to your overall damage. As a tank, they are also key to establishing threat
            on pull and when new enemies spawn or are pulled.
          </p>
          <p>
            It is generally correct to hold your cooldowns by a small amount in order to line up
            with fight mechanics, so they aren't a part of the overall rotation listed in the
            previous section. However, holding them too long can hurt your damage
            significantly&mdash;especially if you outright skip a cast (shown in{' '}
            <Highlight color="#834c4a">red</Highlight>).
          </p>
          <p>
            <small>
              Note that <SpellLink id={talents.INVOKE_NIUZAO_THE_BLACK_OX_TALENT} /> is only
              included in this list if you are using{' '}
              <SpellLink id={talents.IMPROVED_INVOKE_NIUZAO_THE_BLACK_OX_TALENT} />. If you are not,
              it does about as much damage two <SpellLink id={talents.RISING_SUN_KICK_TALENT} />
              s&mdash;not nothing, but not worth thinking much about.
            </small>
          </p>
        </Explanation>
        {info.combatant.hasTalent(talents.WEAPONS_OF_ORDER_TALENT) && (
          <CastEfficiencyBar
            spellId={talents.WEAPONS_OF_ORDER_TALENT.id}
            gapHighlightMode={GapHighlight.FullCooldown}
            useThresholds
          />
        )}
        {info.combatant.hasTalent(talents.EXPLODING_KEG_TALENT) && (
          <CastEfficiencyBar
            spellId={talents.EXPLODING_KEG_TALENT.id}
            gapHighlightMode={GapHighlight.FullCooldown}
            useThresholds
          />
        )}
        {info.combatant.hasTalent(talents.SUMMON_WHITE_TIGER_STATUE_TALENT) && (
          <CastEfficiencyBar
            spellId={talents.SUMMON_WHITE_TIGER_STATUE_TALENT.id}
            gapHighlightMode={GapHighlight.FullCooldown}
            useThresholds
          />
        )}
        {info.combatant.hasTalent(talents.IMPROVED_INVOKE_NIUZAO_THE_BLACK_OX_TALENT) && (
          <CastEfficiencyBar
            spellId={talents.INVOKE_NIUZAO_THE_BLACK_OX_TALENT.id}
            gapHighlightMode={GapHighlight.FullCooldown}
            useThresholds
          />
        )}
      </SubSection>
    </Section>
  );
}
