import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix for libraries trying to overwrite read-only window.fetch or window.FormData
if (typeof window !== 'undefined') {
  const fixWritable = (obj: any, prop: string) => {
    if (obj[prop]) {
      try {
        const original = obj[prop];
        Object.defineProperty(obj, prop, {
          value: original,
          writable: true,
          configurable: true
        });
      } catch (e) {
        console.warn(`Could not make ${prop} writable`, e);
      }
    }
  };
  fixWritable(window, 'fetch');
  fixWritable(window, 'FormData');
  fixWritable(window, 'Headers');
  fixWritable(window, 'Request');
  fixWritable(window, 'Response');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
