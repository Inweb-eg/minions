import { jest } from '@jest/globals';
import {
  createStore,
  createSelector,
  getAppStore,
  resetAppStore,
  createDefaultAppState
} from '../state/ObservableStore.js';

describe('ObservableStore', () => {
  describe('createStore', () => {
    it('should create a store with initial state', () => {
      const store = createStore({ count: 0 });
      expect(store.getState()).toEqual({ count: 0 });
    });

    it('should update state via updater function', () => {
      const store = createStore({ count: 0 });
      store.setState(prev => ({ ...prev, count: prev.count + 1 }));
      expect(store.getState().count).toBe(1);
    });

    it('should bailout on identical state (Object.is)', () => {
      const initial = { count: 0 };
      const store = createStore(initial);
      const listener = jest.fn();
      store.subscribe(listener);

      store.setState(() => initial); // Same reference
      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify listeners on state change', () => {
      const store = createStore({ count: 0 });
      const listener = jest.fn();
      store.subscribe(listener);

      store.setState(prev => ({ ...prev, count: 1 }));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
    });

    it('should support multiple listeners', () => {
      const store = createStore(0);
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      store.subscribe(listener1);
      store.subscribe(listener2);

      store.setState(() => 1);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe via returned function', () => {
      const store = createStore(0);
      const listener = jest.fn();
      const unsub = store.subscribe(listener);

      store.setState(() => 1);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      store.setState(() => 2);
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should call onChange before listeners', () => {
      const order = [];
      const store = createStore(0, () => order.push('onChange'));
      store.subscribe(() => order.push('listener'));

      store.setState(() => 1);
      expect(order).toEqual(['onChange', 'listener']);
    });

    it('should pass old and new state to onChange', () => {
      const onChange = jest.fn();
      const store = createStore({ v: 'a' }, onChange);

      store.setState(() => ({ v: 'b' }));
      expect(onChange).toHaveBeenCalledWith({
        newState: { v: 'b' },
        oldState: { v: 'a' }
      });
    });

    it('should handle listener errors gracefully', () => {
      const store = createStore(0);
      const badListener = jest.fn(() => { throw new Error('boom'); });
      const goodListener = jest.fn();

      store.subscribe(badListener);
      store.subscribe(goodListener);

      store.setState(() => 1);
      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled(); // Still called despite error
    });
  });

  describe('createSelector', () => {
    it('should derive computed state', () => {
      const store = createStore({ items: [1, 2, 3] });
      const getCount = createSelector(store, state => state.items.length);
      expect(getCount()).toBe(3);
    });

    it('should reflect state updates', () => {
      const store = createStore({ items: [1, 2, 3] });
      const getCount = createSelector(store, state => state.items.length);

      store.setState(prev => ({ ...prev, items: [...prev.items, 4] }));
      expect(getCount()).toBe(4);
    });
  });

  describe('app store singleton', () => {
    afterEach(() => resetAppStore());

    it('should return same instance', () => {
      const store1 = getAppStore();
      const store2 = getAppStore();
      expect(store1).toBe(store2);
    });

    it('should have default app state', () => {
      const store = getAppStore();
      const state = store.getState();
      expect(state.mode).toBe('idle');
      expect(state.isExecuting).toBe(false);
      expect(state.permissionMode).toBe('autonomous');
    });

    it('should return fresh instance after reset', () => {
      const store1 = getAppStore();
      store1.setState(prev => ({ ...prev, mode: 'executing' }));
      resetAppStore();
      const store2 = getAppStore();
      expect(store2.getState().mode).toBe('idle');
    });
  });
});
