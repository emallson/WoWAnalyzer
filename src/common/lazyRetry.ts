import { type ComponentType, lazy, LazyExoticComponent } from 'react';
import sleep from 'common/sleep';

type ComponentPromise<T = any> = Promise<{ default: ComponentType<T> }>;

const retry = async (
  fn: () => ComponentPromise,
  retriesLeft = 3,
  interval = 500,
): ComponentPromise => {
  try {
    return fn();
  } catch (e) {
    if (retriesLeft <= 1) {
      throw e;
    }
    await sleep(interval);
    return retry(fn, retriesLeft - 1, interval * 2);
  }
};

export const lazyRetry = (
  component: () => ComponentPromise,
  retries?: number,
  interval?: number,
): LazyExoticComponent<ComponentType<any>> => lazy(() => retry(component, retries, interval));
