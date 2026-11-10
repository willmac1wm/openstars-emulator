/**
 * PostHog stays off unless the site operator sets VITE_POSTHOG_KEY.
 * The free classroom build does not load the analytics library and does not
 * send identification or command events.
 */

type PostHog = {
  __loaded?: boolean;
  init: (key: string, options: Record<string, unknown>) => void;
  identify: (id: string) => void;
  capture: (eventName: string, properties?: Record<string, unknown>) => void;
};

let client: PostHog | null = null;

export const initAnalytics = () => {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || client) return;

  void import('posthog-js').then(({ default: posthog }) => {
    if (!import.meta.env.VITE_POSTHOG_KEY || posthog.__loaded) return;
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
    });
    client = posthog as unknown as PostHog;
  }).catch(() => {
    client = null;
  });
};

export const identifyUser = (id: string) => {
  if (client?.__loaded) client.identify(id);
};

const lastEvents: Record<string, number> = {};

export const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
  if (!client?.__loaded) return;

  const now = Date.now();
  let key = eventName;
  if (typeof properties?.pair === 'string') key += `-${properties.pair}`;
  if (typeof properties?.callsign === 'string') key += `-${properties.callsign}`;
  if (typeof properties?.command === 'string') key += `-${properties.command}`;

  if (lastEvents[key] && now - lastEvents[key] < 2000) return;
  lastEvents[key] = now;
  client.capture(eventName, properties);
};
