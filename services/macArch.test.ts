import { describe, expect, it } from 'vitest';
import {
  inferMacArchFromUaArchitecture,
  inferMacArchFromWebGlRenderer,
  macArchSecondaryLabel,
  pickMacDmgAlternate,
  pickMacDmgForArch,
  resolveMacArch,
  resolveMacDmgWithFallback,
} from './macArch';

const assets = [
  {
    name: 'OpenSTARS_0.1.0_aarch64.dmg',
    size: 100,
    browser_download_url: 'https://example.com/aarch64.dmg',
  },
  {
    name: 'OpenSTARS_0.1.0_x64.dmg',
    size: 101,
    browser_download_url: 'https://example.com/x64.dmg',
  },
  {
    name: 'OpenSTARS_0.1.0_x64_en-US.msi',
    size: 102,
    browser_download_url: 'https://example.com/win.msi',
  },
];

describe('inferMacArchFromUaArchitecture', () => {
  it('maps Chromium UA-CH arm / x86', () => {
    expect(inferMacArchFromUaArchitecture('arm')).toBe('arm64');
    expect(inferMacArchFromUaArchitecture('x86')).toBe('x64');
  });

  it('accepts explicit spellings and ignores junk', () => {
    expect(inferMacArchFromUaArchitecture('arm64')).toBe('arm64');
    expect(inferMacArchFromUaArchitecture('aarch64')).toBe('arm64');
    expect(inferMacArchFromUaArchitecture('x86_64')).toBe('x64');
    expect(inferMacArchFromUaArchitecture('')).toBeNull();
    expect(inferMacArchFromUaArchitecture(null)).toBeNull();
    expect(inferMacArchFromUaArchitecture('ia32')).toBeNull();
  });
});

describe('inferMacArchFromWebGlRenderer', () => {
  it('detects Apple Silicon renderers', () => {
    expect(inferMacArchFromWebGlRenderer('ANGLE (Apple, Apple M2, OpenGL 4.1)')).toBe('arm64');
    expect(inferMacArchFromWebGlRenderer('Apple M1 Pro')).toBe('arm64');
    expect(inferMacArchFromWebGlRenderer('Apple GPU')).toBe('arm64');
  });

  it('detects Intel / AMD (and other discrete) as x64', () => {
    expect(inferMacArchFromWebGlRenderer('ANGLE (Intel, Intel(R) UHD Graphics 630)')).toBe('x64');
    expect(inferMacArchFromWebGlRenderer('AMD Radeon Pro 5500M OpenGL Engine')).toBe('x64');
    expect(inferMacArchFromWebGlRenderer('NVIDIA GeForce GT 750M')).toBe('x64');
  });

  it('returns null when unclear', () => {
    expect(inferMacArchFromWebGlRenderer('')).toBeNull();
    expect(inferMacArchFromWebGlRenderer('SwiftShader')).toBeNull();
  });
});

describe('resolveMacArch', () => {
  it('prefers UA-CH over WebGL', () => {
    expect(
      resolveMacArch({
        uaArchitecture: 'x86',
        webGlRenderer: 'Apple M2',
      }),
    ).toBe('x64');
  });

  it('falls back to WebGL then defaults to arm64', () => {
    expect(resolveMacArch({ webGlRenderer: 'Intel Iris Plus' })).toBe('x64');
    expect(resolveMacArch({})).toBe('arm64');
    expect(resolveMacArch({ uaArchitecture: 'mystery', webGlRenderer: null })).toBe('arm64');
  });
});

describe('pickMacDmgForArch / alternate', () => {
  it('picks aarch64 and x64 dmgs', () => {
    expect(pickMacDmgForArch(assets, 'arm64')?.name).toBe('OpenSTARS_0.1.0_aarch64.dmg');
    expect(pickMacDmgForArch(assets, 'x64')?.name).toBe('OpenSTARS_0.1.0_x64.dmg');
  });

  it('returns the other arch for the secondary link', () => {
    expect(pickMacDmgAlternate(assets, 'arm64')?.name).toBe('OpenSTARS_0.1.0_x64.dmg');
    expect(pickMacDmgAlternate(assets, 'x64')?.name).toBe('OpenSTARS_0.1.0_aarch64.dmg');
  });

  it('labels the secondary link for the other chip', () => {
    expect(macArchSecondaryLabel('arm64')).toBe('On an Intel Mac? Download here');
    expect(macArchSecondaryLabel('x64')).toBe('On Apple Silicon? Download here');
  });
});

describe('resolveMacDmgWithFallback', () => {
  const primaryOnlyX64 = [
    {
      name: 'OpenSTARS_0.1.1_x64.dmg',
      size: 200,
      browser_download_url: 'https://example.com/v011-x64.dmg',
    },
  ];
  const fallbackBoth = assets;

  it('uses primary when the arch DMG exists', () => {
    const hit = resolveMacDmgWithFallback(primaryOnlyX64, fallbackBoth, 'x64');
    expect(hit?.fromFallback).toBe(false);
    expect(hit?.asset.name).toBe('OpenSTARS_0.1.1_x64.dmg');
  });

  it('falls back when primary is missing the arch (Apple Silicon gap)', () => {
    const hit = resolveMacDmgWithFallback(primaryOnlyX64, fallbackBoth, 'arm64');
    expect(hit?.fromFallback).toBe(true);
    expect(hit?.asset.name).toBe('OpenSTARS_0.1.0_aarch64.dmg');
    expect(hit?.asset.browser_download_url).toContain('aarch64.dmg');
  });

  it('returns null when neither release has the arch', () => {
    expect(resolveMacDmgWithFallback(primaryOnlyX64, primaryOnlyX64, 'arm64')).toBeNull();
  });
});
