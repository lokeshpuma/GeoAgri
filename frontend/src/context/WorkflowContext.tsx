import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchFullReport, FullReportResponse, PredictRequestPayload } from '../api/client';

import { detectLocationFromCoordinates, DetectedLocationResult, findNearestAgriDistrict } from '../utils/locationDataset';
import { getCoordinatesCentroid } from '../features/boundary/boundaryMath';

export type StepNumber = 1 | 2 | 3 | 4 | 5;

export interface WorkflowFormData {
  polygonPts: [number, number][];
  pointPt?: [number, number];
  areaHa: number;
  plotName?: string;
  boundarySource?: string;
  areaSource?: string;
  confirmed?: boolean;
  season: "kharif" | "rabi" | "zaid" | "annual" | "perennial";
  irrigationPref: "rainfed" | "supplemental" | "full" | "";
  phInput: string;
  socInput: string;
  selectedPresetName: string;
}

export interface PipelineStage {
  id: number;
  title: string;
  source: string;
  description: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: 1, title: "Location Captured", source: "WGS84 Geodesic", description: "Calculating parcel boundaries & centroid" },
  { id: 2, title: "Google Earth Engine", source: "GEE Cloud API", description: "Fetching satellite observations" },
  { id: 3, title: "Sentinel-1 / Sentinel-2", source: "Copernicus Hub", description: "Processing spectral & radar indicators" },
  { id: 4, title: "SoilGrids Profiles", source: "ISRIC Global 250m", description: "Retrieving 3D soil depth properties" },
  { id: 5, title: "NASA POWER Meteorology", source: "NASA Langley", description: "Retrieving climate & rainfall data" },
  { id: 6, title: "Environmental Analysis", source: "Spectral Fusion", description: "Calculating NDVI / NDMI / NDWI" },
  { id: 7, title: "Agronomic Analysis", source: "Model A Engine", description: "Evaluating land suitability" },
  { id: 8, title: "Irrigation Analysis", source: "Model C Engine", description: "Calculating water balance" },
  { id: 9, title: "Climate Risk Scorecard", source: "Model E Engine", description: "Calculating climate risk" },
  { id: 10, title: "Analysis Complete", source: "Decision Engine", description: "Field analysis finalized" },
];

export interface AnalysisStatus {
  locationSelected: boolean;
  predictionComplete: boolean;
  cropAnalysisComplete: boolean;
}

