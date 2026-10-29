import { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, Loader2, Star } from 'lucide-react';
import moonIcon from '@assets/moon.svg';
import lanternIcon from '@assets/lantern.svg';
import datesIcon from '@assets/dates.svg';

interface SleepCycle {
  cycles: number;
  duration: number;
  totalDuration: number;
  wakeTime: Date;
}

interface SleepSchedule {
  bedTime: Date;
  sleepCycles: SleepCycle[];
}

interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  timezone: string;
  method: {
    name: string;
  };
}

interface Location {
  city: string;
  country: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  displayName?: string;
}

interface PlaceSuggestion {
  placeId: number;
  city: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

interface HijriDate {
  day: string;
  month: {
    en: string;
    ar: string;
  };
  year: string;
}

const MILLISECONDS_IN_MINUTE = 60000;

// Saved on this device, so a visitor only has to enter their city once.
// Anything unparseable (or unavailable, e.g. private browsing) falls back
// to the original Chicago defaults instead of breaking the page.
function loadStoredLocation(): Location {
  try {
    const stored = localStorage.getItem('suhoor-location');
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Location>;
      if (parsed.city && parsed.country) {
        return {
          city: parsed.city,
          country: parsed.country,
          state: parsed.state,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          displayName: parsed.displayName,
        };
      }
    }
  } catch {
    // Ignore storage errors and use the defaults below.
  }
  return { city: 'Chicago', country: 'USA', displayName: 'Chicago, USA' };
}

function placeDisplayName(city: string, state: string | undefined, country: string): string {
  return [city, state, country].filter(Boolean).join(', ');
}

// Nominatim place search, filtered to places (not streets or businesses)
// so a name like Dublin returns every Dublin, each with its own
// state/country line for the user to pick from. Coordinates stay hidden:
// they are only used in the background for the prayer-times call.
async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&q=${encodeURIComponent(query)}`,
    { signal, headers: { Accept: 'application/json' } }
  );
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const suggestions: PlaceSuggestion[] = [];
  for (const item of data) {
    const address = item.address ?? {};
    const city = address.city || address.town || address.village || address.municipality || address.county;
    const country = address.country;
    if (!city || !country) continue;
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const key = `${city}|${address.state ?? ''}|${country}|${latitude}|${longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      placeId: Number(item.place_id),
      city,
      state: address.state,
      country,
      latitude,
      longitude,
      displayName: placeDisplayName(city, address.state, country),
    });
  }
  return suggestions;
}

function loadStoredBedTime(): Date {
  const now = new Date();
  now.setHours(22, 0, 0, 0);
  try {
    const stored = localStorage.getItem('suhoor-bedtime');
    if (stored) {
      const [hours, minutes] = stored.split(':').map(Number);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        now.setHours(hours, minutes, 0, 0);
      }
    }
  } catch {
    // Ignore storage errors and use the 10 PM default.
  }
  return now;
}

