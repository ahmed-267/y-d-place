import React, { useState } from 'react';
import { useApp } from '@/AppContext';
import { CheckCircle2, Wand2 } from 'lucide-react';
import { compressImage, refineBrandStory } from '@/utils/aiHelper';
import { supabase } from '@/components/supabaseClient';

type ColorTheme = 'Elegant Dark' | 'Vibrant Street' | 'Minimalist Cream' | 'Rustic Wood' | 'Neon Night' | 'Pastel Sweet';

type LandingPageGeneratorWizardProps = {
  onCancel: () => void;
  onGenerated?: () => void;
};

const defaultOpeningHours = [
  { day: 'Mon', open: '09:00', close: '22:00', closed: false },
  { day: 'Tue', open: '09:00', close: '22:00', closed: false },
  { day: 'Wed', open: '09:00', close: '22:00', closed: false },
  { day: 'Thu', open: '09:00', close: '22:00', closed: false },
  { day: 'Fri', open: '09:00', close: '23:00', closed: false },
  { day: 'Sat', open: '10:00', close: '23:00', closed: false },
  { day: 'Sun', open: '10:00', close: '22:00', closed: false },
];

const colorThemeOptions: Array<{ value: ColorTheme; swatches: string[] }> = [
  { value: 'Elegant Dark', swatches: ['#0f1116', '#1f2630', '#d4a373'] },
  { value: 'Vibrant Street', swatches: ['#f2ece1', '#1493ff', '#ff7a18'] },
  { value: 'Minimalist Cream', swatches: ['#fcfaf5', '#e9dcc5', '#5d4037'] },
  { value: 'Rustic Wood', swatches: ['#2f241d', '#7a5230', '#c89b6d'] },
  { value: 'Neon Night', swatches: ['#120a1e', '#35f0ff', '#ff4fd8'] },
  { value: 'Pastel Sweet', swatches: ['#fff4ef', '#ffc9de', '#b8f2e6'] },
];

