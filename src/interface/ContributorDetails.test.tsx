import { describe, expect, it } from 'vitest';
import { Dummy } from 'CONTRIBUTORS';
import renderer from 'react-test-renderer';

import ContributorDetails from './ContributorDetails';

describe('ContributorDetails', () => {
  it('matches snapshot', () => {
    const tree = renderer.create(<ContributorDetails contributorId={Dummy.nickname} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
