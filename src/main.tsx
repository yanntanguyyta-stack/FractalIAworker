import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Root from './components/Root';
import './index.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('La variable d\'environnement VITE_CLERK_PUBLISHABLE_KEY est manquante. Ajoutez-la dans .env.local');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        variables: { colorPrimary: '#4F46E5' },
      }}
    >
      <Root />
      <Analytics />
      <SpeedInsights />
    </ClerkProvider>
  </React.StrictMode>,
);
