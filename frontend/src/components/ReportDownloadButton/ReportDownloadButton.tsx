import React from 'react';
import { Download, Printer, CheckCircle } from 'lucide-react';

interface ReportDownloadButtonProps {
  onPrint?: () => void;
}

export const ReportDownloadButton: React.FC<ReportDownloadButtonProps> = ({ onPrint }) => {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="report-actions-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CheckCircle size={18} style={{ color: '#10b981' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
          Intelligence Dossier Ready
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handlePrint}
          className="btn-primary"
          style={{ padding: '10px 24px' }}
        >
          <Download size={17} />
          <span>Download Full Report PDF</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="btn-secondary"
          style={{ padding: '10px 20px' }}
        >
          <Printer size={17} />
          <span>Print Report</span>
        </button>
      </div>
    </div>
  );
};
