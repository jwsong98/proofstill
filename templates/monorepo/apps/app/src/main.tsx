import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Start } from './features/start/Start';
import '@proofstill/ui/styles.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Start /></React.StrictMode>);
