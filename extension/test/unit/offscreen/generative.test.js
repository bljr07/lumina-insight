/**
 * Phase GEN RED Tests — Dynamic LLM Generation
 *
 * Tests the new behavior where state-classifier.js uses the transient_content
 * field from the packet to generate contextual nudges instead of static templates.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapStateToNudgeAsync } from '@offscreen/state-classifier.js';
import { LearningState, PlatformType } from '@shared/constants.js';

// Hoist the mock to module scope so dynamic import('@xenova/transformers') is intercepted
vi.mock('@xenova/transformers', () => {
  return {
    pipeline: () => { throw new Error('Transformers.js not available in test env'); },
    env: { allowLocalModels: false },
  };
});

describe('mapStateToNudgeAsync() — Generative Nudges', () => {
  let llmMock;

  beforeEach(() => {
    // We mock the window.ai interface built into Chrome for testing the fallback chain
    llmMock = {
      prompt: vi.fn(),
      ready: true,
    };
    global.window = { ai: llmMock };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.window;
  });

  it('should use transient_content to generate a dynamic hint on STRUGGLING', async () => {
    llmMock.prompt.mockResolvedValueOnce('First, try dividing by 2 to isolate the variable.');

    const result = await mapStateToNudgeAsync(
      LearningState.STRUGGLING,
      PlatformType.POLL,
      'Determine the value of x if 2x = 10'
    );

    expect(llmMock.prompt).toHaveBeenCalledTimes(1);
    const promptContent = llmMock.prompt.mock.calls[0][0];
    
    // Assert Output Relevance & Safety constraints (UAC 5)
    expect(promptContent).toContain('Determine the value of x if 2x = 10');
    expect(promptContent).toContain('Do not give the direct answer');
    expect(promptContent).toContain('Provide a single logical first step');
    expect(result.type).toBe('struggling');
    expect(result.message).toBe('First, try dividing by 2 to isolate the variable.');
    expect(result.is_dynamic).toBe(true);
  });

  it('should generate a summary when RE_READING dense text', async () => {
    llmMock.prompt.mockResolvedValueOnce('The mitochondria produces energy for the cell.');

    const result = await mapStateToNudgeAsync(
      LearningState.RE_READING,
      PlatformType.LMS_READING,
      'The mitochondria is a double-membrane-bound organelle found in most eukaryotic organisms. Its primary function is to generate large quantities of energy in the form of adenosine triphosphate (ATP).'
    );

    expect(llmMock.prompt).toHaveBeenCalledTimes(1);
    const promptContent = llmMock.prompt.mock.calls[0][0];
    
    // Assert Output Relevance & Safety constraints (UAC 5)
    expect(promptContent).toContain('The mitochondria is a double-membrane-bound organelle');
    expect(promptContent).toContain('Summarize using only the provided text');
    expect(promptContent).toContain('Do not hallucinate external facts');
    expect(promptContent).toContain('Keep it to exactly one simplified sentence');
    expect(result.type).toBe('re-reading');
    expect(result.message).toBe('The mitochondria produces energy for the cell.');
    expect(result.is_dynamic).toBe(true);
  });

  it('should fallback to mock AI prompt if window.ai is unavailable or fails', async () => {
    llmMock.prompt.mockRejectedValueOnce(new Error('Model not downloaded'));

    const result = await mapStateToNudgeAsync(
      LearningState.STRUGGLING,
      PlatformType.POLL,
      'x + y = 10'
    );

    // Should return the mock demonstration fallback
    expect(result.type).toBe('struggling');
    expect(result.message).toContain('✨ [Mock AI Nudge]: I see you\'re struggling with');
    expect(result.is_dynamic).toBe(true);
  });

  it('should return null (no nudge) when state is FOCUSED even if content exists', async () => {
    const result = await mapStateToNudgeAsync(
      LearningState.FOCUSED,
      PlatformType.LMS_READING,
      'Some random text'
    );

    expect(llmMock.prompt).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
