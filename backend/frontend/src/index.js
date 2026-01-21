import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/latin-400.css';
import '@fontsource/cairo/latin-700.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Create React Query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // Data is fresh for 5 minutes
      cacheTime: 10 * 60 * 1000,     // Cache data for 10 minutes
      refetchOnWindowFocus: false,   // Don't refetch on window focus
      retry: 1,                       // Retry failed requests once
      retryDelay: 1000,              // Wait 1 second before retry
    },
  },
});
 
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// pdf fonts are loaded on-demand by utils when needed
