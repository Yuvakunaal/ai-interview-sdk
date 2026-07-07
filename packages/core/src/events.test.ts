import { describe, expect, it, vi } from 'vitest';
import { InterviewEventEmitter } from './events.js';

describe('InterviewEventEmitter', () => {
  it('calls registered handlers with the emitted payload', () => {
    const emitter = new InterviewEventEmitter();
    const handler = vi.fn();
    emitter.on('sessionStart', handler);

    emitter.emit('sessionStart', { sessionId: 'abc' });

    expect(handler).toHaveBeenCalledWith({ sessionId: 'abc' });
  });

  it('supports multiple handlers for the same event', () => {
    const emitter = new InterviewEventEmitter();
    const first = vi.fn();
    const second = vi.fn();
    emitter.on('sessionEnd', first);
    emitter.on('sessionEnd', second);

    emitter.emit('sessionEnd', { sessionId: 'abc' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes via the return value of on()', () => {
    const emitter = new InterviewEventEmitter();
    const handler = vi.fn();
    const unsubscribe = emitter.on('sessionStart', handler);

    unsubscribe();
    emitter.emit('sessionStart', { sessionId: 'abc' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes via off()', () => {
    const emitter = new InterviewEventEmitter();
    const handler = vi.fn();
    emitter.on('sessionStart', handler);

    emitter.off('sessionStart', handler);
    emitter.emit('sessionStart', { sessionId: 'abc' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when emitting an event with no listeners', () => {
    const emitter = new InterviewEventEmitter();
    expect(() => emitter.emit('sessionExpired', { sessionId: 'abc' })).not.toThrow();
  });
});
