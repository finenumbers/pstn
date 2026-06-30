import {
  SOURCE_FILES,
  type LoadedRowsBySource,
  type SourceFileKey,
} from "@/packages/import/constants";

export type ImportJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type ImportFileStatus = "pending" | "loading" | "done" | "failed";

export type ImportStepStatus = "pending" | "active" | "done";

export interface ImportFileProgress {
  key: SourceFileKey;
  status: ImportFileStatus;
  rows: number | null;
}

export interface ImportStepProgress {
  id: string;
  label: string;
  status: ImportStepStatus;
}

export interface ImportProgressDisplay {
  phase: string;
  phaseLabel: string;
  percent: number;
  filesProcessed: number;
  filesTotal: number;
  rowsLoaded: number;
  files: ImportFileProgress[];
  steps: ImportStepProgress[];
}

const POST_LOAD_PHASES = [
  { id: "validating", label: "Проверка полноты данных" },
  { id: "computing_gaps", label: "Расчёт пропусков в диапазонах" },
  { id: "computing_diff", label: "Анализ расхождений по диапазонам" },
  { id: "swapping", label: "Обновление таблицы и справочников" },
  { id: "saving_version_snapshot", label: "Сохранение версии датасета" },
  { id: "binding_uvr_antifraud", label: "Привязка УВр Антифрод" },
  { id: "completed", label: "Готово" },
] as const;

const PHASE_LABELS: Record<string, string> = {
  pending: "Ожидание запуска…",
  checking_sources: "Сравнение с текущим датасетом…",
  skipped_unchanged: "Данные актуальны, обновление не требуется",
  clearing_staging: "Подготовка к загрузке…",
  validating: "Проверка полноты данных…",
  computing_gaps: "Расчёт пропусков в диапазонах…",
  computing_diff: "Анализ расхождений по диапазонам…",
  saving_version_snapshot: "Сохранение версии датасета…",
  saving_diff_snapshot: "Сохранение расхождений…",
  swapping: "Обновление таблицы и справочников…",
  binding_uvr_antifraud: "Привязка УВр Антифрод по ИНН…",
  completed: "Загрузка завершена",
  failed: "Загрузка не завершена",
};

function loadingPhaseKey(phase: string): SourceFileKey | null {
  if (!phase.startsWith("loading_")) return null;
  const key = phase.slice("loading_".length);
  return SOURCE_FILES.some((file) => file.key === key)
    ? (key as SourceFileKey)
    : null;
}

export function buildImportFileProgress(
  phase: string,
  fileRows: Partial<LoadedRowsBySource>,
  jobStatus: ImportJobStatus,
  filesProcessed = 0,
  filesTotal: number = SOURCE_FILES.length
): ImportFileProgress[] {
  if (jobStatus === "skipped") {
    return SOURCE_FILES.map((file) => ({
      key: file.key,
      status: "done" as const,
      rows: null,
    }));
  }

  const loadingKey = loadingPhaseKey(phase);
  const hasFileBreakdown = SOURCE_FILES.some(
    (file) => (fileRows[file.key] ?? 0) > 0
  );

  return SOURCE_FILES.map((file, index) => {
    const rows = fileRows[file.key] ?? 0;

    if (rows > 0) {
      return { key: file.key, status: "done" as const, rows };
    }

    if (jobStatus === "completed") {
      if (hasFileBreakdown) {
        return { key: file.key, status: "pending" as const, rows: null };
      }

      if (filesProcessed >= filesTotal) {
        return { key: file.key, status: "done" as const, rows: null };
      }

      if (index < filesProcessed) {
        return { key: file.key, status: "done" as const, rows: null };
      }

      return { key: file.key, status: "pending" as const, rows: null };
    }

    if (loadingKey === file.key) {
      return {
        key: file.key,
        status: jobStatus === "failed" ? ("failed" as const) : ("loading" as const),
        rows: null,
      };
    }

    if (jobStatus === "failed" && loadingKey) {
      const failedIndex = SOURCE_FILES.findIndex((item) => item.key === loadingKey);
      if (index === failedIndex) {
        return { key: file.key, status: "failed" as const, rows: null };
      }
    }

    return { key: file.key, status: "pending" as const, rows: null };
  });
}

