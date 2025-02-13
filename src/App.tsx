import { useState, useEffect } from 'react';
import { Clock, MapPin, Loader2 } from 'lucide-react';

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
    city: 'London',
    country: 'UK'
  });

  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          `https://api.aladhan.com/v1/timingsByCity?city=${location.city}&country=${location.country}&method=2` // Method 2 is ISNA
        );
        const data = await response.json();
        
        if (data.code === 200 && data.status === 'OK') {
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
          setError('Failed to fetch prayer times');
        }
      } catch (err) {
        setError('Failed to fetch prayer times');
      } finally {
        setLoading(false);
      }
    }

    fetchPrayerTimes();
  }, [location]);

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

  const fajrTime = prayerTimes ? new Date(`${new Date().toDateString()} ${prayerTimes.Fajr}`) : null;
  const isNearFajr = fajrTime && Math.abs(currentTime.getTime() - fajrTime.getTime()) <= 30 * 60 * 1000;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Clock className="w-8 h-8 text-indigo-400" />
          <h1 className="text-3xl font-bold">Sleep Cycle Calculator</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-semibold">Location Settings</h2>
            </div>
            <form onSubmit={handleLocationSubmit} className="space-y-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-300 mb-2">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  defaultValue={location.city}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-300 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  defaultValue={location.country}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Update Location
              </button>
            </form>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-6">Prayer Times</h2>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              </div>
            ) : error ? (
              <div className="text-red-400 text-center">{error}</div>
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
                      
                      return (
                        <div
                          key={prayer}
                          className={`bg-gray-700 bg-opacity-50 p-3 rounded-lg ${
                            shouldHighlight ? 'ring-2 ring-red-500' : ''
                          }`}
                        >
                          <div className="text-sm text-gray-400">{prayer}</div>
                          <div className={`text-lg font-semibold ${
                            shouldHighlight ? 'text-red-400' : ''
                          }`}>
                            {time}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow-xl mb-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="bedTime" className="block text-sm font-medium text-gray-300 mb-2">
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
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-6">You should wake up at one of these times:</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {sleepSchedule.sleepCycles.map((cycle) => {
              const isLateWakeup = fajrTime && cycle.wakeTime.getTime() > fajrTime.getTime();
              const isRecommendedForFajr = fajrTime && 
                Math.abs(cycle.wakeTime.getTime() - fajrTime.getTime()) < 30 * 60000;
              
              return (
                <div 
                  key={cycle.cycles}
                  className={`p-4 rounded-lg ${
                    isRecommendedForFajr
                      ? 'bg-green-500 bg-opacity-20 border border-green-400'
                      : isLateWakeup
                      ? 'bg-red-500 bg-opacity-20 border border-red-400'
                      : 'bg-gray-700 bg-opacity-50'
                  }`}
                >
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${
                      isLateWakeup ? 'text-red-300' : 'text-indigo-300'
                    }`}>
                      {formatTime(cycle.wakeTime)}
                    </p>
                    <p className={`text-sm ${
                      isLateWakeup ? 'text-red-200' : 'text-indigo-200'
                    }`}>
                      {cycle.cycles} cycles ({cycle.duration} hours)
                    </p>
                    {isRecommendedForFajr && (
                      <span className="inline-block mt-2 px-2 py-1 bg-green-500 bg-opacity-20 text-green-300 text-xs rounded-full">
                        Recommended for Fajr
                      </span>
                    )}
                    {isLateWakeup && (
                      <span className="inline-block mt-2 px-2 py-1 bg-red-500 bg-opacity-20 text-red-300 text-xs rounded-full">
                        Too late for Suhoor
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;