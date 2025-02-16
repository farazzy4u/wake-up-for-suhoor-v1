import { useState, useEffect } from 'react';
import { Clock, MapPin, Loader2, Star } from 'lucide-react';
import moonIcon from '@assets/moon.svg';

interface SleepCycle {
  cycles: number;
  duration: number;
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

function calculateSleepCycles(bedTime: Date): SleepCycle[] {
  const cycles: SleepCycle[] = [];
  const cycleLength = 90; // minutes
  
  for (let i = 2; i <= 6; i++) {
    const durationMinutes = i * cycleLength;
    const wakeTime = new Date(bedTime.getTime() + durationMinutes * 60000);
    
    cycles.push({
      cycles: i,
      duration: durationMinutes / 60,
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
  // Convert 24-hour format to AM/PM
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes);
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Update the formatGregorianDate function to handle tomorrow's date properly
function formatGregorianDate(date: Date): string {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1); // Ensure we're showing tomorrow
  
  return tomorrow.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bedTime, setBedTime] = useState<Date>(() => {
    const now = new Date();
    now.setHours(22, 0, 0, 0);
    return now;
  });

  const [location, setLocation] = useState<Location>({
    city: 'Chicago',
    country: 'USA'
  });

  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    type: 'API' | 'LOCATION' | 'GENERAL';
    message: string;
  } | null>(null);

  const [hijriDate, setHijriDate] = useState<HijriDate | null>(null);

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
        const response = await fetch(
          `https://api.aladhan.com/v1/timingsByCity?city=${location.city}&country=${location.country}&method=2`
        );
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
  }, [location]);

  useEffect(() => {
    async function fetchHijriDate() {
      try {
        console.log('Fetching Hijri date for:', getTomorrowDate()); // Debug log
        const response = await fetch(
          `https://api.aladhan.com/v1/gToH/${getTomorrowDate()}`
        );
        const data = await response.json();
        console.log('Hijri API response:', data); // Debug log
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
    
    // Only update if we have a valid time value
    if (timeValue) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      const newBedTime = new Date();
      
      // If the time is before current time, assume it's for today
      // If it's after current time, keep it for today
      newBedTime.setHours(hours, minutes, 0, 0);
      
      // Update the state
      setBedTime(newBedTime);
    }
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setLocation({
      city: formData.get('city') as string,
      country: formData.get('country') as string
    });
  };

  // Update the getTomorrowDate function to return the correct format for the API
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Format date as DD-MM-YYYY for the Aladhan API
    return `${tomorrow.getDate()}-${tomorrow.getMonth() + 1}-${tomorrow.getFullYear()}`;
  };

  // Update the fajrTime calculation
  const getFajrDateTime = () => {
    if (!prayerTimes?.Fajr) return null;
    
    const [hours, minutes] = prayerTimes.Fajr.split(':').map(Number);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hours, minutes, 0, 0);
    
    console.log('Constructed Fajr time:', tomorrow); // Debug log
    return tomorrow;
  };

  // Update where we use fajrTime
  const fajrTime = getFajrDateTime();
  const isNearFajr = fajrTime && Math.abs(currentTime.getTime() - fajrTime.getTime()) <= 30 * MILLISECONDS_IN_MINUTE;

  console.log('Tomorrow\'s date:', getTomorrowDate());
  console.log('Fajr time:', fajrTime);
  console.log('Current time:', currentTime);
  console.log('Is near Fajr:', isNearFajr);
  console.log('Time until Fajr (minutes):', 
    fajrTime ? Math.floor((fajrTime.getTime() - currentTime.getTime()) / MILLISECONDS_IN_MINUTE) : 'N/A'
  );

  const moonIconPath = moonIcon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-yellow-50/90 to-orange-50/80 text-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={moonIconPath} alt="Moon" className="w-8 h-8 text-amber-600" />
            <h1 className="text-3xl font-bold text-amber-800">Wake Up For Suhoor</h1>
            <img src={moonIconPath} alt="Moon" className="w-8 h-8 text-amber-600" />
          </div>
          <p className="text-amber-800/90 text-lg mb-2">
            Plan your sleep schedule for a blessed Ramadan
          </p>
          {/* Updated date display */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-amber-700 text-sm font-medium">
              {hijriDate && `${hijriDate.day} ${hijriDate.month.en} ${hijriDate.year} AH`}
            </p>
            <p className="text-amber-600/80 text-sm">
              {formatGregorianDate(new Date())}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <div className="bg-white/40 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-amber-200 hover:border-amber-300 transition-colors">
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-5 h-5 text-amber-600" />
              <h2 className="text-xl font-semibold text-amber-800">Location Settings</h2>
            </div>
            <form onSubmit={handleLocationSubmit} className="space-y-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-amber-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  defaultValue={location.city}
                  className="w-full bg-white/60 text-slate-800 px-4 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-amber-700 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  defaultValue={location.country}
                  className="w-full bg-white/60 text-slate-800 px-4 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Update Location
              </button>
            </form>
          </div>

          <div className="bg-white/40 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-amber-200 hover:border-amber-300 transition-colors">
            <h2 className="text-xl font-semibold mb-6 text-amber-800">Prayer Times</h2>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
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
                  </div>
                </div>
              </div>
            ) : prayerTimes ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-400 mb-4">
                  <p>Calculation Method: {prayerTimes.method.name}</p>
                  <p>Timezone: {prayerTimes.timezone}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(prayerTimes)
                    .filter(([key]) => ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(key))
                    .map(([prayer, time]) => {
                      const isPrayerFajr = prayer === 'Fajr';
                      const shouldHighlight = isPrayerFajr && isNearFajr;
                      
                      // Format the time and add tomorrow label for Fajr
                      const formattedTime = formatPrayerTime(time);
                      const displayTime = isPrayerFajr ? `${formattedTime} (Tomorrow)` : formattedTime;
                      
                      return (
                        <div
                          key={prayer}
                          className={`bg-amber-50/80 p-3 rounded-lg ${
                            shouldHighlight ? 'ring-2 ring-red-500' : ''
                          }`}
                        >
                          <div className="text-sm text-gray-400">{prayer}</div>
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

        <div className="bg-white/40 backdrop-blur-sm rounded-xl p-6 shadow-lg mb-8 border border-amber-200 hover:border-amber-300 transition-colors">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="bedTime" className="block text-sm font-medium text-amber-700 mb-2">
                I plan to go to bed at:
              </label>
              <input
                type="time"
                id="bedTime"
                value={`${bedTime.getHours().toString().padStart(2, '0')}:${bedTime.getMinutes().toString().padStart(2, '0')}`}
                onChange={handleBedTimeChange}
                className="w-full bg-white/60 text-slate-800 px-4 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-amber-200 hover:border-amber-300">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-5 h-5 text-amber-600" />
              <h2 className="text-xl font-semibold text-amber-800">Recommended Wake-up Times</h2>
            </div>
            {fajrTime && (
              <div className="mt-2 p-3 bg-amber-50/80 rounded-lg border border-amber-200">
                <div className="flex items-center justify-center gap-2">
                  <img src={moonIconPath} alt="Moon" className="w-4 h-4 text-amber-600" />
                  <span className="text-amber-800 font-medium">
                    Tomorrow's Fajr: {prayerTimes?.Fajr ? formatPrayerTime(prayerTimes.Fajr) : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mb-6 p-4 bg-slate-100/40 rounded-lg border border-slate-300">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-teal-500"></div>
                <span className="text-sm font-medium text-slate-700">✨ Perfect for Suhoor</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-yellow-600"></div>
                <span className="text-sm font-medium text-slate-700">⚡️ Limited Time</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm font-medium text-slate-700">😴 Missed Suhoor</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {sleepSchedule.sleepCycles.map((cycle) => {
              const timeToFajr = fajrTime ? fajrTime.getTime() - cycle.wakeTime.getTime() : 0;
              const minutesToFajr = Math.floor(timeToFajr / MILLISECONDS_IN_MINUTE);
              
              console.log(`Wake time: ${formatTime(cycle.wakeTime)}`);
              console.log(`Fajr time: ${fajrTime ? formatTime(fajrTime) : 'Not set'}`);
              console.log(`Minutes to Fajr: ${minutesToFajr}`);
              
              // Updated more flexible logic
              const isRecommendedForFajr = fajrTime && 
                // Find the cycle that wakes you up between 20-90 minutes before Fajr
                (minutesToFajr >= 20 && minutesToFajr <= 90) &&
                // Prefer cycles closer to 45 minutes before Fajr
                (Math.abs(minutesToFajr - 45) < 30);
              
              const isWarningTime = fajrTime && 
                timeToFajr > 0 && 
                timeToFajr <= 20 * MILLISECONDS_IN_MINUTE;
                
              const isLateWakeup = fajrTime && 
                cycle.wakeTime.getTime() >= fajrTime.getTime();

              console.log(`Cycle ${cycle.cycles}: isRecommended=${isRecommendedForFajr}, minutesToFajr=${minutesToFajr}`);
              
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
                      : 'bg-amber-50/70 border-amber-200'
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
                        : 'text-amber-700'
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
                        : 'text-amber-600'
                    }`}>
                      {cycle.cycles} cycles ({cycle.duration} hours)
                    </p>
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
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-sm text-slate-600 border border-amber-200">
            <div className="flex items-start gap-2">
              <img src={moonIconPath} alt="Moon" className="w-4 h-4 text-amber-600 mt-0.5" />
              <p>Each sleep cycle is 90 minutes. Green times give you 20-90 minutes before Fajr, perfect for Suhoor.</p>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-amber-200">
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600 mt-1" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-amber-800">About Sleep Cycles</h3>
                <p className="text-sm text-slate-600">
                  Sleep cycles typically last 90-120 minutes, with each cycle consisting of different stages of sleep. 
                  Waking up at the end of a cycle helps you feel more refreshed.
                </p>
                <div className="pt-2 space-y-1">
                  <p className="text-xs text-slate-500">Academic Reference:</p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    <li>
                      <a href="https://www.sleepfoundation.org/stages-of-sleep" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="hover:text-amber-600 underline">
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
