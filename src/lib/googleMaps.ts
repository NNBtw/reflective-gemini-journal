export interface GoogleMapsLatLngLiteral {
  lat: number;
  lng: number;
}

export interface GoogleMapsMapInstance {
  addListener: (
    eventName: 'click',
    handler: (event: { latLng: { lat: () => number; lng: () => number } | null }) => void
  ) => { remove: () => void };
  panTo: (position: GoogleMapsLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
}

export interface GoogleMapsMarkerInstance {
  map: GoogleMapsMapInstance | null;
  position: GoogleMapsLatLngLiteral;
}

export interface GoogleMapsApi {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        center: GoogleMapsLatLngLiteral;
        zoom: number;
        mapId: string;
        clickableIcons: boolean;
        streetViewControl: boolean;
        fullscreenControl: boolean;
        mapTypeControl: boolean;
      }
    ) => GoogleMapsMapInstance;
    marker: {
      AdvancedMarkerElement: new (options: {
        map: GoogleMapsMapInstance;
        position: GoogleMapsLatLngLiteral;
        title: string;
      }) => GoogleMapsMarkerInstance;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleMapsApi;
    __reflectAiGoogleMapsReady?: () => void;
  }
}

const SCRIPT_ID = 'reflectai-google-maps-script';
let mapsLoadPromise: Promise<GoogleMapsApi> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  if (!apiKey.trim()) {
    return Promise.reject(new Error('MAPS_NOT_CONFIGURED'));
  }

  if (window.google?.maps?.Map && window.google.maps.marker?.AdvancedMarkerElement) {
    return Promise.resolve(window.google);
  }

  if (mapsLoadPromise) {
    return mapsLoadPromise;
  }

  mapsLoadPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const finish = () => {
      if (window.google?.maps?.Map && window.google.maps.marker?.AdvancedMarkerElement) {
        resolve(window.google);
      } else {
        mapsLoadPromise = null;
        reject(new Error('MAPS_LOAD_FAILED'));
      }
    };

    window.__reflectAiGoogleMapsReady = finish;

    if (existingScript) {
      existingScript.addEventListener('load', finish, { once: true });
      existingScript.addEventListener('error', () => {
        mapsLoadPromise = null;
        reject(new Error('MAPS_LOAD_FAILED'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=marker&callback=__reflectAiGoogleMapsReady`;
    script.onerror = () => {
      mapsLoadPromise = null;
      script.remove();
      reject(new Error('MAPS_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}
