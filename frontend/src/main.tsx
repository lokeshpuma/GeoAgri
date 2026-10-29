import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/typography.css';
import './styles/motion.css';
import './styles/utilities.css';
import './styles/components/uiKit.css';
import './styles/components/cropPrediction.css';
import './styles/components/fieldAnalysis.css';
import './styles/components/summaryReport.css';
import './styles/components/boundaryStudio.css';
import './styles/components/workspace.css';
import './styles/components/chatbot.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
