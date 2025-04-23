import ErrorBoundary from 'interface/ErrorBoundary';
import makeAnalyzerUrl from 'interface/makeAnalyzerUrl';
import NavigationBar from 'interface/NavigationBar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BackgroundRequest } from './background-worker';

import BOSS_PHASES_STATE from './BOSS_PHASES_STATE';
import { useConfig } from './ConfigContext';
import EVENT_PARSING_STATE from './EVENT_PARSING_STATE';
import { ReportExpansionContextProvider } from './ExpansionContext';
import FightSelection from './FightSelection';
import useBossPhaseEvents from './hooks/useBossPhaseEvents';
import useCharacterProfile from './hooks/useCharacterProfile';
import useEventParser from './hooks/useEventParser';
import useEvents from './hooks/useEvents';
import useParser from './hooks/useParser';
import usePhases, { SELECTION_ALL_PHASES } from './hooks/usePhases';
import useTimeEventFilter, { Filter } from './hooks/useTimeEventFilter';
import PatchChecker from './PatchChecker';
import PlayerLoader from './PlayerLoader';
import ReportLoader from './ReportLoader';
import Results from './Results';
import SupportChecker from './SupportChecker';
import { useReport } from 'interface/report/context/ReportContext';
import { usePlayer } from 'interface/report/context/PlayerContext';
import { useFight } from 'interface/report/context/FightContext';
import { LoadingStatus } from 'interface/report/Results/ResultsContext';
import Panel from 'interface/Panel';
import { Trans } from '@lingui/react/macro';
import Report from 'parser/core/Report';
import { Link } from 'react-router-dom';
import { WCLFight } from 'parser/core/Fight';
import CombatLogParser from 'parser/core/CombatLogParser';
import getConfig from 'parser/getConfig';
import { wclGameVersionToBranch } from 'game/VERSIONS';

const UnsupportedSpecBouncer = ({ report, fight }: { report: Report; fight: WCLFight }) => (
  <div className="container offset">
    <Panel
      title={
        <Trans id="interface.report.unsupportSpec.title">
          The selected specialization is not supported.
        </Trans>
      }
    >
      <div className="flex wrappable">
        <div className="flex-main pad">
          <p>
            <Trans id="interface.report.unsupportedSpec.body">
              The selected specialization has not been updated for the latest expansion and cannot
              be used due to ability changes.
            </Trans>
          </p>
          <Link to={makeAnalyzerUrl(report, fight.id)}>Go Back</Link>
        </div>
      </div>
    </Panel>
  </div>
);

const ResultsLoader = () => {
  const config = useConfig();
  const { report } = useReport();
  const { player, combatants } = usePlayer();
  const { fight } = useFight();

  const workerRef = useRef<Worker>();
  const [parser, setParser] = useState<CombatLogParser | null>(null);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const worker = (workerRef.current = new Worker(
      new URL('./background-worker/index.ts', import.meta.url),
      { type: 'module' },
    ));

    worker.addEventListener('message', (event) => {
      if (event.data.type === 'parser-progress') {
        setProgress(event.data.ratio);
      } else if (event.data.type === 'parser-complete') {
        const { report, fight, selectedPlayer, analyzers } = event.data;
        const config = getConfig(
          wclGameVersionToBranch(report.gameVersion),
          selectedPlayer.combatant.specID,
          selectedPlayer,
          selectedPlayer.combatant,
        );

        const analyzersByKey = Object.fromEntries(analyzers.map((v) => [v.key, v]));

        config.parser?.().then((parserClass) => {
          const parser = new parserClass(
            config,
            report,
            selectedPlayer,
            fight,
            [],
            null,
            analyzersByKey,
          );
          setParser(parser);
        });
      }
    });

    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    const selectedPlayer = {
      ...player,
      combatant: combatants.find((event) => event.sourceID === player.id)!,
    };
    workerRef.current?.postMessage({
      type: 'load',
      report,
      fight,
      selectedPlayer,
    } satisfies BackgroundRequest);
  }, [report, fight, player, combatants]);

  const { characterProfile, isLoading: isLoadingCharacterProfile } = useCharacterProfile({
    report,
    player,
  });

  const loadingStatus: LoadingStatus = {
    progress: progress,
    isLoadingParser: false,
    isLoadingEvents: false,
    bossPhaseEventsLoadingState: undefined,
    isLoadingCharacterProfile: isLoadingCharacterProfile,
    isLoadingPhases: false,
    isFilteringEvents: false,
    parsingState: parser ? EVENT_PARSING_STATE.DONE : EVENT_PARSING_STATE.WAITING,
  };

  if (!config.parser) {
    // display error instead. this is not normally accessible via the UI but would be via direct link / URL modification
    return <UnsupportedSpecBouncer report={report} fight={fight} />;
  }

  return (
    <Results
      config={config}
      loadingStatus={loadingStatus}
      report={report}
      fight={{ offset_time: 0, filtered: false, ...fight }} //if no filtered fight has been parsed yet, pass previous fight object alongside 0 offset time and no filtering
      player={player}
      characterProfile={characterProfile!}
      parser={parser}
      phases={null}
      selectedPhase={''}
      selectedInstance={0}
      selectedDungeonPull={''}
      handlePhaseSelection={() => {}}
      handleDungeonPullSelection={() => {}}
      applyFilter={() => {}}
      timeFilter={undefined}
      makeTabUrl={(tab: string) => makeAnalyzerUrl(report, fight.id, player.id, tab)}
    />
  );
};

export function Component() {
  return (
    <>
      <NavigationBar />

      <ErrorBoundary>
        <ReportLoader>
          <ReportExpansionContextProvider>
            <PatchChecker>
              <FightSelection>
                <PlayerLoader>
                  <SupportChecker>
                    <ResultsLoader />
                  </SupportChecker>
                </PlayerLoader>
              </FightSelection>
            </PatchChecker>
          </ReportExpansionContextProvider>
        </ReportLoader>
      </ErrorBoundary>
    </>
  );
}
