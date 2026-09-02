import React, { useEffect } from 'react';
import { useApp } from '../AppContext';
import { ArrowRight, MapPin, Clock3, Sparkles } from 'lucide-react';

export const GeneratedRestaurantLanding = ({ onManageBusiness }: { onManageBusiness: () => void }) => {
  const { businessSettings, landingPageConfig, products, formatPrice, ensureLandingForDemo, isDemoMode } = useApp();

  useEffect(() => {
    if (!landingPageConfig && (isDemoMode || businessSettings?.id === 'ydplace')) {
      ensureLandingForDemo();
    }
  }, [landingPageConfig, isDemoMode, businessSettings?.id, ensureLandingForDemo]);

  if (!landingPageConfig) {
    return (
      <div className="min-h-screen bg-bakery-cream text-bakery-brown flex items-center justify-center p-6">
        <div className="max-w-xl text-center">
          <h1 className="text-4xl font-black font-serif mb-4">{businessSettings?.name || 'Restaurant'} Public Site</h1>
          <p className="text-bakery-brown/60 mb-8">
            {isDemoMode || businessSettings?.id === 'ydplace'
              ? 'Preparing your public storefront…'
              : 'Your public site is not generated yet. Open Settings as the owner to create it.'}
          </p>
          <button onClick={onManageBusiness} className="px-6 py-3 rounded-2xl bg-bakery-brown text-white font-black inline-flex items-center gap-2">
            Back to dashboard
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const theme =
    landingPageConfig.colorTheme === 'Elegant Dark'
      ? {
          page: 'bg-[#0f1116] text-[#efeae2]',
          panel: 'bg-white/[0.04] border-white/10',
          accent: 'text-[#32a7ff]',
          button: 'bg-[#1493ff] text-[#071321]',
          overlay: 'from-[#0f1116]/30 via-[#0f1116]/65 to-[#0f1116]'
        }
      : landingPageConfig.colorTheme === 'Vibrant Street'
        ? {
            page: 'bg-[#f2ece1] text-[#251f1b]',
            panel: 'bg-white/70 border-[#e9dcc5]',
            accent: 'text-[#0f8cf0]',
            button: 'bg-[#1493ff] text-[#071321]',
            overlay: 'from-black/10 via-black/30 to-black/70'
          }
        : {
            page: 'bg-[#fcfaf5] text-[#2a241f]',
            panel: 'bg-white/85 border-[#eadfcb]',
            accent: 'text-[#0f8cf0]',
            button: 'bg-bakery-brown text-white',
            overlay: 'from-black/5 via-black/20 to-black/60'
          };

  const hero = landingPageConfig.galleryImages[0];
  const gallery = landingPageConfig.galleryImages.slice(1);
  const section2Image = gallery.length > 0 ? gallery[0] : hero;
  const section3Image = gallery.length > 1 ? gallery[1] : hero;
  const paragraphs = landingPageConfig.refinedStory.split('\n').map(p => p.trim()).filter(Boolean);
  const storyPart1 = paragraphs.slice(0, Math.max(1, Math.ceil(paragraphs.length / 2)));
  const storyPart2 = paragraphs.slice(Math.max(1, Math.ceil(paragraphs.length / 2)));
  const heroLineRaw = paragraphs[0] || `${businessSettings?.name || 'Restaurant'} crafted with passion.`;
  const heroLine = heroLineRaw.length > 110 ? `${heroLineRaw.slice(0, 107)}...` : heroLineRaw;
  const featuredMenu = products.filter(p => p.active).slice(0, 6);
  
  let parsedHours: { day: string; time: string }[] = [];
  try {
    const parsed = JSON.parse(landingPageConfig.openingHours);
    if (Array.isArray(parsed)) {
      parsedHours = parsed.map((item: any) => ({
        day: item.day,
        time: item.closed ? 'Closed' : `${item.open} - ${item.close}`
      }));
    }
  } catch {
    parsedHours = landingPageConfig.openingHours
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map((line: string) => {
        if (line.includes(':')) {
          const idx = line.indexOf(':');
          return { day: line.slice(0, idx).trim(), time: line.slice(idx + 1).trim() };
        }
        return { day: 'Hours', time: line };
      });
  }

  return (
    <div className={`min-h-screen ${theme.page}`}>
      <button
        onClick={onManageBusiness}
        className="fixed top-6 right-6 z-40 px-5 py-3 rounded-2xl bg-bakery-brown text-white font-bold shadow-lg inline-flex items-center gap-2"
      >
        Manage Business
        <ArrowRight size={16} />
      </button>

      <main>
        <section className="relative min-h-[76vh] overflow-hidden">
          {hero && <img src={hero} alt="Restaurant hero" className="absolute inset-0 w-full h-full object-cover" />}
          <div className={`absolute inset-0 bg-gradient-to-b ${theme.overlay}`} />
          <div className="relative max-w-6xl mx-auto px-6 py-24 min-h-[76vh] flex items-end">
            <div className="max-w-2xl rounded-3xl bg-black/45 backdrop-blur-md border border-white/20 p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/35 bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-widest mb-5 text-white">
                <Sparkles size={14} />
                {landingPageConfig.cuisineType}
              </div>
              <h1 className="text-5xl sm:text-7xl font-black font-serif mb-4 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">{businessSettings?.name || 'Restaurant'}</h1>
              <p className="text-xl sm:text-2xl text-white/95 leading-relaxed drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
                {heroLine}
              </p>
              {landingPageConfig.logoImage && (
                <img src={landingPageConfig.logoImage} alt="Logo" className="mt-7 w-20 h-20 rounded-2xl object-cover border border-white/25 bg-white/10" />
              )}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="rounded-[2.5rem] overflow-hidden h-[400px] lg:h-[600px] shadow-2xl">
              <img src={section2Image} className="w-full h-full object-cover" alt="Our food" />
            </div>
            <div className="space-y-6 lg:px-8">
              <h2 className={`text-4xl sm:text-5xl font-black font-serif ${theme.accent}`}>Our Story</h2>
              <div className="space-y-5">
                {storyPart1.map((p, i) => (
                  <p key={i} className="text-lg leading-relaxed opacity-90">{p}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        {storyPart2.length > 0 && (
          <section className="py-24 px-6 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="order-2 lg:order-1 space-y-6 lg:px-8">
                <h2 className={`text-4xl sm:text-5xl font-black font-serif ${theme.accent}`}>The Experience</h2>
                <div className="space-y-5">
                  {storyPart2.map((p, i) => (
                    <p key={i} className="text-lg leading-relaxed opacity-90">{p}</p>
                  ))}
                </div>
              </div>
              <div className="order-1 lg:order-2 rounded-[2.5rem] overflow-hidden h-[400px] lg:h-[600px] shadow-2xl">
                <img src={section3Image} className="w-full h-full object-cover" alt="Ambiance" />
              </div>
            </div>
          </section>
        )}

        {featuredMenu.length > 0 && (
          <section className="py-24 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className={`text-4xl sm:text-5xl font-black font-serif ${theme.accent}`}>Featured Menu</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredMenu.map(item => (
                <div key={item.id} className={`rounded-[2rem] p-8 border transition-transform hover:-translate-y-2 shadow-xl ${theme.panel}`}>
                  <div className="text-6xl mb-6">{item.emoji}</div>
                  <h3 className="text-2xl font-bold mb-2">{item.nameEN}</h3>
                  <p className="opacity-70 text-sm mb-6 uppercase tracking-widest font-bold">{item.category}</p>
                  <p className={`text-3xl font-black ${theme.accent}`}>{formatPrice(item.price)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className={`rounded-[3rem] border p-8 sm:p-12 lg:p-20 shadow-2xl ${theme.panel}`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div>
                <h2 className={`text-4xl sm:text-5xl font-black font-serif mb-8 ${theme.accent}`}>Visit Us</h2>
                <div className="space-y-8">
                  <div className="flex items-start gap-4">
                    <MapPin size={28} className={theme.accent} />
                    <p className="text-xl font-medium opacity-90 leading-relaxed">{landingPageConfig.address?.trim() || 'Address available on request'}</p>
                  </div>
                  <div className="rounded-3xl h-64 border border-white/20 bg-gradient-to-br from-black/10 to-black/30 flex items-center justify-center font-bold opacity-80 overflow-hidden relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                    <span className="relative z-10 text-lg">Map Placeholder</span>
                  </div>
                </div>
              </div>
              <div>
                <h2 className={`text-4xl sm:text-5xl font-black font-serif mb-8 ${theme.accent}`}>Opening Hours</h2>
                <div className="space-y-3">
                  {(parsedHours.length ? parsedHours : [{ day: 'Mon-Sun', time: '12:00 - 22:00' }]).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-black/[0.04] border border-white/5 transition-colors hover:bg-black/[0.08]">
                      <span className="font-bold text-xl">{item.day}</span>
                      <span className="text-lg opacity-90 font-medium">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-20 text-center">
            <button onClick={onManageBusiness} className={`px-10 py-5 rounded-full font-black text-lg shadow-2xl transition-transform hover:-translate-y-1 ${theme.button}`}>
              Go to Overview
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
