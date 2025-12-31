
import posthog from 'posthog-js';

// Initialize PostHog with the key provided in context
export const initAnalytics = () => {
  // Only init if not already initialized to prevent double-loading in strict mode
  if (!posthog.__loaded) {
    posthog.init('phc_CtptROq4PmHt4avAOX37hl6QQ7oEZN3qe7qa6Fzvyxu', {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only', // Optimized for anonymous usage
      session_recording: {
        maskAllInputs: false, // Allow seeing command input text in replays
        maskTextSelector: ".password" // Don't record passwords
      },
      capture_pageview: true,
      capture_pageleave: true
    });
  }
};

// Identify the user (Email or Guest)
export const identifyUser = (id: string) => {
    if (posthog.__loaded) {
        posthog.identify(id);
    }
};

// Keep track of last fired events to prevent spamming
const lastEvents: Record<string, number> = {};

// Helper to track custom events with throttling
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  const now = Date.now();
  
  // Create a unique key for deduplication
  let key = eventName;
  if (properties?.pair) key += `-${properties.pair}`;
  if (properties?.callsign) key += `-${properties.callsign}`;
  if (properties?.command) key += `-${properties.command}`;

  // Throttle: Don't fire the exact same event/pair more than once every 2 seconds
  if (lastEvents[key] && now - lastEvents[key] < 2000) {
    return;
  }

  lastEvents[key] = now;
  posthog.capture(eventName, properties);
};

export default posthog;
