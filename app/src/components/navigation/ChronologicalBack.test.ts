import { describe, expect, it } from 'vitest';
import { TabRouter } from 'expo-router/build/react-navigation/routers/TabRouter';
import { StackRouter } from 'expo-router/build/react-navigation/routers/StackRouter';

describe('the actual Expo Router navigation reducers', () => {
  it('returns through every visited tab, including repeat visits to Home and Squad', () => {
    const router = TabRouter({ initialRouteName: 'today', backBehavior: 'fullHistory' });
    const options = {
      routeNames: ['today', 'room', 'progress', 'me', 'log'],
      routeParamList: {},
      routeGetIdList: {},
    };
    let state = router.getInitialState(options);
    const visited = ['room', 'progress', 'today', 'me', 'room', 'log'];
    for (const name of visited)
      state = router.getStateForAction(
        state,
        { type: 'NAVIGATE', payload: { name } },
        options,
      )! as typeof state;
    for (const name of ['room', 'me', 'today', 'progress', 'room', 'today']) {
      state = router.getStateForAction(state, { type: 'GO_BACK' }, options)! as typeof state;
      expect(state.routes[state.index]?.name).toBe(name);
    }
    expect(router.getStateForAction(state, { type: 'GO_BACK' }, options)).toBeNull();
  });
  it('pops Compare to Person and Person to Squad before leaving its root stack', () => {
    const router = StackRouter({ initialRouteName: '(tabs)' });
    const options = {
      routeNames: ['(tabs)', 'squad/person', 'squad/compare', 'weekly-plan', 'paywall'],
      routeParamList: {},
      routeGetIdList: {},
    };
    let state = router.getInitialState(options);
    for (const name of ['squad/person', 'squad/compare', 'paywall'])
      state = router.getStateForAction(
        state,
        { type: 'PUSH', payload: { name } },
        options,
      )! as typeof state;
    for (const name of ['squad/compare', 'squad/person', '(tabs)']) {
      state = router.getStateForAction(state, { type: 'GO_BACK' }, options)! as typeof state;
      expect(state.routes[state.index]?.name).toBe(name);
    }
  });
});
