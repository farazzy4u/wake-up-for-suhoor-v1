import { useState, useEffect } from 'react';
import { Clock, MapPin, Loader2, Moon, Star } from 'lucide-react';

interface SleepCycle {
  cycles: number;
  duration: number;
  wakeTime: Date;
}

interface SleepSchedule {
  bedTime: Date;
  wakeUpTime: Date;
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
  month: string;
  year: string;
  format: string;
}

const MILLISECONDS_IN_MINUTE = 60000;

function calculateSleepCycles(bedTime: Date, wakeUpTime: Date): SleepCycle[] {
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

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bedTime, setBedTime] = useState<Date>(() => {
    const now = new Date();
    now.setHours(22, 0, 0, 0);
    return now;
  });

  const [wakeUpTime] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(5, 0, 0, 0);
    return tomorrow;
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
        const response = await fetch(
          'https://api.aladhan.com/v1/gToH?date=' + getTomorrowDate()
        );
        const data = await response.json();
        if (data.code === 200) {
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
    wakeUpTime,
    sleepCycles: calculateSleepCycles(bedTime, wakeUpTime),
  };

  const handleBedTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = event.target.value.split(':').map(Number);
    const newBedTime = new Date(bedTime);
    newBedTime.setHours(hours, minutes, 0, 0);
    setBedTime(newBedTime);
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setLocation({
      city: formData.get('city') as string,
      country: formData.get('country') as string
    });
  };

  // Create a date for tomorrow
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toDateString();
  };

  // Update the fajrTime calculation to use tomorrow's date
  const fajrTime = prayerTimes ? new Date(`${getTomorrowDate()} ${prayerTimes.Fajr}`) : null;
  const isNearFajr = fajrTime && Math.abs(currentTime.getTime() - fajrTime.getTime()) <= 30 * MILLISECONDS_IN_MINUTE;

  console.log('Tomorrow\'s date:', getTomorrowDate());
  console.log('Fajr time:', fajrTime);
  console.log('Current time:', currentTime);
  console.log('Is near Fajr:', isNearFajr);
  console.log('Time until Fajr (minutes):', 
    fajrTime ? Math.floor((fajrTime.getTime() - currentTime.getTime()) / MILLISECONDS_IN_MINUTE) : 'N/A'
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/80 to-amber-100/70 text-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Moon className="w-8 h-8 text-amber-600" />
            <h1 className="text-3xl font-bold text-amber-800">Wake Up For Suhoor</h1>
            <Moon className="w-8 h-8 text-amber-600" />
          </div>
          <p className="text-amber-700/80 text-lg mb-2">
            Plan your sleep schedule for a blessed Ramadan
          </p>
          {hijriDate && (
            <p className="text-amber-600/90 text-sm font-medium">
              {hijriDate.day} {hijriDate.month} {hijriDate.year} AH
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-amber-200">
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
                  className="w-full bg-white/80 text-slate-800 px-4 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                  className="w-full bg-white/80 text-slate-800 px-4 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
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

          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-amber-200">
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

        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg mb-8 border border-amber-200">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="bedTime" className="block text-sm font-medium text-amber-700 mb-2">
                I plan to go to bed at:
              </label>
              <input
                type="time"
                id="bedTime"
                value={`${bedTime.getHours().toString().padStart(2, '0')}:${bedTime
                  .getMinutes()
                  .toString()
                  .padStart(2, '0')}`}
                onChange={handleBedTimeChange}
                className="w-full bg-white/80 text-slate-800 px-4 py-2 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-amber-200">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-5 h-5 text-amber-600" />
              <h2 className="text-xl font-semibold text-amber-800">Recommended Wake-up Times</h2>
            </div>
            {fajrTime && (
              <div className="mt-2 p-3 bg-amber-50/80 rounded-lg border border-amber-200">
                <div className="flex items-center justify-center gap-2">
                  <Moon className="w-4 h-4 text-amber-600" />
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
                <span className="text-sm font-medium text-slate-700">Perfect for Suhoor</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                <span className="text-sm font-medium text-slate-700">Limited Time</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-rose-500"></div>
                <span className="text-sm font-medium text-slate-700">Missed Suhoor</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {sleepSchedule.sleepCycles.map((cycle) => {
              const timeToFajr = fajrTime ? fajrTime.getTime() - cycle.wakeTime.getTime() : 0;
              const minutesToFajr = Math.floor(timeToFajr / MILLISECONDS_IN_MINUTE);
              
              console.log(`Wake time: ${formatTime(cycle.wakeTime)}, Minutes to Fajr: ${minutesToFajr}`);
              
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
                  className={`p-4 rounded-lg border ${
                    isRecommendedForFajr
                      ? 'bg-teal-100/40 border-teal-300 shadow-sm'
                      : isWarningTime
                      ? 'bg-amber-100/40 border-amber-300 shadow-sm'
                      : isLateWakeup
                      ? 'bg-rose-100/40 border-rose-300 shadow-sm'
                      : 'bg-slate-100/40 border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="text-center space-y-2">
                    <p className={`text-2xl font-bold ${
                      isLateWakeup 
                        ? 'text-rose-700' 
                        : isWarningTime
                        ? 'text-amber-700'
                        : isRecommendedForFajr 
                        ? 'text-teal-700' 
                        : 'text-slate-700'
                    }`}>
                      {formatTime(cycle.wakeTime)}
                    </p>
                    <p className={`text-sm font-medium ${
                      isLateWakeup 
                        ? 'text-rose-600' 
                        : isWarningTime
                        ? 'text-amber-600'
                        : isRecommendedForFajr 
                        ? 'text-teal-600' 
                        : 'text-slate-600'
                    }`}>
                      {cycle.cycles} cycles ({cycle.duration} hours)
                    </p>
                    {isRecommendedForFajr && (
                      <span className="inline-block mt-2 px-3 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full border border-teal-200">
                        Recommended for Fajr
                      </span>
                    )}
                    {isWarningTime && (
                      <span className="inline-block mt-2 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                        Hurry up for Suhoor!
                      </span>
                    )}
                    {isLateWakeup && (
                      <span className="inline-block mt-2 px-3 py-1 bg-rose-100 text-rose-700 text-xs font-medium rounded-full border border-rose-200">
                        Too late for Suhoor
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
              <Moon className="w-4 h-4 text-amber-600 mt-0.5" />
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
                  <p className="text-xs text-slate-500">Academic References:</p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    <li>
                      <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2279166/" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="hover:text-amber-600 underline">
                        "The Nature of Sleep" - National Institute of Health
                      </a>
                    </li>
                    <li>
                      <a href="https://www.sleepfoundation.org/stages-of-sleep" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="hover:text-amber-600 underline">
                        "Stages of Sleep" - National Sleep Foundation
                      </a>
                    </li>
                    <li>
                      <a href="https://pubmed.ncbi.nlm.nih.gov/26564128/" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="hover:text-amber-600 underline">
                        "Sleep Cycles and the Sleep-Wake Cycle" - PubMed Central
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
