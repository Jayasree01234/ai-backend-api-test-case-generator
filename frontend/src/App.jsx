
import { useEffect, useState } from "react";
import * as yaml from "js-yaml";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ApiEndpoints from "./pages/ApiEndpoints";
import AiGenerator from "./pages/AiGenerator";
import GenerationHistory from "./pages/GenerationHistory";

import { generateTestsWithAI } from "./services/aiService";
import { saveGeneration, getProjectGenerations } from "./services/generationService";
import { registerUser, loginUser, logoutUser, getCurrentUser } from "./services/authService";
import { getProjects, createProject, getProjectApis, createProjectApi, createProjectApis } from "./services/projectService";

import "./App.css";

function readStoredValue(key, fallbackValue) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallbackValue : JSON.parse(value);
  } catch (error) {
    console.error(`Could not read ${key}:`, error);
    return fallbackValue;
  }
}

function writeStoredValue(key, value) {
  try {
    if (value === null || value === undefined || value === "") {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.error(`Could not save ${key}:`, error);
  }
}

function App() {
  const [activePage, setActivePage] = useState(() =>
    readStoredValue("api_test_ai_last_page", "dashboard")
  );

  useEffect(() => {
    writeStoredValue("api_test_ai_last_page", activePage);
  }, [activePage]);

  // Authentication
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

  // Projects
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(() =>
    readStoredValue("api_test_ai_last_project_id", null)
  );
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [showCreateProject, setShowCreateProject] = useState(false);

  useEffect(() => {
    writeStoredValue("api_test_ai_last_project_id", projectId);
  }, [projectId]);

  // Manual API endpoints
  const [projectApis, setProjectApis] = useState([]);
  const [apiMethod, setApiMethod] = useState("GET");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [apiRequestBody, setApiRequestBody] = useState("");
  const [apiError, setApiError] = useState("");
  const [apiLoading, setApiLoading] = useState(false);

  // OpenAPI import
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState(() =>
    readStoredValue("api_test_ai_openapi_filename", "")
  );
  const [openApiSpec, setOpenApiSpec] = useState(() =>
    readStoredValue("api_test_ai_openapi_spec", null)
  );
  const [importedApis, setImportedApis] = useState(() =>
    readStoredValue("api_test_ai_imported_apis", [])
  );
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    writeStoredValue("api_test_ai_openapi_filename", selectedFileName);
  }, [selectedFileName]);

  useEffect(() => {
    writeStoredValue("api_test_ai_openapi_spec", openApiSpec);
  }, [openApiSpec]);

  useEffect(() => {
    writeStoredValue("api_test_ai_imported_apis", importedApis);
  }, [importedApis]);

  const displaySelectedFile =
    selectedFile || (selectedFileName ? { name: selectedFileName } : null);

  // Test generation and AI results
  const [targetLanguage, setTargetLanguage] = useState("Python");
  const [targetFramework, setTargetFramework] = useState("Pytest");
  const [generatedCode, setGeneratedCode] = useState(() =>
    readStoredValue("api_test_ai_generated_code", "")
  );
  const [generatedFilename, setGeneratedFilename] = useState(() =>
    readStoredValue("api_test_ai_generated_filename", "")
  );
  const [generations, setGenerations] = useState([]);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [aiProgress, setAiProgress] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalysisIdeas, setAiAnalysisIdeas] = useState([]);

  useEffect(() => {
    writeStoredValue("api_test_ai_generated_code", generatedCode);
  }, [generatedCode]);

  useEffect(() => {
    writeStoredValue("api_test_ai_generated_filename", generatedFilename);
  }, [generatedFilename]);

  // Restore local session
  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setLoggedIn(true);
        }
      } catch (error) {
        console.error("Session loading error:", error);
      } finally {
        setAuthLoading(false);
      }
    }
    loadUser();
  }, []);

  // Load projects
  useEffect(() => {
    if (!loggedIn) {
      setProjects([]);
      return;
    }

    async function loadProjects() {
      setProjectLoading(true);
      setProjectError("");
      try {
        const data = await getProjects();
        const projectList = data || [];
        setProjects(projectList);

        const selected =
          projectList.find((project) => String(project.id) === String(projectId)) ||
          projectList[0] ||
          null;

        if (selected) {
          setProjectId(selected.id);
          setProjectName(selected.name || "");
          setProjectDescription(selected.description || "");
        } else {
          setProjectId(null);
          setProjectName("");
          setProjectDescription("");
        }
      } catch (error) {
        console.error("Project loading error:", error);
        setProjectError(error.message || "Failed to load projects.");
      } finally {
        setProjectLoading(false);
      }
    }

    loadProjects();
    // Initial load after login; selection changes are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // Load APIs
  useEffect(() => {
    if (!projectId || !loggedIn) {
      setProjectApis([]);
      return;
    }

    async function loadApis() {
      try {
        setProjectApis((await getProjectApis(projectId)) || []);
      } catch (error) {
        console.error("API endpoint loading error:", error);
      }
    }

    loadApis();
  }, [projectId, loggedIn]);

  // Load history
  useEffect(() => {
    if (!projectId || !loggedIn) {
      setGenerations([]);
      return;
    }

    async function loadGenerations() {
      setGenerationLoading(true);
      try {
        setGenerations((await getProjectGenerations(projectId)) || []);
      } catch (error) {
        console.error("Generation history loading error:", error);
      } finally {
        setGenerationLoading(false);
      }
    }

    loadGenerations();
  }, [projectId, loggedIn]);

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

  const handleRegister = async (event) => {
    event.preventDefault();
    setRegisterError("");
    setRegistering(true);

    try {
      await registerUser(registerName, registerEmail, registerPassword);
      setShowRegister(false);
      setRegisterName("");
      setRegisterPassword("");
      setEmail(registerEmail.trim());
      setRegisterEmail("");
      alert("Account created in this browser. Please sign in.");
    } catch (error) {
      setRegisterError(error.message || "Registration failed.");
    } finally {
      setRegistering(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
      setLoggedIn(false);
      setEmail("");
      setPassword("");
      setActivePage("dashboard");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const clearProjectWorkspace = () => {
    setSelectedFile(null);
    setSelectedFileName("");
    setOpenApiSpec(null);
    setImportedApis([]);
    setGeneratedCode("");
    setGeneratedFilename("");
    setAiProgress("");
    setAiAnalysis(null);
    setAiAnalysisIdeas([]);
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();

    if (!projectName.trim()) {
      setProjectError("Project name is required.");
      return;
    }

    setProjectLoading(true);
    setProjectError("");

    try {
      const newProject = await createProject(
        projectName.trim(),
        projectDescription.trim()
      );

      setProjects((previous) => [newProject, ...previous]);
      setProjectId(newProject.id);
      setProjectApis([]);
      setGenerations([]);
      clearProjectWorkspace();
      setProjectName("");
      setProjectDescription("");
      setShowCreateProject(false);
    } catch (error) {
      setProjectError(error.message || "Failed to create project.");
    } finally {
      setProjectLoading(false);
    }
  };

  const handleSelectProject = (id) => {
    const selected = projects.find((project) => String(project.id) === String(id));
    setProjectId(id);

    if (selected) {
      setProjectName(selected.name || "");
      setProjectDescription(selected.description || "");
    }

    setApiError("");
    setUploadError("");
    setGenerateError("");
    clearProjectWorkspace();
  };

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

    const endpoint = apiEndpoint.trim().startsWith("/")
      ? apiEndpoint.trim()
      : `/${apiEndpoint.trim()}`;

    const duplicate = projectApis.some(
      (api) =>
        String(api.method).toUpperCase() === apiMethod.toUpperCase() &&
        api.endpoint === endpoint
    );

    if (duplicate) {
      setApiError("This API endpoint already exists in the project.");
      return;
    }

    setApiLoading(true);
    try {
      const newApi = await createProjectApi({
        project_id: projectId,
        method: apiMethod,
        endpoint,
        request_body: apiRequestBody.trim(),
      });
      setProjectApis((previous) => [...previous, newApi]);
      setApiMethod("GET");
      setApiEndpoint("");
      setApiRequestBody("");
    } catch (error) {
      setApiError(error.message || "Failed to create API endpoint.");
    } finally {
      setApiLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setUploadError("");
    setSelectedFile(file);
    setSelectedFileName(file?.name || "");

    if (!file) {
      setOpenApiSpec(null);
      setImportedApis([]);
    }
  };

  const parseOpenApiFile = async (file) => {
    const content = await file.text();
    const filename = file.name.toLowerCase();

    if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
      return yaml.load(content);
    }
    return JSON.parse(content);
  };

  const extractApisFromSpec = (spec) => {
    const endpoints = [];
    if (!spec?.paths || typeof spec.paths !== "object") return endpoints;

    const methods = ["get", "post", "put", "patch", "delete", "options", "head"];

    Object.entries(spec.paths).forEach(([path, pathItem]) => {
      if (!pathItem || typeof pathItem !== "object") return;

      methods.forEach((method) => {
        const operation = pathItem[method];
        if (!operation || typeof operation !== "object") return;

        const schema =
          operation.requestBody?.content?.["application/json"]?.schema;

        endpoints.push({
          method: method.toUpperCase(),
          endpoint: path,
          request_body: schema ? JSON.stringify(schema, null, 2) : "",
        });
      });
    });

    return endpoints;
  };

  const handleImportOpenApi = async () => {
    setUploadError("");

    if (!projectId) {
      setUploadError("Please create or select a project first.");
      return;
    }
    if (!selectedFile) {
      setUploadError("Please select an OpenAPI JSON or YAML file.");
      return;
    }

    setUploading(true);
    try {
      const spec = await parseOpenApiFile(selectedFile);

      if (!spec || (!spec.openapi && !spec.swagger)) {
        throw new Error("The file is not a valid OpenAPI or Swagger specification.");
      }

      const extracted = extractApisFromSpec(spec);
      if (!extracted.length) {
        throw new Error("No supported API endpoints were found.");
      }

      const unique = [];
      const seen = new Set();

      extracted.forEach((api) => {
        const key = `${api.method}:${api.endpoint}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(api);
        }
      });

      const existing = new Set(
        projectApis.map(
          (api) => `${String(api.method).toUpperCase()}:${api.endpoint}`
        )
      );

      const newApis = unique.filter(
        (api) => !existing.has(`${api.method}:${api.endpoint}`)
      );

      let savedApis = [];
      if (newApis.length) {
        savedApis = await createProjectApis(
          newApis.map((api) => ({
            project_id: projectId,
            method: api.method,
            endpoint: api.endpoint,
            request_body: api.request_body || "",
          }))
        );
      }

      setOpenApiSpec(spec);
      setImportedApis(unique);
      if (savedApis.length) {
        setProjectApis((previous) => [...previous, ...savedApis]);
      }
    } catch (error) {
      console.error("OpenAPI import error:", error);
      setUploadError(error.message || "Failed to import OpenAPI specification.");
    } finally {
      setUploading(false);
    }
  };

  const handleLanguageChange = (language) => {
    setTargetLanguage(language);

    if (language === "Python") setTargetFramework("Pytest");
    else if (language === "Node.js") setTargetFramework("Jest");
    else if (language === "Spring Boot") setTargetFramework("JUnit");

    setGeneratedCode("");
    setGeneratedFilename("");
    setGenerateError("");
    setAiProgress("");
    setAiAnalysis(null);
    setAiAnalysisIdeas([]);
  };

  const generateTestCode = async () => {
    setGenerateError("");
    setAiProgress("");
    setAiAnalysis(null);
    setAiAnalysisIdeas([]);

    if (!projectId) {
      setGenerateError("Please create or open a project first.");
      return;
    }
    if (!openApiSpec) {
      setGenerateError("Please upload and import an OpenAPI specification first.");
      return;
    }
    if (!importedApis.length) {
      setGenerateError("No API endpoints are available for generation.");
      return;
    }

    setGenerating(true);
    setGeneratedCode("");
    setGeneratedFilename("");
    setAiProgress("Preparing browser AI...");

    try {
      const result = await generateTestsWithAI(
        openApiSpec,
        targetLanguage,
        targetFramework,
        (message) => setAiProgress(message)
      );

      if (!result?.generatedCode) {
        throw new Error("The test generator did not return any code.");
      }

      const fallbackNames = {
        Python: "test_api.py",
        "Node.js": "api.test.js",
        "Spring Boot": "ApiTest.java",
      };

      const filename =
        result.filename || fallbackNames[targetLanguage] || "generated_tests.txt";

      setGeneratedCode(result.generatedCode);
      setGeneratedFilename(filename);
      setAiAnalysis(result.aiOverview || null);
      setAiAnalysisIdeas(result.additionalTestIdeas || []);
      setAiProgress("Generation completed.");

      const savedGeneration = await saveGeneration({
        projectId,
        openapiFilename: selectedFileName || "OpenAPI specification",
        language: targetLanguage,
        framework: targetFramework,
        generatedFilename: filename,
        generatedCode: result.generatedCode,
      });

      setGenerations((previous) => [
        savedGeneration,
        ...previous.filter((item) => item.id !== savedGeneration.id),
      ]);
    } catch (error) {
      console.error("Test-code generation error:", error);
      setGenerateError(error.message || "Failed to generate test code.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedCode) return;

    const blob = new Blob([generatedCode], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = generatedFilename || "generated_tests.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (authLoading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-card">
            {!showRegister ? (
              <>
                <div className="auth-logo">✦</div>
                <h1>API Test AI Generator</h1>
                <p>Generate test-code files from OpenAPI specifications.</p>

                <form onSubmit={handleLogin} className="auth-form">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                  />

                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />

                  {loginError && <div className="error-message">{loginError}</div>}

                  <button type="submit" disabled={loggingIn}>
                    {loggingIn ? "Signing in..." : "Sign In →"}
                  </button>
                </form>

                <p className="auth-switch">
                  Don't have an account?{" "}
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
                <div className="auth-logo">✦</div>
                <h1>Create Account</h1>
                <p>Create a local account for this browser.</p>

                <form onSubmit={handleRegister} className="auth-form">
                  <label>Name</label>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(event) => setRegisterName(event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />

                  <label>Email</label>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    placeholder="Your email"
                    autoComplete="email"
                    required
                  />

                  <label>Password</label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />

                  {registerError && (
                    <div className="error-message">{registerError}</div>
                  )}

                  <button type="submit" disabled={registering}>
                    {registering ? "Creating..." : "Create Account →"}
                  </button>
                </form>

                <p className="auth-switch">
                  Already have an account?{" "}
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

  return (
    <div className="app dashboard-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">✦</div>
          <div>
            <strong>API Test AI</strong>
            <span>Generator</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className={`sidebar-link ${activePage === "dashboard" ? "active" : ""}`} onClick={() => setActivePage("dashboard")}>
            <span>⌂</span> Dashboard
          </button>
          <button className={`sidebar-link ${activePage === "projects" ? "active" : ""}`} onClick={() => setActivePage("projects")}>
            <span>▣</span> Projects
          </button>
          <button className={`sidebar-link ${activePage === "apis" ? "active" : ""}`} onClick={() => setActivePage("apis")}>
            <span>⌘</span> API Endpoints
          </button>
          <button className={`sidebar-link ${activePage === "generator" ? "active" : ""}`} onClick={() => setActivePage("generator")}>
            <span>✧</span> Test Generator
          </button>
          <button className={`sidebar-link ${activePage === "history" ? "active" : ""}`} onClick={() => setActivePage("history")}>
            <span>◷</span> Generation History
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">
              {(user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{user?.user_metadata?.name || "User"}</strong>
              <span>{user?.email}</span>
            </div>
          </div>

          <button className="sidebar-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        {activePage === "dashboard" && (
          <Dashboard
            projects={projects}
            projectApis={projectApis}
            openApiSpec={openApiSpec}
            generatedCode={generatedCode}
          />
        )}

        {activePage === "projects" && (
          <Projects
            projects={projects}
            projectId={projectId}
            projectName={projectName}
            projectDescription={projectDescription}
            projectLoading={projectLoading}
            projectError={projectError}
            showCreateProject={showCreateProject}
            setProjectName={setProjectName}
            setProjectDescription={setProjectDescription}
            setShowCreateProject={setShowCreateProject}
            handleCreateProject={handleCreateProject}
            handleSelectProject={(project) => handleSelectProject(project.id)}
          />
        )}

        {activePage === "history" && (
          <GenerationHistory
            generations={generations}
            projectId={projectId}
            projects={projects}
            loading={generationLoading}
          />
        )}

        {activePage === "apis" && (
          <ApiEndpoints
            projects={projects}
            projectId={projectId}
            projectApis={projectApis}
            apiMethod={apiMethod}
            apiEndpoint={apiEndpoint}
            apiRequestBody={apiRequestBody}
            apiError={apiError}
            apiLoading={apiLoading}
            selectedFile={selectedFile}
            importedApis={importedApis}
            uploadError={uploadError}
            uploading={uploading}
            setApiMethod={setApiMethod}
            setApiEndpoint={setApiEndpoint}
            setApiRequestBody={setApiRequestBody}
            handleCreateApi={handleCreateApi}
            handleFileChange={handleFileChange}
            handleImportOpenApi={handleImportOpenApi}
            handleSelectProject={(project) => handleSelectProject(project.id)}
          />
        )}

        {activePage === "generator" && (
          <AiGenerator
            projects={projects}
            projectId={projectId}
            targetLanguage={targetLanguage}
            targetFramework={targetFramework}
            generatedCode={generatedCode}
            generatedFilename={generatedFilename}
            generating={generating}
            generateError={generateError}
            selectedFile={displaySelectedFile}
            setTargetFramework={setTargetFramework}
            handleLanguageChange={handleLanguageChange}
            generateTestCode={generateTestCode}
            handleDownload={handleDownload}
            aiProgress={aiProgress}
            aiAnalysis={aiAnalysis}
            aiAnalysisIdeas={aiAnalysisIdeas}
          />
        )}
      </main>
    </div>
  );
}

export default App;
