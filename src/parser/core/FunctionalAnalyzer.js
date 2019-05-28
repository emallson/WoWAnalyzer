import Analyzer from './Analyzer';
import EventFilter from './EventFilter';

function get(obj, path) {
  return path.split('.').reduce((obj, key) => obj && obj[key] || null, obj);
}

class EventProcessor {
  filters = [];
  aggregator = null;
  // methods which ignore filters and are used for tracking global
  // state, such as buffs and stats
  stateTransformers = [];
  buffs = {};

  filter(fn) {
    this.filters.push(fn);
    return this;
  }

  agg(fn) {
    this.aggregator = fn;
    return this;
  }

  /**
   * Selects events that have event[path] === value
   *
   * path may be a .-separated sequence of keys.
   */
  select(path, value) {
    return this.filter(event => get(event, path) === value);
  }

  /**
   * Selects events that are casts by `caster` of ability `spellId`
   */
  casts(spellId, caster) {
    return this.select('type', 'cast')
      .select('sourceID', caster)
      .select('ability.guid', spellId);
  }

  transformState(fn) {
    this.stateTransformers.push(fn);
    return this;
  }

  trackBuff(spellId, window = 100) {
    if(this.buffs[spellId] !== undefined) {
      return this; // already tracking
    }

    this.buffs[spellId] = window;
    return this.transformState((event, state) => {
      if(state.buffs === undefined) {
        state.buffs = {};
      }
      if(state.removedBuffs === undefined) {
        state.removedBuffs = {};
      }

      if(event.type === 'applybuff' && this.buffs[event.ability.guid] !== undefined) {
        state.buffs[event.ability.guid] = event.timestamp;
      } else if(event.type === 'removebuff' && this.buffs[event.ability.guid] !== undefined) {
        delete state.buffs[event.ability.guid];
        state.removedBuffs[event.ability.guid] = event.timestamp + this.buffs[event.ability.guid];
      }

      Object.keys(state.removedBuffs).forEach(key => {
        if(event.timestamp > state.removedBuffs[key]) {
          delete state.removedBuffs[key];
        }
      });
    });
  }

  /**
   * Selects events that occur while `spellId` is an active buff.
   */
  withBuff(spellId, window) {
    return this.trackBuff(spellId, window)
      .filter((event, state) => state.buffs[spellId] !== undefined || state.removedBuffs[spellId] !== undefined);
  }


  withoutBuff(spellId, window) {
    return this.trackBuff(spellId, window)
      .filter((event, state) => state.buffs[spellId] === undefined && state.removedBuffs[spellId] === undefined);
  }

  count() {
    return this.agg(events => events.length);
  }

  // alright, this is wonky. definitely a red flag in terms of design
  //
  // fn should modify global state in some way.
  forEach(fn) {
    this.filters.push(fn);
    return this;
  }

  step(event, state) {
    this.stateTransformers.forEach(op => op(event, state));
    return this.filters.every(f => f(event, state));
  }

  apply(events, initialState) {
    let state;
    if(initialState === undefined) {
      state = {
        buffs: {},
        removedBuffs: {},
      };
    } else {
      state = Object.assign({}, initialState);
    }

    const results = [];
    events.forEach(event => {
      this.stateTransformers.forEach(op => op(event, state));
      // if the event passes all filters, add it to the result set
      if(this.filters.every(f => f(event, state))) {
        results.push(event);
      }
    });

    return this.aggregator(results);
  }
}

function processorGetter(proc) {
  return
}

export default class FunctionalAnalyzer extends Analyzer {
  processors = {};
  operators = [];
  _partialResults = {};

  register(key, mapper) {
    this.processors[key] = {
      processor: mapper(new EventProcessor()),
      state: {},
    };
    this._partialResults[key] = [];
    Object.defineProperty(this, key, { get: () => this.processors[key].processor.agg(this._partialResults[key]) });
  }

  registerOperator(mapper) {
    this.operators.push({
      processor: mapper(new EventProcessor()),
      state: {},
    });
  }

  constructor(...args) {
    super(...args);

    this.addEventListener(new EventFilter('event'), this._step);
  }

  _step(event) {
    this.operators.forEach(({ processor, state }) => processor.step(event, state));
    Object.entries(this.processors).forEach(([key, { processor, state }]) => {
      if(processor.step(event, state)) {
        this._partialResults[key].push(event);
      }
    });
  }
}
