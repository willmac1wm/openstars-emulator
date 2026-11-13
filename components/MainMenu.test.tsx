/**
 * Simplified menu (Nov 2026): title + five session cards + How to Play +
 * one footer line. No testing-library in this repo, so these tests render
 * the menu to static markup in node (effects don't run; that also proves
 * the menu renders without a voice runtime or localStorage).
 *
 * Interaction (seed input appears after tapping "replay", rank tap reveals
 * the initials editor) is covered by the Playwright smoke script, not here.
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MainMenu from './MainMenu';
import RadarScope from './RadarScope';
import { EMPTY_PROGRESS } from '../services/progression';

function menuHtml(props: Partial<React.ComponentProps<typeof MainMenu>> = {}): string {
  return renderToStaticMarkup(
    React.createElement(MainMenu, {
      onStart: vi.fn(),
      onTutorial: vi.fn(),
      highScore: 4000,
      profile: { initials: 'ATC' },
      progress: EMPTY_PROGRESS,
      onOpenLeaderboard: vi.fn(),
      onOpenInstructor: vi.fn(),
      ...props,
    }),
  );
}

describe('simplified main menu', () => {
  it('renders all five session cards, How to Play, and the footer line', () => {
    const html = menuHtml();
    for (const label of ['EXPO ARCADE', '60-SECOND CHALLENGE', 'TRAINEE', 'CONTROLLER', 'VETERAN']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('HOW TO PLAY');
    expect(html).toContain('data-testid="mode-Expo"');
    expect(html).toContain('data-testid="mode-Expo60"');
    expect(html).toContain('data-testid="mode-Easy"');
    expect(html).toContain('data-testid="mode-Medium"');
    expect(html).toContain('data-testid="mode-Hard"');
    // Footer: best score + rank + small links.
    expect(html).toContain('4000');
    expect(html).toContain('RANK: TRAINEE');
    expect(html).toContain('data-testid="daily-challenge"');
    expect(html).toContain('data-testid="leaderboard-open"');
    expect(html).toContain('data-testid="instructor-open"');
  });

  it('does NOT render the removed clutter on first paint', () => {
    const html = menuHtml();
    expect(html).not.toContain('QUICK TIPS');
    expect(html).not.toContain('Command examples');
    expect(html).not.toContain('voice-preload-banner');
    expect(html).not.toContain('Loading pilot voices');
    expect(html).not.toContain('Start with basic voice');
    expect(html).not.toContain('Start Expo with basic voice');
    expect(html).not.toContain('data-testid="seed-input"');
    expect(html).not.toContain('data-testid="progression-panel"');
    expect(html).not.toContain('Your initials');
    expect(html).not.toContain('N/E exits');
    expect(html).not.toContain('S/W exits');
  });

  it('keeps the seed and profile editors reachable behind footer toggles', () => {
    const html = menuHtml();
    expect(html).toContain('data-testid="replay-seed-toggle"');
    expect(html).toContain('data-testid="profile-open"');
  });

  it('shows the 60-second card before Trainee in the markup', () => {
    const html = menuHtml();
    expect(html.indexOf('60-SECOND CHALLENGE')).toBeLessThan(html.indexOf('TRAINEE'));
    expect(html.indexOf('EXPO ARCADE')).toBeLessThan(html.indexOf('60-SECOND CHALLENGE'));
  });
});

describe('gate altitudes on the scope', () => {
  it('labels every gate with its legal altitudes', () => {
    const html = renderToStaticMarkup(
      React.createElement(RadarScope, {
        aircraft: [],
        onSelectAircraft: vi.fn(),
        scanAngle: 0,
        showPrimaryData: true,
      }),
    );
    for (const gate of ['NOR', 'EAS', 'SOU', 'WES']) {
      expect(html).toContain(`data-testid="gate-alt-${gate}"`);
    }
    expect(html).toContain('A070 / A090');
    expect(html).toContain('A060 / A080');
  });
});
