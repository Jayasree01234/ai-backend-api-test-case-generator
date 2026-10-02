import { useEffect, useState } from "react";
import * as yaml from "js-yaml";
import { generateTestsWithAI } from "./services/aiService";
import "./App.css";

import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
} from "./services/authService";

import {
  getProjects,
  createProject as createProjectInSupabase,
  getProjectApis,
  createProjectApi,
  createProjectApis,
} from "./services/projectService";

function App() {
  // =====================================================
  // AUTH
  // =====================================================

  const [user, setUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registering, setRegistering] = useState(false);

  // =====================================================
  // PROJECT
  // =====================================================

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(null);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [showCreateProject, setShowCreateProject] = useState(false);

  // =====================================================
  // API
  // =====================================================

  const [projectApis, setProjectApis] = useState([]);

  const [apiMethod, setApiMethod] = useState("GET");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [apiRequestBody, setApiRequestBody] = useState("");

  const [apiError, setApiError] = useState("");
  const [apiLoading, setApiLoading] = useState(false);

  // =====================================================
  // OPENAPI
  // =====================================================

  const [selectedFile, setSelectedFile] = useState(null);
  const [openApiSpec, setOpenApiSpec] = useState(null);
  const [importedApis, setImportedApis] = useState([]);

  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  // =====================================================
  // AI GENERATION
  // =====================================================

  const [targetLanguage, setTargetLanguage] = useState("Python");
  const [targetFramework, setTargetFramework] = useState("Pytest");

  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedFilename, setGeneratedFilename] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // =====================================================
  // AUTH CHECK
  // =====================================================

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();

        if (currentUser) {
          setUser(currentUser);
          setLoggedIn(true);
        }
      } catch (error) {
        console.error("User loading error:", error);
      } finally {
        setAuthLoading(false);
      }
    }

    loadUser();
  }, []);

  // =====================================================
  // LOAD PROJECTS
  // =====================================================

  useEffect(() => {
    if (!loggedIn) return;

    async function loadProjects() {
      setProjectLoading(true);
      setProjectError("");

      try {
        const data = await getProjects();
        const projectList = data || [];

        setProjects(projectList);

        if (projectList.length > 0 && !projectId) {
          setProjectId(projectList[0].id);
          setProjectName(projectList[0].name || "");
          setProjectDescription(
            projectList[0].description || ""
          );
        }
      } catch (error) {
        console.error("Project loading error:", error);
        setProjectError(
          error.message || "Failed to load projects."
        );
      } finally {
        setProjectLoading(false);
      }
    }

    loadProjects();
  }, [loggedIn]);

  // =====================================================
  // LOAD APIS
  // =====================================================

  useEffect(() => {
    if (!projectId) {
      setProjectApis([]);
      return;
    }

    async function loadApis() {
      try {
        const data = await getProjectApis(projectId);
        setProjectApis(data || []);
      } catch (error) {
        console.error("API loading error:", error);
      }
    }

    loadApis();
  }, [projectId]);

  // =====================================================
  // LOGIN
  // =====================================================

  const handleLogin = async (event) => {
    event.preventDefault();

    setLoginError("");
    setLoggingIn(true);

    try {
      const data = await loginUser(email, password);

      setUser(data.user);
      setLoggedIn(true);

      setEmail("");
      setPassword("");
    } catch (error) {
      setLoginError(error.message || "Login failed.");
    } finally {
      setLoggingIn(false);
    }
  };

  // =====================================================
  // REGISTER
  // =====================================================

  const handleRegister = async (event) => {
    event.preventDefault();

    setRegisterError("");
    setRegistering(true);

    try {
      const data = await registerUser(
        registerName,
        registerEmail,
        registerPassword
      );

      if (data.user) {
        setUser(data.user);
      }

      setShowRegister(false);

      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");

      alert(
        "Registration successful. Please check your email if confirmation is required."
      );
    } catch (error) {
      setRegisterError(
        error.message || "Registration failed."
      );
    } finally {
      setRegistering(false);
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {
    try {
      await logoutUser();

      setUser(null);
      setLoggedIn(false);
      setProjects([]);
      setProjectId(null);
      setProjectApis([]);

      setOpenApiSpec(null);
      setSelectedFile(null);
      setImportedApis([]);

      setGeneratedCode("");
      setGeneratedFilename("");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // =====================================================
  // CREATE PROJECT
  // =====================================================

  const handleCreateProject = async (event) => {
    event.preventDefault();

    if (!projectName.trim()) {
      setProjectError("Project name is required.");
      return;
    }

    setProjectLoading(true);
    setProjectError("");

    try {
      const newProject = await createProjectInSupabase(
        projectName.trim(),
        projectDescription.trim()
      );

      setProjects((previous) => [
        newProject,
        ...previous,
      ]);

      setProjectId(newProject.id);
      setProjectApis([]);

      setOpenApiSpec(null);
      setSelectedFile(null);
      setImportedApis([]);

      setGeneratedCode("");
      setGeneratedFilename("");

      setProjectName("");
      setProjectDescription("");
      setShowCreateProject(false);
    } catch (error) {
      setProjectError(
        error.message || "Failed to create project."
      );
    } finally {
      setProjectLoading(false);
    }
  };

  // =====================================================
  // SELECT PROJECT
  // =====================================================

  const handleSelectProject = (id) => {
    const selectedProject = projects.find(
      (project) => project.id === id
    );

    setProjectId(id);

    if (selectedProject) {
      setProjectName(selectedProject.name || "");
      setProjectDescription(
        selectedProject.description || ""
      );
    }

    setApiError("");
    setUploadError("");
    setGenerateError("");

    setOpenApiSpec(null);
    setSelectedFile(null);
    setImportedApis([]);

    setGeneratedCode("");
    setGeneratedFilename("");
  };

  // =====================================================
  // CREATE MANUAL API
  // =====================================================

  const handleCreateApi = async (event) => {
    event.preventDefault();

    setApiError("");

    if (!projectId) {
      setApiError("Please select a project first.");
      return;
    }

    if (!apiEndpoint.trim()) {
      setApiError("API endpoint is required.");
      return;
    }

    const duplicate = projectApis.some(
      (api) =>
        api.method === apiMethod &&
        api.endpoint === apiEndpoint.trim()
    );

    if (duplicate) {
      setApiError(
        "This API endpoint already exists in the project."
      );
      return;
    }

    setApiLoading(true);

    try {
      const newApi = await createProjectApi({
        project_id: projectId,
        method: apiMethod,
        endpoint: apiEndpoint.trim(),
        request_body: apiRequestBody.trim(),
      });

      setProjectApis((previous) => [
        ...previous,
        newApi,
      ]);

      setApiMethod("GET");
      setApiEndpoint("");
      setApiRequestBody("");
    } catch (error) {
      setApiError(
        error.message || "Failed to create API."
      );
    } finally {
      setApiLoading(false);
    }
  };

  // =====================================================
  // FILE
  // =====================================================

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    setUploadError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  // =====================================================
  // PARSE OPENAPI
  // =====================================================

  const parseOpenApiFile = async (file) => {
    const text = await file.text();

    if (
      file.name.toLowerCase().endsWith(".yaml") ||
      file.name.toLowerCase().endsWith(".yml")
    ) {
      return yaml.load(text);
    }

    return JSON.parse(text);
  };

  // =====================================================
  // EXTRACT APIS
  // =====================================================

  const extractApisFromSpec = (spec) => {
    const endpoints = [];

    if (!spec?.paths) {
      return endpoints;
    }

    const methods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
    ];

    Object.entries(spec.paths).forEach(
      ([path, pathItem]) => {
        if (
          !pathItem ||
          typeof pathItem !== "object"
        ) {
          return;
        }

        methods.forEach((method) => {
          const operation = pathItem[method];

          if (!operation) return;

          let requestBody = "";

          if (operation.requestBody) {
            const content =
              operation.requestBody.content || {};

            const jsonContent =
              content["application/json"];

            if (jsonContent?.schema) {
              requestBody = JSON.stringify(
                jsonContent.schema,
                null,
                2
              );
            }
          }

          endpoints.push({
            method: method.toUpperCase(),
            endpoint: path,
            request_body: requestBody,
          });
        });
      }
    );

    return endpoints;
  };

  // =====================================================
  // IMPORT OPENAPI
  // =====================================================

  const handleImportOpenApi = async () => {
    setUploadError("");

    if (!projectId) {
      setUploadError(
        "Please create or select a project first."
      );
      return;
    }

    if (!selectedFile) {
      setUploadError(
        "Please select an OpenAPI JSON or YAML file."
      );
      return;
    }

    setUploading(true);

    try {
      const spec = await parseOpenApiFile(selectedFile);

      if (!spec?.openapi && !spec?.swagger) {
        throw new Error(
          "The uploaded file does not appear to be a valid OpenAPI or Swagger specification."
        );
      }

      const extractedApis =
        extractApisFromSpec(spec);

      if (extractedApis.length === 0) {
        throw new Error(
          "No API endpoints were found in the OpenAPI specification."
        );
      }

      const uniqueImportedApis = [];
      const seen = new Set();

      extractedApis.forEach((api) => {
        const key =
          `${api.method}:${api.endpoint}`;

        if (!seen.has(key)) {
          seen.add(key);
          uniqueImportedApis.push(api);
        }
      });

      const existingKeys = new Set(
        projectApis.map(
          (api) =>
            `${api.method}:${api.endpoint}`
        )
      );

      const newApis =
        uniqueImportedApis.filter(
          (api) =>
            !existingKeys.has(
              `${api.method}:${api.endpoint}`
            )
        );

      let savedApis = [];

      if (newApis.length > 0) {
        const apisForDatabase =
          newApis.map((api) => ({
            project_id: projectId,
            method: api.method,
            endpoint: api.endpoint,
            request_body:
              api.request_body || "",
          }));

        savedApis =
          await createProjectApis(
            apisForDatabase
          );
      }

      setOpenApiSpec(spec);
      setImportedApis(uniqueImportedApis);

      if (savedApis.length > 0) {
        setProjectApis((previous) => [
          ...previous,
          ...savedApis,
        ]);
      }
    } catch (error) {
      console.error(
        "OpenAPI import error:",
        error
      );

      setUploadError(
        error.message ||
          "Failed to import OpenAPI specification."
      );
    } finally {
      setUploading(false);
    }
  };

  // =====================================================
  // LANGUAGE
  // =====================================================

  const handleLanguageChange = (language) => {
    setTargetLanguage(language);

    if (language === "Python") {
      setTargetFramework("Pytest");
    }

    if (language === "Node.js") {
      setTargetFramework("Jest");
    }

    if (language === "Spring Boot") {
      setTargetFramework("JUnit");
    }

    setGeneratedCode("");
    setGeneratedFilename("");
    setGenerateError("");
  };

  // =====================================================
  // GENERATE
  // =====================================================

  const generateTestCode = async () => {
    setGenerateError("");

    if (!projectId) {
      setGenerateError(
        "Please create or open a project first."
      );
      return;
    }

    if (!openApiSpec) {
      setGenerateError(
        "Please upload an OpenAPI specification first."
      );
      return;
    }

    if (importedApis.length === 0) {
      setGenerateError(
        "No API endpoints are available for generation."
      );
      return;
    }

    setGenerating(true);
    setGeneratedCode("");
    setGeneratedFilename("");

    try {
      const result =
        await generateTestsWithAI(
          openApiSpec,
          targetLanguage,
          targetFramework
        );

      if (!result?.generatedCode) {
        throw new Error(
          "The AI service did not return generated test code."
        );
      }

      let filename = "generated_tests.txt";

      if (targetLanguage === "Python") {
        filename = "test_api.py";
      }

      if (targetLanguage === "Node.js") {
        filename = "api.test.js";
      }

      if (targetLanguage === "Spring Boot") {
        filename = "ApiTest.java";
      }

      setGeneratedCode(result.generatedCode);
      setGeneratedFilename(
        result.filename || filename
      );
    } catch (error) {
      console.error(
        "Generation error:",
        error
      );

      setGenerateError(
        error.message ||
          "Failed to generate test code."
      );
    } finally {
      setGenerating(false);
    }
  };

  // =====================================================
  // DOWNLOAD
  // =====================================================

  const handleDownload = () => {
    if (!generatedCode) return;

    const blob = new Blob(
      [generatedCode],
      {
        type: "text/plain;charset=utf-8",
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download =
      generatedFilename ||
      "generated_tests.txt";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (authLoading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  // =====================================================
  // LOGIN / REGISTER
  // =====================================================

  if (!loggedIn) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-card">
            {!showRegister ? (
              <>
                <div className="auth-logo">
                  ✦
                </div>

                <h1>
                  AI API Test Generator
                </h1>

                <p>
                  Generate intelligent API test
                  code from OpenAPI specifications.
                </p>

                <form
                  onSubmit={handleLogin}
                  className="auth-form"
                >
                  <label>Email</label>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="Enter your email"
                    required
                  />

                  <label>Password</label>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    required
                  />

                  {loginError && (
                    <div className="error-message">
                      {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loggingIn}
                  >
                    {loggingIn
                      ? "Signing in..."
                      : "Sign In →"}
                  </button>
                </form>

                <p className="auth-switch">
                  Don't have an account?

                  <button
                    type="button"
                    onClick={() => {
                      setShowRegister(true);
                      setLoginError("");
                    }}
                  >
                    Create account
                  </button>
                </p>
              </>
            ) : (
              <>
                <div className="auth-logo">
                  ✦
                </div>

                <h1>Create Account</h1>

                <p>
                  Start generating API tests
                  with AI.
                </p>

                <form
                  onSubmit={handleRegister}
                  className="auth-form"
                >
                  <label>Name</label>

                  <input
                    type="text"
                    value={registerName}
                    onChange={(event) =>
                      setRegisterName(
                        event.target.value
                      )
                    }
                    placeholder="Your name"
                    required
                  />

                  <label>Email</label>

                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(event) =>
                      setRegisterEmail(
                        event.target.value
                      )
                    }
                    placeholder="Your email"
                    required
                  />

                  <label>Password</label>

                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(event) =>
                      setRegisterPassword(
                        event.target.value
                      )
                    }
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />

                  {registerError && (
                    <div className="error-message">
                      {registerError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={registering}
                  >
                    {registering
                      ? "Creating..."
                      : "Create Account →"}
                  </button>
                </form>

                <p className="auth-switch">
                  Already have an account?

                  <button
                    type="button"
                    onClick={() => {
                      setShowRegister(false);
                      setRegisterError("");
                    }}
                  >
                    Sign in
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // MAIN DASHBOARD
  // =====================================================

  return (
    <div className="app dashboard-app">

      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">✦</div>

          <div>
            <strong>API Test AI</strong>
            <span>Generator</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="sidebar-link active">
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className="sidebar-link"
            onClick={() => {
              document
                .getElementById("projects-section")
                ?.scrollIntoView({
                  behavior: "smooth",
                });
            }}
          >
            <span>▣</span>
            Projects
          </button>

          <button
            className="sidebar-link"
            onClick={() => {
              document
                .getElementById("apis-section")
                ?.scrollIntoView({
                  behavior: "smooth",
                });
            }}
          >
            <span>⌘</span>
            API Endpoints
          </button>

          <button
            className="sidebar-link"
            onClick={() => {
              document
                .getElementById("generation-section")
                ?.scrollIntoView({
                  behavior: "smooth",
                });
            }}
          >
            <span>✧</span>
            AI Generator
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">
              {(user?.email || "U")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {user?.user_metadata?.name ||
                  "User"}
              </strong>

              <span>
                {user?.email}
              </span>
            </div>
          </div>

          <button
            className="sidebar-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}

      <main className="dashboard-main">

        {/* TOP BAR */}

        <header className="dashboard-header">
          <div>
            <span className="eyebrow">
              WORKSPACE
            </span>

            <h1>
              API Test Generator
            </h1>

            <p>
              Turn your OpenAPI specification
              into executable test code.
            </p>
          </div>

          <div className="header-project">
            <span>Current project</span>

            <strong>
              {projectName ||
                "No project selected"}
            </strong>
          </div>
        </header>

        {/* STATS */}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">▣</div>

            <div>
              <span>Projects</span>
              <strong>{projects.length}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⌘</div>

            <div>
              <span>API Endpoints</span>
              <strong>
                {projectApis.length}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✦</div>

            <div>
              <span>Imported</span>
              <strong>
                {importedApis.length}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✓</div>

            <div>
              <span>Generated</span>
              <strong>
                {generatedCode ? "1" : "0"}
              </strong>
            </div>
          </div>
        </section>

        {/* PROJECTS */}

        <section
          id="projects-section"
          className="workspace-card"
        >
          <div className="workspace-card-header">
            <div>
              <span className="step-number">
                PROJECT
              </span>

              <h2>
                Your Projects
              </h2>

              <p>
                Select a project or create a
                new workspace.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => {
                setShowCreateProject(
                  !showCreateProject
                );
                setProjectError("");
              }}
            >
              {showCreateProject
                ? "Cancel"
                : "+ New Project"}
            </button>
          </div>

          {showCreateProject && (
            <form
              onSubmit={handleCreateProject}
              className="create-project-panel"
            >
              <input
                type="text"
                value={projectName}
                onChange={(event) => {
                  setProjectName(
                    event.target.value
                  );
                  setProjectError("");
                }}
                placeholder="Project name"
                required
              />

              <textarea
                value={projectDescription}
                onChange={(event) =>
                  setProjectDescription(
                    event.target.value
                  )
                }
                placeholder="Project description"
              />

              <button
                className="primary-button"
                type="submit"
                disabled={projectLoading}
              >
                {projectLoading
                  ? "Creating..."
                  : "Create Project"}
              </button>
            </form>
          )}

          {projectError && (
            <div className="error-message">
              {projectError}
            </div>
          )}

          <div className="project-grid">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={
                  project.id === projectId
                    ? "project-card selected"
                    : "project-card"
                }
                onClick={() =>
                  handleSelectProject(
                    project.id
                  )
                }
              >
                <div className="project-card-icon">
                  {project.name
                    ?.charAt(0)
                    ?.toUpperCase() || "P"}
                </div>

                <div>
                  <strong>
                    {project.name}
                  </strong>

                  <span>
                    {project.description ||
                      "API testing workspace"}
                  </span>
                </div>

                {project.id === projectId && (
                  <span className="selected-badge">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>

          {projects.length === 0 &&
            !projectLoading && (
              <div className="empty-state">
                <span>+</span>
                <strong>
                  Create your first project
                </strong>
                <p>
                  Start by creating a workspace
                  for your API tests.
                </p>
              </div>
            )}
        </section>

        {/* API ENDPOINTS */}

        {projectId && (
          <section
            id="apis-section"
            className="workspace-card"
          >
            <div className="workflow-heading">
              <div className="workflow-step-badge">
                01
              </div>

              <div>
                <span className="eyebrow">
                  API SETUP
                </span>

                <h2>
                  API Endpoints
                </h2>

                <p>
                  Add endpoints manually or
                  import them from OpenAPI.
                </p>
              </div>
            </div>

            <div className="endpoint-toolbar">
              <select
                value={apiMethod}
                onChange={(event) => {
                  setApiMethod(
                    event.target.value
                  );
                  setApiError("");
                }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">
                  PATCH
                </option>
                <option value="DELETE">
                  DELETE
                </option>
              </select>

              <input
                value={apiEndpoint}
                onChange={(event) => {
                  setApiEndpoint(
                    event.target.value
                  );
                  setApiError("");
                }}
                placeholder="/users"
              />

              <input
                value={apiRequestBody}
                onChange={(event) =>
                  setApiRequestBody(
                    event.target.value
                  )
                }
                placeholder="Request body (optional)"
              />

              <button
                className="secondary-button"
                onClick={handleCreateApi}
                disabled={apiLoading}
              >
                {apiLoading
                  ? "Adding..."
                  : "Add API"}
              </button>
            </div>

            {apiError && (
              <div className="error-message">
                {apiError}
              </div>
            )}

            <div className="endpoint-list">
              {projectApis.map((api) => (
                <div
                  key={api.id}
                  className="endpoint-row"
                >
                  <span
                    className={`method-badge method-${api.method.toLowerCase()}`}
                  >
                    {api.method}
                  </span>

                  <span className="endpoint-path">
                    {api.endpoint}
                  </span>
                </div>
              ))}

              {projectApis.length === 0 && (
                <div className="empty-inline">
                  No API endpoints yet.
                </div>
              )}
            </div>
          </section>
        )}

        {/* OPENAPI IMPORT */}

        {projectId && (
          <section className="workflow-layout">

            <div className="workflow-number">
              02
            </div>

            <div className="workflow-content">
              <div className="workflow-heading">
                <div>
                  <span className="eyebrow">
                    OPENAPI
                  </span>

                  <h2>
                    Import Specification
                  </h2>

                  <p>
                    Upload your JSON or YAML
                    specification and let the
                    generator analyze your APIs.
                  </p>
                </div>
              </div>

              <div className="upload-card">
                <div className="upload-icon">
                  ↑
                </div>

                <h3>
                  Upload OpenAPI file
                </h3>

                <p>
                  Supported formats: JSON,
                  YAML, and YML
                </p>

                <label className="file-button">
                  Choose File

                  <input
                    type="file"
                    accept=".json,.yaml,.yml"
                    onChange={handleFileChange}
                  />
                </label>

                {selectedFile && (
                  <div className="selected-file">
                    <span>✓</span>

                    <strong>
                      {selectedFile.name}
                    </strong>
                  </div>
                )}

                <button
                  className="primary-button"
                  type="button"
                  onClick={handleImportOpenApi}
                  disabled={
                    uploading ||
                    !selectedFile
                  }
                >
                  {uploading
                    ? "Importing..."
                    : "Import OpenAPI →"}
                </button>
              </div>

              {uploadError && (
                <div className="error-message">
                  {uploadError}
                </div>
              )}

              {importedApis.length > 0 && (
                <div className="import-result">
                  <div className="import-result-header">
                    <div>
                      <span className="eyebrow">
                        DETECTED
                      </span>

                      <h3>
                        {importedApis.length} API
                        endpoints found
                      </h3>
                    </div>

                    <span className="count-badge">
                      {importedApis.length}
                    </span>
                  </div>

                  <div className="endpoint-list">
                    {importedApis.map(
                      (api, index) => (
                        <div
                          key={`${api.method}-${api.endpoint}-${index}`}
                          className="endpoint-row"
                        >
                          <span
                            className={`method-badge method-${api.method.toLowerCase()}`}
                          >
                            {api.method}
                          </span>

                          <span className="endpoint-path">
                            {api.endpoint}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* GENERATION */}

        {projectId && openApiSpec && (
          <section
            id="generation-section"
            className="generation-workspace"
          >
            <div className="workflow-number">
              03
            </div>

            <div className="workflow-content">

              <div className="generation-top">
                <div>
                  <span className="eyebrow">
                    AI GENERATION
                  </span>

                  <h2>
                    Generate Test Code
                  </h2>

                  <p>
                    Choose your target stack and
                    generate a complete test file.
                  </p>
                </div>

                <div className="ai-status">
                  <span className="status-dot"></span>
                  AI Ready
                </div>
              </div>

              <div className="generation-options">
                <div className="option-card">
                  <span>
                    Target Language
                  </span>

                  <select
                    value={targetLanguage}
                    onChange={(event) =>
                      handleLanguageChange(
                        event.target.value
                      )
                    }
                  >
                    <option value="Python">
                      Python
                    </option>

                    <option value="Node.js">
                      Node.js
                    </option>

                    <option value="Spring Boot">
                      Spring Boot
                    </option>
                  </select>
                </div>

                <div className="option-card">
                  <span>
                    Testing Framework
                  </span>

                  <select
                    value={targetFramework}
                    onChange={(event) => {
                      setTargetFramework(
                        event.target.value
                      );

                      setGeneratedCode("");
                      setGeneratedFilename("");
                      setGenerateError("");
                    }}
                  >
                    {targetLanguage ===
                      "Python" && (
                      <>
                        <option value="Pytest">
                          Pytest
                        </option>

                        <option value="Unittest">
                          Unittest
                        </option>
                      </>
                    )}

                    {targetLanguage ===
                      "Node.js" && (
                      <>
                        <option value="Jest">
                          Jest
                        </option>

                        <option value="Mocha">
                          Mocha
                        </option>
                      </>
                    )}

                    {targetLanguage ===
                      "Spring Boot" && (
                      <>
                        <option value="JUnit">
                          JUnit
                        </option>

                        <option value="Mockito">
                          Mockito
                        </option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <button
                className="generate-button"
                type="button"
                onClick={generateTestCode}
                disabled={
                  generating ||
                  importedApis.length === 0
                }
              >
                <span>✦</span>

                {generating
                  ? "Generating AI Test Code..."
                  : "Generate AI Test Code"}
              </button>

              {generateError && (
                <div className="error-message">
                  {generateError}
                </div>
              )}

              {generatedCode && (
                <div className="generated-code-section">
                  <div className="generated-code-header">
                    <div>
                      <span className="eyebrow">
                        GENERATED FILE
                      </span>

                      <h3>
                        {generatedFilename}
                      </h3>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={handleDownload}
                    >
                      ↓ Download
                    </button>
                  </div>

                  <div className="code-window">
                    <div className="code-window-bar">
                      <span></span>
                      <span></span>
                      <span></span>

                      <label>
                        {generatedFilename}
                      </label>
                    </div>

                    <pre className="code-output">
                      <code>
                        {generatedCode}
                      </code>
                    </pre>
                  </div>
                </div>
              )}

            </div>
          </section>
        )}

      </main>
    </div>
  );
}

export default App;