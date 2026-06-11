import type { BenchmarkSuite, Experiment } from "@/lib/types";

const DATABASE_NAME = "ollama-chat-lab";
const DATABASE_VERSION = 1;
const EXPERIMENTS_STORE = "experiments";
const SUITES_STORE = "suites";

type StoreName = typeof EXPERIMENTS_STORE | typeof SUITES_STORE;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(EXPERIMENTS_STORE)) {
        database.createObjectStore(EXPERIMENTS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SUITES_STORE)) {
        database.createObjectStore(SUITES_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = run(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

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
