import type Config from 'parser/Config';
import './react-refresh-hack';
import { wclGameVersionToBranch } from 'game/VERSIONS';
import type { WCLFight } from 'parser/core/Fight';
import type Player from 'parser/core/Player';
import type { Report } from 'parser/core/Report';
import getConfig from 'parser/getConfig';
import { CombatantInfoEvent, EventType, type AnyEvent } from 'parser/core/Events';
import fetchWcl from 'common/fetchWclApi';
import { WCLEventsResponse } from 'common/WCL_TYPES';
import EventEmitter from 'parser/core/modules/EventEmitter';
import type CombatLogParser from 'parser/core/CombatLogParser';
import Analyzer from 'parser/core/Analyzer';

interface LoadRequest {
  type: 'load';
  report: Report;
  fight: WCLFight;
  selectedPlayer: Player;
}

export type BackgroundRequest = LoadRequest;

console.log('loaded background worker');
self.addEventListener('message', (message: MessageEvent<BackgroundRequest>) => {
  console.log(message.data);
  if (message.data.type === 'load') {
    const { report, fight, selectedPlayer } = message.data;
    const branch = wclGameVersionToBranch(report.gameVersion);
    const config = getConfig(
      branch,
      selectedPlayer.combatant.specID,
      selectedPlayer,
      selectedPlayer.combatant,
    );

    if (!config || !config.parser) {
      console.warn('unable to locate config with defined parser');
      return;
      // TODO send message back about missing config
    }

    runParser(config, report, fight, selectedPlayer, updateProgress).then(
      (result: CombatLogParser) => {
        const serialized = Object.values(result._modules).map((v) => Analyzer.serialize(v));
        self.postMessage({
          type: 'parser-complete',
          analyzers: serialized,
          report,
          fight,
          selectedPlayer,
        });
      },
    );
  }

  self.postMessage('test');
});

function updateProgress(ratio: number) {
  self.postMessage({
    type: 'parser-progress',
    ratio,
  });
}

async function runParser(
  config: Config,
  report: Report,
  fight: WCLFight,
  selectedPlayer: Player,
  updateProgress: (ratio: number) => void,
): Promise<unknown> {
  const [parserClass, events] = await Promise.all([
    config.parser!(),
    loadEvents(report, fight, selectedPlayer.id),
  ]);
  const combatantInfoEvents = events
    .filter((event): event is CombatantInfoEvent => event.type === EventType.CombatantInfo)
    .map((event) => ({
      ...event,
      player: report.friendlies.find((player) => player.id === event.sourceID)!,
    }));
  const otherEvents = events.filter((event) => event.type !== EventType.CombatantInfo);

  const parser = new parserClass(
    config,
    report,
    selectedPlayer,
    { ...fight, offset_time: 0 },
    combatantInfoEvents,
    null,
  );

  const normalizedEvents = parser.normalize(otherEvents).sort((a, b) => a.timestamp - b.timestamp);
  // TODO: real fix for this
  for (const event of normalizedEvents) {
    delete event._processedLinks;
  }
  const eventEmitter = parser.getModule(EventEmitter);

  parser.normalizedEvents = normalizedEvents;

  for (let i = 0; i < normalizedEvents.length; i += 1) {
    eventEmitter.triggerEvent(normalizedEvents[i]);
    if (i > 0 && i % 1000 === 0) {
      updateProgress(i / normalizedEvents.length);
    }
  }

  parser.finish();

  return parser;
}

async function loadEvents(report: Report, fight: WCLFight, playerId: number): Promise<AnyEvent[]> {
  const events = [];

  let nextPageTimestamp: number | undefined = fight.start_time;
  while (nextPageTimestamp) {
    const { events: eventsPage, nextPageTimestamp: newTimestamp } =
      await fetchWcl<WCLEventsResponse>(`report/events/${report.code}`, {
        start: nextPageTimestamp,
        end: fight.end_time,
        actorid: playerId,
        translate: true,
      });

    nextPageTimestamp = newTimestamp;
    events.push(...eventsPage);
  }

  return events;
}
