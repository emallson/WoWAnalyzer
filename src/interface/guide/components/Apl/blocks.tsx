import styled from '@emotion/styled';
import { t } from '@lingui/macro';
import Spell from 'common/SPELLS/Spell';
import { SubSection } from 'interface/guide';
import { Apl, CheckResult, isRuleEqual, Rule } from 'parser/shared/metrics/apl';
import React, { useContext, useState } from 'react';
import ViolationProblemList, {
  AplViolationExplanation,
  ExplanationList,
  SelectedExplanation,
  violationExplanations,
} from './violations';
import { AplViolationExplainers, defaultExplainers } from './violations/claims';

export enum Category {
  Core,
  MaintainBuff,
  MaintainDebuff,
  CastSequence,
  Talent,
  Filler,
  Custom,
}

type FixedCategory = Exclude<Category, Category.Custom>;

type CategoryProps =
  | {
      category: Category.Custom;
      color: string;
      title: string;
    }
  | { category: FixedCategory; color?: undefined; title?: undefined };

type Props = React.PropsWithChildren<
  {
    rules: Rule[];
  } & CategoryProps
>;

const Container = styled.div`
  display: grid;
  grid-template-columns: [explanation] 40% [problems] 1fr;
  align-items: start;
  grid-gap: 0 2rem;
`;

const color = (hue: number) => `hsl(${hue}, 80%, 70%)`;

const categoryColors: Record<FixedCategory, string> & Record<Category.Custom, undefined> = {
  [Category.Core]: color(180),
  [Category.MaintainBuff]: color(132),
  [Category.MaintainDebuff]: color(132),
  [Category.Filler]: 'hsl(180, 30%, 90%)',
  [Category.CastSequence]: color(55),
  [Category.Talent]: color(30),
  [Category.Custom]: undefined,
};

const categoryTitles: Record<FixedCategory, string> & Record<Category.Custom, undefined> = {
  [Category.Custom]: undefined,
  [Category.Core]: t({ id: 'apl.block.title.core', message: 'Core' }),
  [Category.MaintainBuff]: t({ id: 'apl.block.title.maintain-buff', message: 'Maintain Buffs' }),
  [Category.MaintainDebuff]: t({
    id: 'apl.block.title.maintain-debuff',
    message: 'Maintain Debuffs',
  }),
  [Category.Filler]: t({ id: 'apl.block.title.filler', message: 'Filler' }),
  [Category.CastSequence]: t({ id: 'apl.block.title.cast-sequence', message: 'Sequence' }),
  [Category.Talent]: t({ id: 'apl.block.title.talent', message: 'Talent' }),
};

const InnerBlockContainer = styled.div<{
  background: string;
}>`
  background-color: ${(props) => props.background};
  grid-column: explanation;
  align-content: start;

  border: 1px solid black;

  border-radius: 0.5rem;
  margin: 0.5rem 0;

  display: grid;
  grid-template-areas: 'titlebar' 'content';
`;
const ProblemContainer = styled.div`
  grid-column: problems;
  padding-top: 1rem;
`;

const InnerBlockTitleArea = styled.div`
  grid-area: titlebar;
  width: 100%;
  padding-left: 1rem;

  border-bottom: 1px solid hsla(0, 100%, 100%, 10%);

  background-color: hsla(0, 100%, 100%, 5%);
`;
// TODO: we don't ship Roboto Slab
const InnerBlockTitle = styled.div`
  color: hsla(0, 0%, 0%, 75%);
  font-family: 'Roboto Slab', sans-serif;
  font-variant: small-caps;
`;

const InnerBlockActions = styled.div``;

const InnerBlockContent = styled.div`
  color: black;
  font-size: 1.6rem;
  grid-area: content;

  line-height: 1.8em;
  padding: 1rem 1rem 0.5rem 1rem;

  small {
    color: hsla(0, 0%, 20%, 1);
  }

  .spell-link-text {
    background: #333;
    border-radius: 0.25em;
    padding-right: 0.5em;
    display: inline;

    overflow: hidden;

    position: relative;
    padding-left: 1.75em;
    padding-bottom: 0.15em;

    img {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      height: 100%;
      margin-top: 0;
    }
  }
`;

const InnerBlock = ({
  color,
  title,
  children,
}: React.PropsWithChildren<{ color: string; title: string }>) => (
  <InnerBlockContainer background={color}>
    <InnerBlockTitleArea>
      <InnerBlockTitle>{title}</InnerBlockTitle>
      <InnerBlockActions></InnerBlockActions>
    </InnerBlockTitleArea>
    <InnerBlockContent>{children}</InnerBlockContent>
  </InnerBlockContainer>
);

type ContextData = {
  explanations: ReturnType<typeof violationExplanations>;
  apl: Apl | undefined;
  result: CheckResult | undefined;
};

const ViolationExplanationContext = React.createContext<ContextData>({
  explanations: [],
  apl: undefined,
  result: undefined,
});

export default function Block({ rules, category, color, children, title }: Props): JSX.Element {
  const { explanations, apl, result } = useContext(ViolationExplanationContext);

  const [selectedExplanation, setSelectedExplanation] = useState<
    SelectedExplanation<any> | undefined
  >(undefined);

  const problems = explanations.filter(({ claimData }) =>
    Array.from(claimData.claims).some((v) => rules.some((rule) => isRuleEqual(v.rule, rule))),
  );

  return (
    <>
      <InnerBlock
        color={categoryColors[category] ?? color ?? 'red'}
        title={categoryTitles[category] ?? title ?? 'Error'}
      >
        {children}
      </InnerBlock>
      <ProblemContainer>
        <ExplanationList>
          {problems.map(
            (problem, ix) =>
              apl &&
              result && (
                <li key={ix}>
                  <AplViolationExplanation
                    data={problem}
                    apl={apl}
                    result={result}
                    onClick={setSelectedExplanation}
                  />
                </li>
              ),
          )}
        </ExplanationList>
        {apl && result && selectedExplanation && (
          <ViolationProblemList
            apl={apl}
            result={result}
            {...selectedExplanation}
            secondsShown={7}
          />
        )}
      </ProblemContainer>
    </>
  );
}

export function SequenceDisplay({ sequence }: { sequence: Spell[] }): JSX.Element | null {
  return null;
}

export function AplSubSection({
  children,
  apl,
  result,
  explainers: inputExplainers,
}: React.PropsWithChildren<{
  apl: Apl;
  explainers?: AplViolationExplainers;
  result: CheckResult;
}>): JSX.Element {
  const explainers = inputExplainers ?? defaultExplainers;

  const appliedClaims = result && violationExplanations(apl, result, explainers);

  return (
    <SubSection>
      <ViolationExplanationContext.Provider
        value={{
          apl,
          result,
          explanations: appliedClaims ?? [],
        }}
      >
        <Container>{children}</Container>
      </ViolationExplanationContext.Provider>
    </SubSection>
  );
}
