/**
 * Nudge Logic — Translates raw LearningState into user-friendly messages
 *
 * This pure function powers the Side Panel content.
 */
import { LearningState, PlatformType } from './constants.js';

/**
 * Maps an inferred learning state to a UI nudge object.
 *
 * @param {string} state - The LearningState enum value
 * @param {string} platformType - The PlatformType enum value
 * @returns {{ title: string, message: string, type: string }} Nudge data
 */
export function mapStateToNudge(state, platformType = null) {
  switch (state) {
    case LearningState.STRUGGLING:
      if (platformType === PlatformType.QUIZ) {
        return {
          type: 'struggling',
          title: 'Take a Breath',
          message: "80% of students find this question difficult. Don't stress!",
        };
      }
      return {
        type: 'struggling',
        title: 'Take a Breath',
        message: "It looks like you might be stuck. Let's break this problem down into smaller steps.",
      };

    case LearningState.STALLED:
      if (platformType === PlatformType.PHYSICS_SIM) {
        return {
          type: 'stalled',
          title: 'Need a Hint?',
          message: "You've been changing these variables a lot. Should we review the prerequisite formula?",
        };
      }
      return {
        type: 'stalled',
        title: 'Need a Hint?',
        message: "You've been on this for a while. Try reviewing the previous section for clues.",
      };

    case LearningState.FOCUSED:
      return {
        type: 'focused',
        title: 'On Fire!',
        message: "You're doing great! Keep up the momentum.",
      };

    case LearningState.DEEP_READING:
      return {
        type: 'deep-reading',
        title: 'Deep Focus',
        message: 'Great focus on the reading material. Take notes if you find anything complex!',
      };

    case LearningState.RE_READING:
      if (platformType === PlatformType.LMS_READING) {
        return {
          type: 're-reading',
          title: 'Reviewing',
          message: 'It looks like you are rereading this. Want me to generate a high-level synthesis of the key arguments?',
        };
      }
      return {
        type: 're-reading',
        title: 'Reviewing',
        message: 'Connecting the dots is great. Re-reading helps solidify complex concepts.',
      };

    case LearningState.PENDING_LOCAL_AI:
      return {
        type: 'pending',
        title: 'Analyzing...',
        message: 'Lumina is gathering insights on your learning patterns.',
      };

    default:
      // Includes null/undefined and unrecognized states
      return {
        type: 'idle',
        title: 'Idle',
        message: 'Browse to a supported learning platform to start receiving insights.',
      };
  }
}
