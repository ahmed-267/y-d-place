import { LandingPageConfig } from '../types';

/** Default public storefront for the Y'D Place demo business. */
export const createDemoLandingConfig = (): LandingPageConfig => ({
  cuisineType: 'Belgian Waffles & Crêpes',
  colorTheme: 'Minimalist Cream',
  address: 'Brussels, Belgium',
  openingHours: JSON.stringify([
    { day: 'Mon', open: '10:00', close: '20:00', closed: false },
    { day: 'Tue', open: '10:00', close: '20:00', closed: false },
    { day: 'Wed', open: '10:00', close: '20:00', closed: false },
    { day: 'Thu', open: '10:00', close: '20:00', closed: false },
    { day: 'Fri', open: '10:00', close: '22:00', closed: false },
    { day: 'Sat', open: '10:00', close: '22:00', closed: false },
    { day: 'Sun', open: '11:00', close: '18:00', closed: false },
  ]),
  brandStoryRaw:
    "Y'D Place is a warm Brussels spot for waffles, crêpes, and slow mornings. We cook with care, serve with a smile, and keep the classics honest.",
  refinedStory:
    "Y'D Place is a warm Brussels spot for waffles, crêpes, and slow mornings.\n\nWe cook with care, serve with a smile, and keep the classics honest — from Nutella crêpes to golden Liège waffles.",
  galleryImages: [
    'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1551024506-0bccd828d697?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=1200&q=80',
  ],
  generatedAt: Date.now(),
});
