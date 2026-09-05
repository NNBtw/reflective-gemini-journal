import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, MapPin, Trash2, X } from 'lucide-react';
import type { PinnedLocation } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { auth } from '../lib/firebase';
import {
  loadGoogleMaps,
  type GoogleMapsApi,
  type GoogleMapsMapInstance,
  type GoogleMapsMarkerInstance,
} from '../lib/googleMaps';
import {
  buildGoogleMapsUrl,
  MAX_LOCATION_LABEL_CHARS,
  normalizePinnedLocation,
  parseCoordinateInput,
} from '../lib/location';

interface LocationPickerProps {
  value?: PinnedLocation | null;
  onSave: (location: PinnedLocation) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}

const TAIWAN_CENTER = { lat: 23.6978, lng: 120.9605 };

export const LocationPicker: React.FC<LocationPickerProps> = ({
  value,
  onSave,
  onRemove,
  onClose,
}) => {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapsMapInstance | null>(null);
  const markerRef = useRef<GoogleMapsMarkerInstance | null>(null);
  const markerConstructorRef = useRef<GoogleMapsApi['maps']['marker']['AdvancedMarkerElement'] | null>(null);
  const [latitudeInput, setLatitudeInput] = useState(value ? String(value.latitude) : '');
  const [longitudeInput, setLongitudeInput] = useState(value ? String(value.longitude) : '');
  const [label, setLabel] = useState(value?.label || '');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState(false);

  const candidate = useMemo(() => {
    const latitude = parseCoordinateInput(latitudeInput);
    const longitude = parseCoordinateInput(longitudeInput);
    if (latitude === null || longitude === null) return null;
    return normalizePinnedLocation({ latitude, longitude, label });
  }, [latitudeInput, longitudeInput, label]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    let cancelled = false;
    let clickListener: { remove: () => void } | null = null;

    const initializeMap = async () => {
      let idToken: string | undefined;
      try {
        idToken = await auth.currentUser?.getIdToken();
      } catch {
        if (!cancelled) setLoadState('error');
        return;
      }

      if (!idToken) {
        if (!cancelled) setLoadState('error');
        return;
      }

      let response: Response;
      try {
        response = await fetch('/api/maps-config', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch {
        if (!cancelled) setLoadState('error');
        return;
      }

      if (!response.ok) {
        if (!cancelled) setLoadState(response.status === 503 ? 'missing' : 'error');
        return;
      }

      let config: unknown;
      try {
        config = await response.json();
      } catch {
        if (!cancelled) setLoadState('error');
        return;
      }

      const apiKey = typeof (config as { apiKey?: unknown })?.apiKey === 'string'
        ? (config as { apiKey: string }).apiKey.trim()
        : '';
      const mapId = typeof (config as { mapId?: unknown })?.mapId === 'string'
        ? (config as { mapId: string }).mapId.trim()
        : '';

      if (!apiKey || !mapId) {
        if (!cancelled) setLoadState('missing');
        return;
      }

      try {
        const google = await loadGoogleMaps(apiKey);
        if (cancelled || !mapContainerRef.current) return;

        const initialPosition = value
          ? { lat: value.latitude, lng: value.longitude }
          : TAIWAN_CENTER;
        const map = new google.maps.Map(mapContainerRef.current, {
          center: initialPosition,
          zoom: value ? 15 : 7,
          mapId,
          clickableIcons: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        });

        mapRef.current = map;
        markerConstructorRef.current = google.maps.marker.AdvancedMarkerElement;

        if (value) {
          markerRef.current = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: initialPosition,
            title: value.label || t('pinnedLocation'),
          });
        }

        clickListener = map.addListener('click', (event) => {
          if (!event.latLng) return;
          setLatitudeInput(event.latLng.lat().toFixed(6));
          setLongitudeInput(event.latLng.lng().toFixed(6));
          setActionError(false);
        });
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      clickListener?.remove();
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      markerConstructorRef.current = null;
      mapRef.current = null;
    };
  }, [t, value]);

  useEffect(() => {
    const map = mapRef.current;
    const Marker = markerConstructorRef.current;
    if (!map || !Marker || !candidate) return;

    const position = { lat: candidate.latitude, lng: candidate.longitude };
    if (markerRef.current) {
      markerRef.current.position = position;
      markerRef.current.map = map;
    } else {
      markerRef.current = new Marker({
        map,
        position,
        title: candidate.label || t('pinnedLocation'),
      });
    }
  }, [candidate, t]);

  const handleSave = async () => {
    if (!candidate || isSaving) {
      setActionError(true);
      return;
    }
    setIsSaving(true);
    setActionError(false);
    try {
      await onSave(candidate);
    } catch {
      setActionError(true);
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setActionError(false);
    try {
      await onRemove();
    } catch {
      setActionError(true);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B2926]/50 p-3 sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#D9D0C4] bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#E5DDD3] px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 id="location-picker-title" className="flex items-center gap-2 font-serif text-xl font-bold text-[#2B2926]">
              <MapPin className="h-5 w-5 text-[#5B6A4C]" aria-hidden="true" />
              {t('locationDialogTitle')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6B655B]">{t('locationDialogDesc')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={t('closeLocationDialog')}
            className="rounded-lg p-1.5 text-[#7A746B] hover:bg-[#EFEAE2] hover:text-[#2B2926] disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="relative h-64 overflow-hidden rounded-xl border border-[#D9D0C4] bg-[#F1ECE5] sm:h-80">
            <div ref={mapContainerRef} className="h-full w-full" aria-label={t('locationMapLabel')} />
            {loadState !== 'ready' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#F7F3ED] p-6 text-center">
                {loadState === 'loading' ? (
                  <p className="text-sm text-[#6B655B]">{t('mapLoading')}</p>
                ) : (
                  <div className="max-w-md">
                    <AlertTriangle className="mx-auto h-6 w-6 text-[#A65B35]" aria-hidden="true" />
                    <p className="mt-2 text-sm font-semibold text-[#443E36]">
                      {loadState === 'missing' ? t('mapConfigMissing') : t('mapUnavailable')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#7A746B]">{t('mapUnavailableHint')}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-2 text-xs text-[#6B655B]">{t('mapClickHint')}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-[#443E36]">
              {t('latitude')}
              <input
                type="number"
                min="-90"
                max="90"
                step="0.000001"
                inputMode="decimal"
                value={latitudeInput}
                onChange={(event) => setLatitudeInput(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#D8CFC3] bg-[#FAF8F5] px-3 py-2 text-sm text-[#2B2926] focus:border-[#404835] focus:outline-hidden"
              />
            </label>
            <label className="text-xs font-medium text-[#443E36]">
              {t('longitude')}
              <input
                type="number"
                min="-180"
                max="180"
                step="0.000001"
                inputMode="decimal"
                value={longitudeInput}
                onChange={(event) => setLongitudeInput(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#D8CFC3] bg-[#FAF8F5] px-3 py-2 text-sm text-[#2B2926] focus:border-[#404835] focus:outline-hidden"
              />
            </label>
          </div>

          <label className="mt-3 block text-xs font-medium text-[#443E36]">
            {t('locationLabel')}
            <input
              type="text"
              maxLength={MAX_LOCATION_LABEL_CHARS}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('locationLabelPlaceholder')}
              className="mt-1 w-full rounded-xl border border-[#D8CFC3] bg-[#FAF8F5] px-3 py-2 text-sm text-[#2B2926] placeholder:text-[#9A9287] focus:border-[#404835] focus:outline-hidden"
            />
          </label>

          <div className="mt-4 rounded-xl border border-[#DCE4D4] bg-[#F3F7EF] p-3 text-xs leading-relaxed text-[#46513C]">
            {t('locationPrivacyNotice')}
          </div>

          {actionError && (
            <p role="alert" className="mt-3 text-xs font-medium text-[#9C3826]">
              {candidate ? t('locationSaveError') : t('invalidCoordinates')}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DDD3] bg-[#FAF8F5] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            {value && (
              <>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#9C3826] hover:bg-[#FCF0EC] disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('removeLocation')}
                </button>
                <a
                  href={buildGoogleMapsUrl(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#4F5A41] hover:bg-[#EBF0E5]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('openInGoogleMaps')}
                </a>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl px-4 py-2 text-xs font-medium text-[#6B655B] hover:bg-[#EFEAE2] disabled:opacity-40"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!candidate || isSaving}
              className="rounded-xl bg-[#404835] px-4 py-2 text-xs font-semibold text-[#FAF8F5] hover:bg-[#32392A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? t('savingLocation') : t('saveLocation')}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