function calculateSleepCycles(bedTime: Date): SleepCycle[] {
  const cycles: SleepCycle[] = [];
  const cycleLength = 90;
  const fallAsleepBuffer = 15;
  const sleepStartTime = new Date(bedTime.getTime() + fallAsleepBuffer * 60000);

  for (let i = 2; i <= 6; i++) {
    const durationMinutes = i * cycleLength;
    const totalDuration = fallAsleepBuffer + durationMinutes;
    const wakeTime = new Date(sleepStartTime.getTime() + durationMinutes * 60000);
    
    cycles.push({
      cycles: i,
      duration: durationMinutes / 60,
      totalDuration: totalDuration / 60,
      wakeTime,
    });
  }
  
  return cycles;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPrayerTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes);
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatGregorianDate(date: Date): string {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return tomorrow.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bedTime, setBedTime] = useState<Date>(loadStoredBedTime);

  const [location, setLocation] = useState<Location>(loadStoredLocation);
  const [searchQuery, setSearchQuery] = useState(
    () => loadStoredLocation().displayName ?? 'Chicago, USA'
  );
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    type: 'API' | 'LOCATION' | 'GENERAL';
    message: string;
  } | null>(null);

  const [hijriDate, setHijriDate] = useState<HijriDate | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Remember the visitor's choices on this device.
  useEffect(() => {
    try {
      localStorage.setItem('suhoor-location', JSON.stringify(location));
    } catch {
      // Storage is a convenience, not a requirement.
    }
  }, [location]);

  // Smart search: wait 400ms after the user stops typing before
  // calling Nominatim (free, no key, no cost). That keeps us well
  // inside Nominatim's 1-request-per-second policy while the list
  // still narrows with every extra letter typed.
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    // Don't re-search the place the user already picked.
    if (query === (location.displayName ?? placeDisplayName(location.city, location.state, location.country))) {
      searchAbortRef.current?.abort();
      setSuggestions([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        setSuggestions(await searchPlaces(query, controller.signal));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSearchError('Place search is unavailable right now. Please try again.');
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, location]);

  useEffect(() => {
    try {
      const time = `${bedTime.getHours().toString().padStart(2, '0')}:${bedTime.getMinutes().toString().padStart(2, '0')}`;
      localStorage.setItem('suhoor-bedtime', time);
    } catch {
      // Storage is a convenience, not a requirement.
    }
  }, [bedTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchPrayerTimes() {
      setLoading(true);
      setError(null);
      try {
        const timingsUrl = location.latitude !== undefined && location.longitude !== undefined
          ? `https://api.aladhan.com/v1/timings?latitude=${location.latitude}&longitude=${location.longitude}&method=2`
          : `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}&method=2`;
        const response = await fetch(timingsUrl);
        const data = await response.json();
        
        if (data.code === 200 && data.status === 'OK') {
          if (!data.data?.timings?.Fajr) {
            setError({
              type: 'LOCATION',
              message: 'Invalid city/country combination. Please check your location details.'
            });
            return;
          }
          setPrayerTimes({
            Fajr: data.data.timings.Fajr,
            Dhuhr: data.data.timings.Dhuhr,
            Asr: data.data.timings.Asr,
            Maghrib: data.data.timings.Maghrib,
            Isha: data.data.timings.Isha,
            timezone: data.data.meta.timezone,
            method: data.data.meta.method
          });
        } else {
          setError({
            type: 'API',
            message: 'Could not find prayer times for this location. Please verify city and country.'
          });
        }
      } catch (err) {
        setError({
          type: 'GENERAL',
          message: 'Failed to fetch prayer times. Please check your internet connection.'
        });
      } finally {
        setLoading(false);
      }
    }

    fetchPrayerTimes();
  }, [location, retryCount]);

  useEffect(() => {
    async function fetchHijriDate() {
      try {
        const response = await fetch(
          `https://api.aladhan.com/v1/gToH/${getTomorrowDate()}`
        );
        const data = await response.json();
        if (data.code === 200 && data.data) {
          setHijriDate(data.data.hijri);
        }
      } catch (err) {
        console.error('Failed to fetch Hijri date:', err);
      }
    }

    fetchHijriDate();
  }, []);

  const sleepSchedule: SleepSchedule = {
    bedTime,
    sleepCycles: calculateSleepCycles(bedTime),
  };

  const handleBedTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = event.target.value;
    
    if (timeValue) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      const newBedTime = new Date();
      newBedTime.setHours(hours, minutes, 0, 0);
      setBedTime(newBedTime);
    }
  };

  const handlePlaceSelect = (place: PlaceSuggestion) => {
    setLocation({
      city: place.city,
      state: place.state,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      displayName: place.displayName,
    });
    setSearchQuery(place.displayName);
    setSuggestions([]);
    setSearchOpen(false);
  };

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getDate()}-${tomorrow.getMonth() + 1}-${tomorrow.getFullYear()}`;
  };

  const getFajrDateTime = () => {
    if (!prayerTimes?.Fajr) return null;
    
    const [hours, minutes] = prayerTimes.Fajr.split(':').map(Number);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hours, minutes, 0, 0);
    
    return tomorrow;
  };

  const fajrTime = getFajrDateTime();
  const isNearFajr = fajrTime && Math.abs(currentTime.getTime() - fajrTime.getTime()) <= 30 * MILLISECONDS_IN_MINUTE;
  const moonIconPath = moonIcon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071e1b] via-[#0d332a] to-[#14231a] text-[#f5f0e6] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={lanternIcon} alt="Moroccan lantern" className="w-10 h-10" />
            <h1 className="text-4xl font-serif font-bold tracking-wide text-[#d4af37]">Wake Up For Suhoor</h1>
            <img src={lanternIcon} alt="Moroccan lantern" className="w-10 h-10" />
          </div>
          <p className="text-[#d4af37]/90 text-lg mb-2">
            Plan your sleep schedule for a blessed Ramadan
          </p>
          <p className="inline-block px-4 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/40 text-[#d4af37] text-sm font-medium tracking-wide mb-2">
            🪔 Suhoor nights • lantern light before Fajr
          </p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src={datesIcon} alt="Dates for Suhoor" className="h-8 w-auto" />
            <span className="text-[#e9dcc3] text-sm">Dates on the table, night still quiet, Fajr ahead</span>
            <img src={datesIcon} alt="Dates for Suhoor" className="h-8 w-auto -scale-x-100" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[#e9dcc3] text-sm font-medium">
              {hijriDate && `${hijriDate.day} ${hijriDate.month.en} ${hijriDate.year} AH`}
            </p>
            <p className="text-[#d4af37]/80 text-sm">
              {formatGregorianDate(new Date())}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <div className="bg-[#122f28]/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4af37]/40 hover:border-[#d4af37] transition-colors">
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-5 h-5 text-[#d4af37]" />
              <h2 className="text-xl font-semibold text-[#d4af37]">Location Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label htmlFor="place-search" className="block text-sm font-medium text-[#e9dcc3] mb-2">
                  Where are you?
                </label>
                <input
                  type="text"
                  id="place-search"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                  placeholder="Type a city, e.g. Dublin…"
                  autoComplete="off"
                  className="w-full bg-[#071e1b]/70 text-[#f5f0e6] px-4 py-2 rounded-lg border border-[#d4af37]/40 focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none"
                />
                {searchOpen && (searching || suggestions.length > 0 || searchError || searchQuery.trim().length >= 3) && (
                  <div className="absolute z-10 mt-2 w-full rounded-lg border border-[#d4af37]/40 bg-[#0f2a2e] shadow-lg overflow-hidden">
                    {searching && (
                      <p className="px-4 py-3 text-sm text-[#e9dcc3]/80">Searching places…</p>
                    )}
                    {!searching && searchError && (
                      <p className="px-4 py-3 text-sm text-[#e9dcc3]/80">{searchError}</p>
                    )}
                    {!searching && !searchError && suggestions.length === 0 && searchQuery.trim().length >= 3 && (
                      <p className="px-4 py-3 text-sm text-[#e9dcc3]/80">
                        No places found. Try a larger nearby city.
                      </p>
                    )}
                    {!searching && suggestions.map((place) => (
                      <button
                        key={place.placeId}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handlePlaceSelect(place)}
                        className="block w-full text-left px-4 py-3 hover:bg-[#122f28] transition-colors"
                      >
                        <span className="block text-sm font-medium text-[#f5f0e6]">{place.city}</span>
                        <span className="block text-xs text-[#e9dcc3]/70">
                          {[place.state, place.country].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-[#e9dcc3]">
                Showing times for: <span className="font-medium text-[#f5f0e6]">{location.displayName ?? placeDisplayName(location.city, location.state, location.country)}</span>
              </p>
              <p className="text-xs text-[#d4af37]/80">
                Pick a place from the list to update times. Saved on this device, so you only enter it once.
                Place search is free, by Nominatim / © OpenStreetMap contributors.
              </p>
            </div>
          </div>

          <div className="bg-[#122f28]/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4af37]/40 hover:border-[#d4af37] transition-colors">
            <h2 className="text-xl font-semibold mb-6 text-[#d4af37]">Prayer Times</h2>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200">
                <div className="flex items-start gap-2">
                  <div className="text-rose-500 mt-0.5">⚠️</div>
                  <div>
                    <p className="text-rose-700 font-medium mb-1">Location Error</p>
                    <p className="text-rose-600 text-sm">{error.message}</p>
                    {error.type === 'LOCATION' && (
                      <ul className="mt-2 text-sm text-rose-600 list-disc list-inside">
                        <li>Make sure the city name is spelled correctly</li>
                        <li>Verify that the city exists in the specified country</li>
                        <li>Try using a major city nearby</li>
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => setRetryCount((count) => count + 1)}
                      className="mt-3 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            ) : prayerTimes ? (
              <div className="space-y-4">
                <div className="text-sm text-[#e9dcc3]/60 mb-4">
                  <p>Calculation Method: {prayerTimes.method.name}</p>
                  <p>Timezone: {prayerTimes.timezone}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(prayerTimes)
                    .filter(([key]) => ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(key))
                    .map(([prayer, time]) => {
                      const isPrayerFajr = prayer === 'Fajr';
                      const shouldHighlight = isPrayerFajr && isNearFajr;
                      const formattedTime = formatPrayerTime(time);
                      const displayTime = isPrayerFajr ? `${formattedTime} (Tomorrow)` : formattedTime;
                      
                      return (
                        <div
                          key={prayer}
                          className={`bg-[#071e1b]/70 p-3 rounded-lg ${
                            shouldHighlight ? 'ring-2 ring-red-500' : ''
                          }`}
                        >
                          <div className="text-sm text-[#e9dcc3]/60">{prayer}</div>
                          <div className={`text-lg font-semibold ${
                            shouldHighlight ? 'text-red-400' : ''
                          }`}>
                            {displayTime}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-[#122f28]/70 backdrop-blur-sm rounded-xl p-6 shadow-lg mb-8 border border-[#d4af37]/40 hover:border-[#d4af37] transition-colors">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="bedTime" className="block text-sm font-medium text-[#e9dcc3] mb-2">
                I plan to go to bed at:
                <span className="ml-2 text-[#d4af37] text-xs font-normal">
                  (includes 15-minute buffer to fall asleep)
                </span>
              </label>
              <input
                type="time"
                id="bedTime"
                value={`${bedTime.getHours().toString().padStart(2, '0')}:${bedTime.getMinutes().toString().padStart(2, '0')}`}
                onChange={handleBedTimeChange}
                className="w-full bg-[#071e1b]/70 text-[#f5f0e6] px-4 py-2 rounded-lg border border-[#d4af37]/40 focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none"
              />
              <p className="mt-2 text-sm text-[#d4af37]">
                Actual sleep start: {formatTime(new Date(bedTime.getTime() + 15 * 60000))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#122f28]/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4af37]/40 hover:border-[#d4af37]">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-5 h-5 text-[#d4af37]" />
              <h2 className="text-xl font-semibold text-[#d4af37]">Recommended Wake-up Times</h2>
            </div>
            {fajrTime && (
              <div className="mt-2 p-3 bg-[#071e1b]/70 rounded-lg border border-[#d4af37]/40">
                <div className="flex items-center justify-center gap-2">
                  <img src={moonIconPath} alt="Moon" className="w-4 h-4 text-[#d4af37]" />
                  <span className="text-[#d4af37] font-medium">
                    Tomorrow's Fajr: {prayerTimes?.Fajr ? formatPrayerTime(prayerTimes.Fajr) : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mb-6 p-4 bg-[#071e1b]/60 rounded-lg border border-[#d4af37]/40">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-teal-500"></div>
                <span className="text-sm font-medium text-[#e9dcc3]">✨ Perfect for Suhoor</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-yellow-600"></div>
                <span className="text-sm font-medium text-[#e9dcc3]">⚡️ Limited Time</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm font-medium text-[#e9dcc3]">😴 Missed Suhoor</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {sleepSchedule.sleepCycles.map((cycle) => {
              const timeToFajr = fajrTime ? fajrTime.getTime() - cycle.wakeTime.getTime() : 0;
              const minutesToFajr = Math.floor(timeToFajr / MILLISECONDS_IN_MINUTE);
              
              // Match the copy on the page: green means 20-90 minutes
              // before Fajr. The old check also required being within
              // 30 minutes of 45, which quietly shrank the green
              // window to about 20-75 minutes.
              const isRecommendedForFajr = fajrTime &&
                minutesToFajr >= 20 && minutesToFajr <= 90;
              
              const isWarningTime = fajrTime && 
                timeToFajr > 0 && 
                timeToFajr <= 20 * MILLISECONDS_IN_MINUTE;
                
              const isLateWakeup = fajrTime && 
                cycle.wakeTime.getTime() >= fajrTime.getTime();

              return (
                <div 
                  key={cycle.cycles}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    isRecommendedForFajr
                      ? 'bg-teal-50/90 border-teal-300 scale-105 shadow-md transform hover:scale-110'
                      : isWarningTime
                      ? 'bg-yellow-100/95 border-yellow-500'
                      : isLateWakeup
                      ? 'bg-red-50/90 border-red-300 scale-100 hover:scale-95 opacity-80 hover:opacity-70'
                      : 'bg-[#122f28]/70 border-[#d4af37]/40'
                  }`}
                >
                  <div className="text-center space-y-2">
                    <p className={`text-2xl font-bold ${
                      isLateWakeup 
                        ? 'text-red-700' 
                        : isWarningTime
                        ? 'text-yellow-900'
                        : isRecommendedForFajr 
                        ? 'text-teal-700' 
                        : 'text-[#e9dcc3]'
                    }`}>
                      {formatTime(cycle.wakeTime)}
                    </p>
                    <p className={`text-sm font-medium ${
                      isLateWakeup 
                        ? 'text-red-600' 
                        : isWarningTime
                        ? 'text-yellow-700'
                        : isRecommendedForFajr 
                        ? 'text-teal-600' 
                        : 'text-[#d4af37]'
                    }`}>
                      {cycle.cycles} cycles ({cycle.totalDuration.toFixed(1)} hours total)
                    </p>
                    {fajrTime && (
                      <p className="text-xs text-[#e9dcc3]/60">
                        {minutesToFajr > 0
                          ? `${minutesToFajr} min before Fajr`
                          : minutesToFajr === 0
                            ? 'At Fajr'
                            : `${-minutesToFajr} min after Fajr`}
                      </p>
                    )}
                    {isRecommendedForFajr && (
                      <span className="inline-block mt-2 px-4 py-1.5 bg-teal-100/90 text-teal-800 text-xs font-medium rounded-full border border-teal-300 shadow-sm shadow-teal-200/50 ring-1 ring-teal-400/30">
                        ✨ Recommended for Fajr
                      </span>
                    )}
                    {isWarningTime && (
                      <span className="inline-block mt-2 px-3 py-1 bg-yellow-100/95 text-yellow-900 text-xs font-medium rounded-full border border-yellow-500 shadow-sm shadow-yellow-200/50 ring-1 ring-yellow-400/30">
                        ⚡️ Hurry up for Suhoor!
                      </span>
                    )}
                    {isLateWakeup && (
                      <span className="inline-block mt-2 px-3 py-1 bg-red-100/90 text-red-800 text-xs font-medium rounded-full border border-red-300 shadow-sm shadow-red-200/50 ring-1 ring-red-400/30 opacity-90">
                        😴 Too late for Suhoor
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="bg-[#071e1b]/70 backdrop-blur-sm rounded-lg p-4 text-sm text-[#e9dcc3]/80 border border-[#d4af37]/40">
            <div className="flex items-start gap-2">
              <img src={moonIconPath} alt="Moon" className="w-4 h-4 text-[#d4af37] mt-0.5" />
              <p>
                Includes 15-minute buffer to account for time to fall asleep. 
                Each sleep cycle is 90 minutes. Green times give you 20-90 minutes 
                before Fajr, perfect for Suhoor.
              </p>
            </div>
          </div>

          <div className="bg-[#071e1b]/70 backdrop-blur-sm rounded-lg p-4 border border-[#d4af37]/40">
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-shrink-0">
                <Clock className="w-4 h-4 text-[#d4af37] mt-1" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#d4af37]">About Sleep Cycles</h3>
                <p className="text-sm text-[#e9dcc3]/80">
                  Sleep cycles typically last 90-120 minutes, with each cycle consisting of different stages of sleep. 
                  Waking up at the end of a cycle helps you feel more refreshed.
                </p>
                <div className="pt-2 space-y-1">
                  <p className="text-xs text-[#e9dcc3]/60">Academic Reference:</p>
                  <ul className="text-xs text-[#e9dcc3] space-y-1">
                    <li>
                      <a href="https://www.sleepfoundation.org/stages-of-sleep" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="hover:text-[#d4af37] underline">
                        "Stages of Sleep" - National Sleep Foundation
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;