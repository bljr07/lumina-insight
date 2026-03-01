/**
 * Phase RR RED Tests — IntersectionObserver Integration
 *
 * Tests the observer wiring without running a real browser layout engine.
 * We mock IntersectionObserver and verify it calls the ReReadDetector correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initReReadObserver, disconnectObserver } from '@content/observer.js';
import { ReReadDetector } from '@content/sensors.js';

describe('ReRead Observer Integration', () => {
  let detector;
  let observeMock;
  let disconnectMock;
  let callbackRef;

  beforeEach(() => {
    detector = new ReReadDetector();
    vi.spyOn(detector, 'onElementSeen');
    vi.spyOn(detector, 'onElementLeft');

    // Mock IntersectionObserver
    observeMock = vi.fn();
    disconnectMock = vi.fn();
    
    global.IntersectionObserver = vi.fn().mockImplementation((cb) => {
      callbackRef = cb;
      return {
        observe: observeMock,
        disconnect: disconnectMock,
      };
    });
  });

  afterEach(() => {
    disconnectObserver();
    vi.restoreAllMocks();
    delete global.IntersectionObserver;
  });

  it('should initialize and start observing provided elements', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    
    initReReadObserver(detector, [el1, el2]);

    expect(global.IntersectionObserver).toHaveBeenCalledTimes(1);
    expect(observeMock).toHaveBeenCalledTimes(2);
    expect(observeMock).toHaveBeenCalledWith(el1);
    expect(observeMock).toHaveBeenCalledWith(el2);
  });

  it('should assign a data-lumina-id to elements if they lack an id', () => {
    const el1 = document.createElement('div');
    el1.id = 'existing-id';
    
    const el2 = document.createElement('div');
    // no id on el2
    
    initReReadObserver(detector, [el1, el2]);

    expect(el1.id).toBe('existing-id');
    expect(el1.dataset.luminaId).toBeUndefined();
    expect(el2.dataset.luminaId).toBeDefined(); // should auto-generate an ID
  });

  it('should call onElementSeen when an element intersects', () => {
    const el = document.createElement('div');
    el.id = 'test-node';
    
    initReReadObserver(detector, [el]);

    // Simulate standard intersection payload
    const entries = [{
      target: el,
      isIntersecting: true
    }];
    
    callbackRef(entries);

    expect(detector.onElementSeen).toHaveBeenCalledWith('test-node');
    expect(detector.onElementLeft).not.toHaveBeenCalled();
  });

  it('should call onElementLeft when an element leaves viewport', () => {
    const el = document.createElement('div');
    el.id = 'test-node';
    
    initReReadObserver(detector, [el]);

    // Simulate standard intersection exit
    const entries = [{
      target: el,
      isIntersecting: false
    }];
    
    callbackRef(entries);

    expect(detector.onElementLeft).toHaveBeenCalledWith('test-node');
    expect(detector.onElementSeen).not.toHaveBeenCalled();
  });

  it('should use data-lumina-id if element lacks standard id', () => {
    const el = document.createElement('div');
    
    initReReadObserver(detector, [el]);
    const generatedId = el.dataset.luminaId;

    callbackRef([{ target: el, isIntersecting: true }]);

    expect(detector.onElementSeen).toHaveBeenCalledWith(generatedId);
  });

  it('should disconnect the observer correctly', () => {
    initReReadObserver(detector, [document.createElement('div')]);
    
    disconnectObserver();
    
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
