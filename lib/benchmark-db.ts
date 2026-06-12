import type { BenchmarkSuite, Experiment } from "@/lib/types";
import { STORE_NAMES, type StoreName, withStore } from "@/lib/local-db";

const EXPERIMENTS_STORE = STORE_NAMES.experiments;
const SUITES_STORE = STORE_NAMES.suites;

async function getAll<T>(storeName: StoreName) {
  return withStore<T[]>(storeName, "readonly", (store) =>
    store.getAll(),
  );
}

async function put<T>(storeName: StoreName, value: T) {
  await withStore<IDBValidKey>(storeName, "readwrite", (store) =>
    store.put(value),
  );
}

async function remove(storeName: StoreName, id: string) {
  await withStore<undefined>(storeName, "readwrite", (store) =>
    store.delete(id),
  );
}

export function listExperiments() {
  return getAll<Experiment>(EXPERIMENTS_STORE);
}

export function saveExperiment(experiment: Experiment) {
  return put(EXPERIMENTS_STORE, experiment);
}

export function deleteExperiment(id: string) {
  return remove(EXPERIMENTS_STORE, id);
}

export function listSuites() {
  return getAll<BenchmarkSuite>(SUITES_STORE);
}

export function saveSuite(suite: BenchmarkSuite) {
  return put(SUITES_STORE, suite);
}

export function deleteSuite(id: string) {
  return remove(SUITES_STORE, id);
}

export type BenchmarkExport = {
  version: 1;
  exportedAt: string;
  suites: BenchmarkSuite[];
  experiments: Experiment[];
};

export async function exportBenchmarkData(): Promise<BenchmarkExport> {
  const [suites, experiments] = await Promise.all([
    listSuites(),
    listExperiments(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    suites,
    experiments,
  };
}

export async function importBenchmarkData(data: BenchmarkExport) {
  if (
    data.version !== 1 ||
    !Array.isArray(data.suites) ||
    !Array.isArray(data.experiments)
  ) {
    throw new Error("Unsupported benchmark backup format.");
  }

  await Promise.all([
    ...data.suites.map(saveSuite),
    ...data.experiments.map(saveExperiment),
  ]);
}