interface WorkflowContextType {
  currentStep: StepNumber;
  maxUnlockedStep: number;
  formData: WorkflowFormData;
  report: FullReportResponse | null;
  loading: boolean;
  isPredicted: boolean;
  analysisStatus: AnalysisStatus;
  detectedLocation: DetectedLocationResult | null;
  theme: 'dark' | 'light';
  pipelineStageIndex: number;
  error: string | null;
  goToStep: (step: StepNumber) => void;
  runPredictNow: () => Promise<boolean>;
  startCropAnalysis: () => void;
  runAnalysis: () => Promise<boolean>;
  updateFormData: (partial: Partial<WorkflowFormData>) => void;
  isStepAccessible: (step: StepNumber) => boolean;
  toggleTheme: () => void;
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

const STEP_HASHES: Record<StepNumber, string> = {
  1: '#home',
  2: '#boundary',
  3: '#analysis',
  4: '#crops',
  5: '#report'
};

const HASH_TO_STEP: Record<string, StepNumber> = {
  '#home': 1,
  '#workspace': 1,
  '#boundary': 2,
  '#analysis': 3,
  '#field-analysis': 3,
  '#crops': 4,
  '#crop-prediction': 4,
  '#report': 5,
  '#summary': 5
};

export const WorkflowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<number>(2); // Steps 1 and 2 are unlocked by default
  const [report, setReport] = useState<FullReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isPredicted, setIsPredicted] = useState<boolean>(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    locationSelected: false,
    predictionComplete: false,
    cropAnalysisComplete: false,
  });
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocationResult | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('geoagri_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('geoagri_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [pipelineStageIndex, setPipelineStageIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  const [formData, setFormData] = useState<WorkflowFormData>({
    polygonPts: [],
    pointPt: undefined,
    areaHa: 0,
    season: "kharif",
    irrigationPref: "",
    phInput: "",
    socInput: "",
    selectedPresetName: ""
  });

  const updateFormData = (partial: Partial<WorkflowFormData>) => {
    setFormData(prev => {
      const next = { ...prev, ...partial };
      const hasLocation = ((next.polygonPts && next.polygonPts.length >= 3) || next.pointPt !== undefined) && next.confirmed === true;
      setAnalysisStatus(s => ({ ...s, locationSelected: hasLocation }));
      return next;
    });
    // If coordinates change or confirmed is false/cleared, re-lock steps 3-5 and clear report (PRD S8, S9)
    if (partial.polygonPts || partial.pointPt || partial.confirmed === false) {
      if (partial.confirmed !== true) {
        setIsPredicted(false);
        setReport(null);
        setAnalysisStatus(prev => ({
          ...prev,
          predictionComplete: false,
          cropAnalysisComplete: false,
        }));
        setMaxUnlockedStep(2);
      }
    }
  };

  const isStepAccessible = (step: StepNumber): boolean => {
    if (step === 1 || step === 2) return true;
    if (step === 3) return formData.confirmed === true;
    if (step === 4) return (analysisStatus.predictionComplete || isPredicted || report !== null) && formData.confirmed === true;
    if (step === 5) return analysisStatus.cropAnalysisComplete && formData.confirmed === true;
    return false;
  };

  const goToStep = (step: StepNumber) => {
    if (!isStepAccessible(step)) {
      return;
    }

    setCurrentStep(step);
    if (step > maxUnlockedStep) {
      setMaxUnlockedStep(step);
    }

    if (typeof window !== 'undefined') {
      window.location.hash = STEP_HASHES[step];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Dynamically detect location from coordinates using Kaggle/ICAR dataset + reverse geocoding
  useEffect(() => {
    const center = getCoordinatesCentroid(formData.polygonPts, formData.pointPt);
    const lat = center ? center[1] : undefined;
    const lon = center ? center[0] : undefined;

    if (lat === undefined || lon === undefined) {
      setDetectedLocation(null);
      return;
    }

    let active = true;
    detectLocationFromCoordinates(lat, lon).then(result => {
      if (active) {
        setDetectedLocation(result);
      }
    });

    return () => {
      active = false;
    };
  }, [formData.pointPt, formData.polygonPts]);

  /**
   * Predict Now triggered from Page 2.
   * Runs the real backend pipeline while advancing live processing stages.
   */
  const runPredictNow = async (): Promise<boolean> => {
    if (formData.polygonPts.length < 3 && !formData.pointPt) {
      setError("Please define a field boundary polygon or drop a pin before running prediction.");
      return false;
    }

    setLoading(true);
    setError(null);
    setPipelineStageIndex(1);

    // Live stage progression timer to provide clear feedback during the API fetch
    const stageInterval = setInterval(() => {
      setPipelineStageIndex(prev => (prev < PIPELINE_STAGES.length ? prev + 1 : prev));
    }, 400);

    const payload: PredictRequestPayload = {
      polygon: formData.polygonPts.length > 0 ? formData.polygonPts : undefined,
      point: formData.pointPt,
      season: formData.season,
      limit: 100,
      area_ha: formData.areaHa,
      plot_name: formData.plotName || undefined,
      boundary_source: formData.boundarySource || (formData.polygonPts.length > 0 ? 'drawn' : 'point'),
      area_source: formData.areaSource || 'calculated',
      irrigation_preference: formData.irrigationPref ? (formData.irrigationPref as any) : null,
      manual_soil: (formData.phInput || formData.socInput) ? {
        ph: formData.phInput ? parseFloat(formData.phInput) : null,
        organic_carbon: formData.socInput ? parseFloat(formData.socInput) : null
      } : null
    };

    try {
      const res = await fetchFullReport(payload);
      clearInterval(stageInterval);
      setPipelineStageIndex(PIPELINE_STAGES.length); // All 10 stages complete
      setReport(res);
      setIsPredicted(true);
      setAnalysisStatus(prev => ({
        ...prev,
        predictionComplete: true,
        cropAnalysisComplete: false,
      }));
      setMaxUnlockedStep(4);
      return true;
    } catch (err: any) {
      clearInterval(stageInterval);
      setError(err.message || "Failed to connect to GeoAgri AI backend server.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Action when user clicks "Analyse All Crops →" on Step 3 (Field Analysis).
   * Completes crop analysis readiness and unlocks Step 4 & 5.
   */
  const startCropAnalysis = () => {
    setAnalysisStatus(prev => ({
      ...prev,
      cropAnalysisComplete: true,
    }));
    setMaxUnlockedStep(5);
    goToStep(4);
  };

  // Sync hash with browser history
  useEffect(() => {
    const handleHashChange = () => {
      const step = HASH_TO_STEP[window.location.hash];
      if (step) {
        if (step <= 2 || isStepAccessible(step)) {
          setCurrentStep(step);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [analysisStatus, isPredicted, report, maxUnlockedStep]);

  return (
    <WorkflowContext.Provider
      value={{
        currentStep,
        maxUnlockedStep,
        formData,
        report,
        loading,
        isPredicted,
        analysisStatus,
        detectedLocation,
        theme,
        pipelineStageIndex,
        error,
        goToStep,
        runPredictNow,
        startCropAnalysis,
        runAnalysis: runPredictNow,
        updateFormData,
        isStepAccessible,
        toggleTheme,
        isChatOpen,
        setIsChatOpen
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return context;
};

