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
      <div className="report-actions-title-row">
        <CheckCircle size={18} className="text-emerald" />
        <span className="report-actions-title">
          Intelligence Dossier Ready
        </span>
      </div>

      <div className="report-buttons-group">
        <button
          type="button"
          onClick={handlePrint}
          className="btn-primary btn-report-download"
        >
          <Download size={17} />
          <span>Download Full Report PDF</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="btn-secondary btn-report-print"
        >
          <Printer size={17} />
          <span>Print Report</span>
        </button>
      </div>
    </div>
  );
};