export const LandingPageGeneratorWizard = ({ onCancel, onGenerated }: LandingPageGeneratorWizardProps) => {
  const { businessSettings, user, setLandingPageConfig, addToast } = useApp();
  const [landingStep, setLandingStep] = useState(1);
  const [isRefiningStory, setIsRefiningStory] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [landingForm, setLandingForm] = useState({
    cuisineType: '',
    colorTheme: 'Elegant Dark' as ColorTheme,
    address: '',
    openingHours: defaultOpeningHours,
    brandStoryRaw: '',
    logoImage: '',
    galleryImages: [] as string[],
  });

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadImageToSupabase = async (file: File, bucket: string): Promise<string | null> => {
    const fileName = `${user?.id || 'public'}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) {
      console.warn(`Image upload failed (${file.name}): ${error.message}`);
      return null;
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  return (
    <div className="space-y-5">
      {landingStep === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Cuisine Type</label>
            <input
              className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
              placeholder="Italian, Mexican, Fusion..."
              value={landingForm.cuisineType}
              onChange={e => setLandingForm(prev => ({ ...prev, cuisineType: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Visual Identity</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {colorThemeOptions.map(option => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setLandingForm(prev => ({ ...prev, colorTheme: option.value }))}
                  className={`w-full p-3 rounded-2xl border text-left inline-flex items-center justify-between ${
                    landingForm.colorTheme === option.value
                      ? 'border-bakery-brown bg-bakery-beige/40'
                      : 'border-bakery-beige bg-white'
                  }`}
                >
                  <span className="text-xs font-bold">{option.value}</span>
                  <span className="inline-flex items-center gap-1">
                    {option.swatches.map((color) => (
                      <span key={color} className="flex h-4 w-4 rounded-sm border border-black/10" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {landingStep === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Address (Optional)</label>
            <input
              className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
              value={landingForm.address}
              onChange={e => setLandingForm(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Opening Hours</label>
            <div className="grid gap-2">
              {landingForm.openingHours.map((hours, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl border border-bakery-beige bg-white">
                  <span className="w-10 text-sm font-bold">{hours.day}</span>
                  <label className="flex items-center gap-2 text-xs font-bold text-bakery-brown/60">
                    <input
                      type="checkbox"
                      checked={hours.closed}
                      onChange={e => {
                        const next = [...landingForm.openingHours];
                        next[idx] = { ...next[idx], closed: e.target.checked };
                        setLandingForm({ ...landingForm, openingHours: next });
                      }}
                      className="rounded text-bakery-brown focus:ring-bakery-caramel"
                    />
                    Closed
                  </label>
                  {!hours.closed && (
                    <div className="flex items-center gap-2 ml-auto">
                      <input
                        type="time"
                        value={hours.open}
                        onChange={e => {
                          const next = [...landingForm.openingHours];
                          next[idx] = { ...next[idx], open: e.target.value };
                          setLandingForm({ ...landingForm, openingHours: next });
                        }}
                        className="p-2 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-xs font-bold"
                      />
                      <span className="text-bakery-brown/40">-</span>
                      <input
                        type="time"
                        value={hours.close}
                        onChange={e => {
                          const next = [...landingForm.openingHours];
                          next[idx] = { ...next[idx], close: e.target.value };
                          setLandingForm({ ...landingForm, openingHours: next });
                        }}
                        className="p-2 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {landingStep === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Restaurant Logo (Required)</label>
            <input
              type="file"
              accept="image/*"
              className="w-full p-3 border border-bakery-beige rounded-2xl bg-white"
              onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                if (e.target.files && e.target.files.length > 0) {
                  const maybeFile = e.target.files.item(0);
                  if (!(maybeFile instanceof File)) return;
                  const file = maybeFile;
                  setIsProcessingImages(true);
                  try {
                    const publicUrl = await uploadImageToSupabase(file, 'landing-images');
                    if (publicUrl) {
                      setLandingForm(prev => ({ ...prev, logoImage: publicUrl }));
                    } else {
                      const base = await toBase64(file);
                      const compressed = await compressImage(base, 900, 0.78);
                      setLandingForm(prev => ({ ...prev, logoImage: compressed }));
                      addToast('Using local image preview (cloud upload unavailable).', 'info');
                    }
                  } finally {
                    setIsProcessingImages(false);
                  }
                  e.target.value = '';
                }
              }}
            />
            {landingForm.logoImage && (
              <img src={landingForm.logoImage} alt="Logo preview" className="mt-3 w-20 h-20 rounded-2xl object-cover border border-bakery-beige" />
            )}
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Restaurant Images (3-5 Required)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              className="w-full p-3 border border-bakery-beige rounded-2xl bg-white"
              onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                if (e.target.files && e.target.files.length > 0) {
                  const files = Array.from(e.target.files).filter((f): f is File => f instanceof File);
                  setIsProcessingImages(true);
                  try {
                    const picked = files.slice(0, 5);
                    const encoded: string[] = [];
                    for (const file of picked) {
                      const publicUrl = await uploadImageToSupabase(file, 'landing-images');
                      if (publicUrl) {
                        encoded.push(publicUrl);
                      } else {
                        const base = await toBase64(file);
                        encoded.push(await compressImage(base, 1400, 0.8));
                      }
                    }
                    setLandingForm(prev => ({ ...prev, galleryImages: [...prev.galleryImages, ...encoded].slice(0, 5) }));
                    if (encoded.length > 0) {
                      addToast(`${encoded.length} image(s) added.`, 'success');
                    }
                  } finally {
                    setIsProcessingImages(false);
                  }
                  e.target.value = '';
                }
              }}
            />
            <p className="mt-2 text-xs text-bakery-brown/55">{landingForm.galleryImages.length}/5 selected (minimum 3)</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {landingForm.galleryImages.map((img, idx) => (
                <img key={idx} src={img} alt={`Restaurant ${idx + 1}`} className="w-full h-20 rounded-xl object-cover border border-bakery-beige" />
              ))}
            </div>
          </div>
        </div>
      )}

      {landingStep === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40">Brand Story</label>
            <button
              onClick={async () => {
                if (!landingForm.brandStoryRaw.trim()) return;
                setIsRefiningStory(true);
                const refined = await refineBrandStory(
                  landingForm.brandStoryRaw,
                  businessSettings?.name || 'Restaurant',
                  landingForm.cuisineType || 'restaurant',
                  landingForm.colorTheme
                );
                setIsRefiningStory(false);
                if (refined) {
                  setLandingForm(prev => ({ ...prev, brandStoryRaw: refined }));
                } else {
                  addToast('Could not refine story. Please try again.', 'error');
                }
              }}
              className="px-3 py-2 rounded-xl border border-bakery-beige bg-white text-xs font-bold inline-flex items-center gap-1"
              disabled={isRefiningStory}
            >
              <Wand2 size={14} />
              {isRefiningStory ? 'Refining...' : 'Refine Story'}
            </button>
          </div>
          <textarea
            className="w-full min-h-[220px] p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
            placeholder="Tell your raw story, concept, inspirations, and what makes your place unique..."
            value={landingForm.brandStoryRaw}
            onChange={e => setLandingForm(prev => ({ ...prev, brandStoryRaw: e.target.value }))}
          />
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={() => landingStep > 1 ? setLandingStep(landingStep - 1) : onCancel()}
          className="px-4 py-2 rounded-xl border border-bakery-beige text-bakery-brown/70 font-bold text-sm"
        >
          {landingStep === 1 ? 'Cancel' : 'Back'}
        </button>
        <div className="flex items-center gap-3">
          {landingStep === 3 && landingForm.galleryImages.length < 3 && (
            <span className="text-xs text-rose-500 font-bold max-w-[200px] text-right leading-tight">
              Please add at least 3 items to showcase your menu properly.
            </span>
          )}
          {landingStep < 4 ? (
            <button
              onClick={() => setLandingStep(landingStep + 1)}
              disabled={isProcessingImages || (landingStep === 3 && (!landingForm.logoImage || landingForm.galleryImages.length < 3))}
              className="btn-primary px-5 py-2 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => {
                if (!landingForm.cuisineType.trim() || !landingForm.brandStoryRaw.trim()) {
                  addToast('Please fill cuisine, opening hours, and story.', 'error');
                  return;
                }
                setLandingPageConfig({
                  cuisineType: landingForm.cuisineType.trim(),
                  colorTheme: landingForm.colorTheme,
                  address: landingForm.address.trim(),
                  openingHours: JSON.stringify(landingForm.openingHours),
                  brandStoryRaw: landingForm.brandStoryRaw.trim(),
                  refinedStory: landingForm.brandStoryRaw.trim(),
                  logoImage: landingForm.logoImage,
                  galleryImages: landingForm.galleryImages,
                  generatedAt: Date.now()
                });
                addToast('Landing page generated successfully.');
                onGenerated?.();
              }}
              className="btn-primary px-5 py-2 rounded-xl text-sm inline-flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              Generate Landing Page
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
