import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useIntegritySignals } from './use-integrity-signals.js';

function fireTabSwitch(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});

describe('useIntegritySignals', () => {
  it('starts with empty signals', () => {
    const { result } = renderHook(() => useIntegritySignals(true));
    expect(result.current.getSnapshot()).toEqual({
      tabSwitchCount: 0,
      tabSwitchTimestamps: [],
      pasteEvents: [],
    });
  });

  it('does not attach a visibilitychange listener at all when enabled is false', () => {
    const { result } = renderHook(() => useIntegritySignals(false));
    act(() => result.current.setActive(true));
    act(() => fireTabSwitch(true));
    expect(result.current.getSnapshot().tabSwitchCount).toBe(0);
  });

  it('ignores tab-switch events while not active, even when enabled', () => {
    const { result } = renderHook(() => useIntegritySignals(true));
    act(() => fireTabSwitch(true));
    expect(result.current.getSnapshot().tabSwitchCount).toBe(0);
  });

  it('counts a tab switch only on the hidden transition, once active', () => {
    const { result } = renderHook(() => useIntegritySignals(true));
    act(() => result.current.setActive(true));

    act(() => fireTabSwitch(true));
    expect(result.current.getSnapshot().tabSwitchCount).toBe(1);

    // Coming back into view is not itself a second switch-away.
    act(() => fireTabSwitch(false));
    expect(result.current.getSnapshot().tabSwitchCount).toBe(1);

    act(() => fireTabSwitch(true));
    expect(result.current.getSnapshot().tabSwitchCount).toBe(2);
    expect(result.current.getSnapshot().tabSwitchTimestamps).toHaveLength(2);
  });

  it('stops counting once setActive(false) is called (e.g. session paused/ended)', () => {
    const { result } = renderHook(() => useIntegritySignals(true));
    act(() => result.current.setActive(true));
    act(() => fireTabSwitch(true));
    act(() => result.current.setActive(false));
    act(() => fireTabSwitch(false));
    act(() => fireTabSwitch(true));
    expect(result.current.getSnapshot().tabSwitchCount).toBe(1);
  });

  it('records paste events with length and timestamp while active', () => {
    const { result } = renderHook(() => useIntegritySignals(true));
    act(() => result.current.setActive(true));
    act(() => result.current.recordPaste(240));
    expect(result.current.getSnapshot().pasteEvents).toHaveLength(1);
    expect(result.current.getSnapshot().pasteEvents[0]!.length).toBe(240);
    expect(typeof result.current.getSnapshot().pasteEvents[0]!.timestamp).toBe('number');
  });

  it('ignores paste events while not active', () => {
    const { result } = renderHook(() => useIntegritySignals(true));
    act(() => result.current.recordPaste(240));
    expect(result.current.getSnapshot().pasteEvents).toHaveLength(0);
  });

  it('removes its visibilitychange listener on unmount', () => {
    const { result, unmount } = renderHook(() => useIntegritySignals(true));
    act(() => result.current.setActive(true));
    unmount();
    expect(() => fireTabSwitch(true)).not.toThrow();
  });
});
