import { hlm } from '@halsa/ui';

describe('hlm (Spartan class merge)', () => {
  it('lets later Tailwind classes win over conflicting ones', () => {
    expect(hlm('px-2 py-1', false && 'hidden', 'px-4')).toBe('py-1 px-4');
  });
});