export function computeImportPercent(
  phase: string,
  filesProcessed: number,
  filesTotal: number,
  jobStatus: ImportJobStatus
): number {
  if (jobStatus === "skipped") return 100;
  if (jobStatus === "completed") return 100;
  if (jobStatus === "failed") {
    return Math.min(
      95,
      Math.max(5, Math.round((filesProcessed / filesTotal) * 75) + 5)
    );
  }

  if (phase === "pending") return 1;
  if (phase === "checking_sources") return 2;
  if (phase === "skipped_unchanged") return 100;
  if (phase === "clearing_staging") return 4;

  if (phase.startsWith("loading_")) {
    const base = 8 + (filesProcessed / filesTotal) * 62;
    return Math.min(72, Math.round(base + 4));
  }

  if (phase.startsWith("loaded_")) {
    const base = 8 + (filesProcessed / filesTotal) * 62;
    return Math.min(74, Math.round(base + 8));
  }

  const postPercent: Record<string, number> = {
    validating: 78,
    computing_gaps: 82,
    computing_diff: 86,
    swapping: 89,
    saving_version_snapshot: 92,
    saving_diff_snapshot: 92,
    binding_uvr_antifraud: 97,
    completed: 100,
  };

  return postPercent[phase] ?? 5;
}

export function buildImportSteps(
  phase: string,
  jobStatus: ImportJobStatus
): ImportStepProgress[] {
  if (jobStatus === "skipped") {
    return [
      {
        id: "checking_sources",
        label: "Сравнение с текущим датасетом",
        status: "done",
      },
      {
        id: "skipped_unchanged",
        label: "Данные актуальны",
        status: "done",
      },
    ];
  }

  const fileStep: ImportStepProgress = {
    id: "files",
    label: "Загрузка файлов Минцифры",
    status: "pending",
  };

  if (phase === "checking_sources") {
    return [
      {
        id: "checking_sources",
        label: "Сравнение с текущим датасетом",
        status: "active",
      },
      ...POST_LOAD_PHASES.map((step) => ({
        id: step.id,
        label: step.label,
        status: "pending" as ImportStepStatus,
      })),
    ];
  }

  if (phase === "clearing_staging" || phase === "pending") {
    fileStep.status = phase === "clearing_staging" ? "active" : "pending";
  } else if (
    phase.startsWith("loading_") ||
    phase.startsWith("loaded_") ||
    filesPhaseComplete(phase, jobStatus)
  ) {
    fileStep.status =
      jobStatus === "completed" || isPostLoadPhase(phase) ? "done" : "active";
  }

  if (jobStatus === "failed" && (phase.startsWith("loading_") || phase === "clearing_staging")) {
    fileStep.status = "active";
  }

  const postSteps = POST_LOAD_PHASES.map((step) => {
    let status: ImportStepStatus = "pending";

    if (jobStatus === "completed") {
      status = "done";
    } else if (phase === step.id) {
      status = jobStatus === "failed" ? "active" : "active";
    } else if (isPostLoadPhase(phase) && postPhaseIndex(phase) > postPhaseIndex(step.id)) {
      status = "done";
    }

    return { id: step.id, label: step.label, status };
  });

  return [fileStep, ...postSteps];
}

function isPostLoadPhase(phase: string): boolean {
  return POST_LOAD_PHASES.some((step) => step.id === phase);
}

function postPhaseIndex(phase: string): number {
  return POST_LOAD_PHASES.findIndex((step) => step.id === phase);
}

function filesPhaseComplete(phase: string, jobStatus: ImportJobStatus): boolean {
  return isPostLoadPhase(phase) || jobStatus === "completed" || jobStatus === "failed";
}

export function resolvePhaseLabel(
  phase: string,
  jobStatus: ImportJobStatus
): string {
  if (jobStatus === "skipped") return PHASE_LABELS.skipped_unchanged;
  if (jobStatus === "completed") return PHASE_LABELS.completed;
  if (jobStatus === "failed") return PHASE_LABELS.failed;

  if (phase.startsWith("loading_")) {
    const key = phase.slice("loading_".length);
    return `Загрузка ${key}…`;
  }

  if (phase.startsWith("loaded_")) {
    const key = phase.slice("loaded_".length);
    return `${key} загружен`;
  }

  return PHASE_LABELS[phase] ?? "Загрузка данных…";
}

export function buildImportProgressDisplay(input: {
  status: ImportJobStatus;
  phase: string;
  fileRows: Partial<LoadedRowsBySource>;
  filesProcessed: number;
  filesTotal: number;
  rowsLoaded: number;
}): ImportProgressDisplay {
  const phase = input.phase || (input.status === "pending" ? "pending" : "");
  const files = buildImportFileProgress(
    phase,
    input.fileRows,
    input.status,
    input.filesProcessed,
    input.filesTotal
  );
  const percent = computeImportPercent(
    phase,
    input.filesProcessed,
    input.filesTotal,
    input.status
  );

  return {
    phase,
    phaseLabel: resolvePhaseLabel(phase, input.status),
    percent,
    filesProcessed: input.filesProcessed,
    filesTotal: input.filesTotal,
    rowsLoaded: input.rowsLoaded,
    files,
    steps: buildImportSteps(phase, input.status),
  };
}
