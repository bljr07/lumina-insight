/**
 * State Classifier — Rule-based learning state classification
 *
 * Maps behavioral metrics to learning state enums. This serves as both
 * a standalone classifier and a complement to the ONNX model.
 * The ONNX model can override these classifications when available.
 */
import { LearningState, PlatformType, SensorConfig } from '../shared/constants.js';

// ─── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  DWELL_HIGH: SensorConfig.DWELL_STALL_THRESHOLD_MS,       // 15000ms
  DWELL_DEEP_READ: 20000,
  JITTER_HIGH: 0.5,
  JITTER_LOW: 0.1,
  TAB_SWITCH_HIGH: 3,
  RE_READ_CYCLES_HIGH: SensorConfig.RE_READ_CYCLE_THRESHOLD,
};

// ─── Classification ────────────────────────────────────────────────────────────

/**
 * Classify the learning state from behavioral metrics using rule-based logic.
 *
 * Priority order:
 * 1. STRUGGLING — high dwell + high jitter (frustration signal)
 * 2. STALLED — high tab switches OR (high dwell + moderate jitter)
 * 3. DEEP_READING — high dwell + low jitter + no tab switches
 * 4. FOCUSED — default (student is engaged normally)
 *
 * @param {{ dwell_time_ms: number, scroll_velocity: number, mouse_jitter: number, tab_switches: number }} metrics
 * @returns {string} One of LearningState values
 */
export function classifyState(metrics) {
  const { dwell_time_ms, mouse_jitter, tab_switches, re_read_cycles } = metrics;

  // High tab switches → distracted / stalled
  if (tab_switches >= THRESHOLDS.TAB_SWITCH_HIGH) {
    return LearningState.STALLED;
  }

  // High re-read cycles → re-reading
  if (re_read_cycles && re_read_cycles >= THRESHOLDS.RE_READ_CYCLES_HIGH) {
    return LearningState.RE_READING;
  }

  // High dwell + high jitter → struggling (frustration)
  if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter >= THRESHOLDS.JITTER_HIGH) {
    return LearningState.STRUGGLING;
  }

  // High dwell + moderate jitter → stalled
  if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter >= THRESHOLDS.JITTER_LOW) {
    return LearningState.STALLED;
  }

  // High dwell + low jitter + 0 tab switches → deep reading
  if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter < THRESHOLDS.JITTER_LOW && tab_switches === 0) {
    return LearningState.DEEP_READING;
  }

  // Default → focused
  return LearningState.FOCUSED;
}

// ─── Nudge Mapping ─────────────────────────────────────────────────────────────

/**
 * Map a learning state + platform context to an actionable nudge.
 *
 * @param {string} state - LearningState value
 * @param {string} platformType - PlatformType value
 * @returns {{ type: string, priority: string, message: string } | null} Nudge or null
 */
export function mapStateToNudge(state, platformType) {
  // No nudge for positive/neutral states
  if (state === LearningState.FOCUSED || state === LearningState.DEEP_READING) {
    return null;
  }

  // STRUGGLING nudges depend on platform
  if (state === LearningState.STRUGGLING) {
    const base = { type: 'struggling', title: 'Take a Breath', priority: 'HIGH' };
    if (platformType === PlatformType.QUIZ) {
      return { ...base, message: 'It looks like you might be stuck. Would you like a hint?' };
    }
    if (platformType === PlatformType.POLL) {
      return { ...base, message: 'Try breaking this down step by step.' };
    }
    if (platformType === PlatformType.LMS_READING) {
      return { ...base, message: 'This section seems challenging. Would you like a simplified explanation?' };
    }
    // Default for STRUGGLING on unknown platform
    return { ...base, message: 'Need some help?' };
  }

  // RE_READING nudge
  if (state === LearningState.RE_READING) {
    return {
      type: 're-reading',
      title: 'Reviewing',
      priority: 'MEDIUM',
      message: 'You seem to be re-reading this section. Here\'s a quick summary.',
    };
  }

  // STALLED nudge
  if (state === LearningState.STALLED) {
    return {
      type: 'stalled',
      title: 'Need a Hint?',
      priority: 'LOW',
      message: 'You\'ve been on this for a while. Consider taking a short break.',
    };
  }

  return null;
}

/**
 * Generate a dynamic prompt using window.ai, falling back to static templates.
 * 
 * @param {string} promptText 
 * @param {string} fallbackPrompt 
 * @returns {Promise<{message: string, is_dynamic: boolean}>}
 */
