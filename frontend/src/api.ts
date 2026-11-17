export type Patient = {
  id: string;
  code: string;
  name: string;
  birth_date: string;
  administrative_sex: string;
  notes: string;
  synthetic: boolean;
  created_at: string;
};
export type Observation = {
  id: string;
  name: string;
  value: number;
  unit: string;
  measured_at: string;
  source: string;
  notes: string;
  encounter_id: string | null;
};
export type Encounter = {
  id: string;
  occurred_at: string;
  kind: string;
  notes: string;
};
export type Assessment = {
  id: string;
  scenario: string;
  probability: number;
  threshold: number;
  model_version: string;
  author: string;
  created_at: string;
  input_snapshot: Record<string, unknown>;
};
export type Field = {
  key: string;
  label: string;
  type: string;
  min: number | null;
  max: number | null;
  unit: string;
  options: Record<string, string> | null;
};
export type Scenario = {
  key: string;
  title: string;
  dataset_id: number;
  fields: Field[];
};
export type Model = {
  scenario: string;
  available?: boolean;
  version: string;
  dataset: string;
  source_rows: number;
  duplicates_removed: number;
  rows: number;
  train_rows: number;
  test_rows: number;
  algorithm: string;
  cv_roc_auc: number;
  test_metrics: Record<string, number | number[][]>;
  class_counts: Record<string, number>;
  missing_by_feature: Record<string, number>;
  source_url: string;
  archive_sha256: string;
  license: string;
  trained_at_utc: string;
};

export function token() {
  return sessionStorage.getItem("medinsight_token");
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (options.body) headers["Content-Type"] = "application/json";
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && path !== "/api/auth/login") {
    sessionStorage.removeItem("medinsight_token");
    location.href = "/login";
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : `Помилка ${response.status}`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const fmt = (value: string) =>
  new Date(value).toLocaleString("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
