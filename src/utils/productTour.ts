const TOUR_DONE_KEY = 'previsio_tour_v1_done';
const TOUR_PENDING_KEY = 'previsio_tour_pending';
export const TOUR_START_EVENT = 'previsio:start-tour';

export const markTourDone = () => {
  try {
    localStorage.setItem(TOUR_DONE_KEY, '1');
  } catch {
    /* ignore */
  }
};

export const isTourDone = () => {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === '1';
  } catch {
    return false;
  }
};

export const requestProductTour = () => {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
};

/** Show the section tour once, in this session, after registration/setup finishes. */
export const queueTourAfterSetup = () => {
  try {
    sessionStorage.setItem(TOUR_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
};

/** Peek only — keep the flag until the tour actually opens (survives Dashboard remount). */
export const hasPendingTour = () => {
  try {
    return sessionStorage.getItem(TOUR_PENDING_KEY) === '1';
  } catch {
    return false;
  }
};

export const clearPendingTour = () => {
  try {
    sessionStorage.removeItem(TOUR_PENDING_KEY);
  } catch {
    /* ignore */
  }
};

/** @deprecated Prefer hasPendingTour + clearPendingTour so remounts don't drop the tour. */
export const consumePendingTour = () => {
  const pending = hasPendingTour();
  if (pending) clearPendingTour();
  return pending;
};