async function generateNudgeFromLLM(promptText, fallbackPrompt) {
  try {
    if (typeof window !== 'undefined' && window.ai) {
      console.log(`[Lumina Offscreen] 🧠 window.ai detected. Keys:`, Object.keys(window.ai));
      
      let session = null;
      let aiResponse = null;

      // Chrome 128+ (Language Model API)
      if (window.ai.languageModel && typeof window.ai.languageModel.create === 'function') {
        const capabilities = await window.ai.languageModel.capabilities();
        console.log('[Lumina Offscreen] languageModel capabilities:', capabilities.available);
        if (capabilities.available !== 'no') {
          session = await window.ai.languageModel.create();
          console.log(`[Lumina Offscreen] 🧠 Sending Prompt (LanguageModel): \n\n${promptText}`);
          aiResponse = await session.prompt(promptText);
        }
      } 
      // Chrome 127 (Assistant API)
      else if (window.ai.assistant && typeof window.ai.assistant.create === 'function') {
        const capabilities = await window.ai.assistant.capabilities();
        if (capabilities.available !== 'no') {
          session = await window.ai.assistant.create();
          console.log(`[Lumina Offscreen] 🧠 Sending Prompt (Assistant): \n\n${promptText}`);
          aiResponse = await session.prompt(promptText);
        }
      }
      // Chrome 126 (Text Session API)
      else if (typeof window.ai.createTextSession === 'function') {
        session = await window.ai.createTextSession();
        console.log(`[Lumina Offscreen] 🧠 Sending Prompt (TextSession): \n\n${promptText}`);
        aiResponse = await session.prompt(promptText);
      }
      // Older experimental builds
      else if (typeof window.ai.prompt === 'function') {
        console.log(`[Lumina Offscreen] 🧠 Sending Prompt (Legacy prompt): \n\n${promptText}`);
        aiResponse = await window.ai.prompt(promptText);
      }

      if (aiResponse) {
        if (session && typeof session.destroy === 'function') session.destroy();
        console.log(`[Lumina Offscreen] ✨ Received AI Response: \n\n${aiResponse}`);
        return { message: aiResponse.trim(), is_dynamic: true };
      } else {
        console.warn(`[Lumina Offscreen] window.ai exists but couldn't generate a response. Is the model downloaded?`);
      }
    } else {
      console.warn(`[Lumina Offscreen] window.ai is entirely missing. Is the Chrome flag enabled?`);
    }
  } catch (err) {
    console.error('[Lumina Offscreen] LLM generation error:', err);
  }
  
  // Demonstration Fallback: If the user doesn't have chrome://flags/#prompt-api-for-gemini-nano enabled,
  // we still want them to see the text extraction working!
  const extractedTextMatch = promptText.match(/"([^"]+)"/);
  const extractedText = extractedTextMatch ? extractedTextMatch[1].substring(0, 40) + '...' : '';
  
  return { 
    message: `✨ [Mock AI Nudge]: I see you're struggling with "${extractedText}". Let's break it down together!`, 
    is_dynamic: true 
  };
}

/**
 * Asynchronously map a learning state + platform context to an actionable nudge.
 * Enhances the base static nudge with generative AI if transient content is provided.
 *
 * @param {string} state - LearningState value
 * @param {string} platformType - PlatformType value
 * @param {string|null} transientContent - DOM text extracted by the observer
 * @returns {Promise<{ type: string, priority: string, message: string, is_dynamic: boolean } | null>}
 */
export async function mapStateToNudgeAsync(state, platformType, transientContent = null) {
  const baseNudge = mapStateToNudge(state, platformType);
  if (!baseNudge) return null;

  if (transientContent) {
    if (state === LearningState.STRUGGLING && platformType === PlatformType.POLL) {
      const promptText = `
Student is struggling with this problem: "${transientContent}"
Rules:
- Provide a single logical first step to help them start.
- Do not give the direct answer or solve it entirely.
- Do not hallucinate external facts.
      `.trim();
      const result = await generateNudgeFromLLM(promptText, baseNudge.message);
      return { ...baseNudge, ...result };
    }

    if (state === LearningState.RE_READING) {
      const promptText = `
Summarize using only the provided text:
"${transientContent}"
Rules:
- Keep it to exactly one simplified sentence.
- Do not hallucinate external facts.
      `.trim();
      const result = await generateNudgeFromLLM(promptText, baseNudge.message);
      return { ...baseNudge, ...result };
    }

    // Generic fallback: If any text was extracted, demonstrate the AI capability
    // regardless of the exact learning state or platform.
    const promptText = `
The student is viewing this content: "${transientContent}"
Rules:
- Provide a brief relevant hint or observation about this text.
- Do not give direct answers or hallucinate.
    `.trim();
    const result = await generateNudgeFromLLM(promptText, baseNudge.message);
    return { ...baseNudge, title: 'AI Insight', type: 're-reading', ...result };
  }

  return { ...baseNudge, is_dynamic: false };
}
