import type { PinnedLocation } from '../types';

export const MAX_LOCATION_LABEL_CHARS = 120;
const COORDINATE_PRECISION = 6;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

export function parseCoordinateInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePinnedLocation(value: unknown): PinnedLocation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    !isFiniteNumber(candidate.latitude) ||
    !isFiniteNumber(candidate.longitude) ||
    candidate.latitude < -90 ||
    candidate.latitude > 90 ||
    candidate.longitude < -180 ||
    candidate.longitude > 180
  ) {
    return null;
  }

  const label = typeof candidate.label === 'string'
    ? candidate.label.trim().slice(0, MAX_LOCATION_LABEL_CHARS)
    : '';

  return {
    latitude: roundCoordinate(candidate.latitude),
    longitude: roundCoordinate(candidate.longitude),
    ...(label ? { label } : {}),
  };
}

export function buildGoogleMapsUrl(location: PinnedLocation): string {
  const query = `${location.latitude},${location.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
