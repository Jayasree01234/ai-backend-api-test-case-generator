import { getCurrentUser } from "./authService";

const PROJECTS_KEY = "api_test_ai_projects";
const APIS_KEY = "api_test_ai_endpoints";

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMethod(method) {
  return String(method || "").trim().toUpperCase();
}

function normalizeEndpoint(endpoint) {
  const value = String(endpoint || "").trim().replace(/\/+/g, "/");

  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function endpointKey(method, endpoint) {
  return `${normalizeMethod(method)} ${normalizeEndpoint(endpoint)}`;
}

export async function getProjects() {
  const user = await getCurrentUser();
  if (!user) return [];

  return readList(PROJECTS_KEY)
    .filter((project) => project.owner_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createProject(name, description) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Please sign in first.");
  }

  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("Project name is required.");

  const project = {
    id: createId(),
    name: cleanName,
    description: String(description || "").trim(),
    owner_id: user.id,
    created_at: new Date().toISOString(),
  };

  writeList(PROJECTS_KEY, [project, ...readList(PROJECTS_KEY)]);

  return project;
}

export async function getProjectApis(projectId) {
  const projects = await getProjects();

  if (!projects.some((project) => project.id === projectId)) {
    return [];
  }

  return readList(APIS_KEY)
    .filter((api) => api.project_id === projectId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createProjectApi(apiData) {
  const projectId = apiData.project_id;
  const method = normalizeMethod(apiData.method);
  const endpoint = normalizeEndpoint(apiData.endpoint);

  if (!projectId || !method || !endpoint) {
    throw new Error("Project, HTTP method, and endpoint are required.");
  }

  const projects = await getProjects();
  if (!projects.some((project) => project.id === projectId)) {
    throw new Error("Please select a valid project.");
  }

  const apis = await getProjectApis(projectId);
  if (apis.some((api) => endpointKey(api.method, api.endpoint) === endpointKey(method, endpoint))) {
    throw new Error(`${method} ${endpoint} already exists in this project.`);
  }

  const newApi = {
    id: createId(),
    project_id: projectId,
    method,
    endpoint,
    request_body: apiData.request_body || "",
    created_at: new Date().toISOString(),
  };

  writeList(APIS_KEY, [...readList(APIS_KEY), newApi]);
  return newApi;
}

export async function createProjectApis(inputApis) {
  if (!Array.isArray(inputApis) || inputApis.length === 0) return [];

  const projects = await getProjects();
  const ownedProjectIds = new Set(projects.map((project) => project.id));
  const existingApis = readList(APIS_KEY);
  const existingKeys = new Set(
    existingApis.map(
      (api) => `${api.project_id}::${endpointKey(api.method, api.endpoint)}`
    )
  );

  const batchKeys = new Set();
  const additions = [];

  for (const item of inputApis) {
    const projectId = item.project_id;
    const method = normalizeMethod(item.method);
    const endpoint = normalizeEndpoint(item.endpoint);

    if (!ownedProjectIds.has(projectId) || !method || !endpoint) continue;

    const key = `${projectId}::${endpointKey(method, endpoint)}`;

    if (existingKeys.has(key) || batchKeys.has(key)) continue;

    batchKeys.add(key);
    additions.push({
      id: createId(),
      project_id: projectId,
      method,
      endpoint,
      request_body: item.request_body || "",
      created_at: new Date().toISOString(),
    });
  }

  if (additions.length > 0) {
    writeList(APIS_KEY, [...existingApis, ...additions]);
  }

  return additions;
}