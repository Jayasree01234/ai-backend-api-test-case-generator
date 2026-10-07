import { useEffect, useState } from "react";
import * as yaml from "js-yaml";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ApiEndpoints from "./pages/ApiEndpoints";
import AiGenerator from "./pages/AiGenerator";
import GenerationHistory from "./pages/GenerationHistory";

import { generateTestsWithAI } from "./services/aiService";
import {
  saveGeneration,
  getProjectGenerations,
} from "./services/generationService";
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
  // NAVIGATION
  // =====================================================

  const [activePage, setActivePage] = useState("dashboard");

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

  const [generations, setGenerations] = useState([]);
const [generationLoading, setGenerationLoading] = useState(false);

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
// LOAD GENERATION HISTORY
// =====================================================

useEffect(() => {
  if (!projectId) {
    setGenerations([]);
    return;
  }

  async function loadGenerations() {
    setGenerationLoading(true);

    try {
      const data = await getProjectGenerations(projectId);
      setGenerations(data || []);
    } catch (error) {
      console.error(
        "Generation history loading error:",
        error
      );
    } finally {
      setGenerationLoading(false);
    }
  }

  loadGenerations();
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

      setActivePage("dashboard");
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
    const result = await generateTestsWithAI(
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

    const finalFilename =
      result.filename || filename;

    // Show generated result in the UI
    setGeneratedCode(result.generatedCode);
    setGeneratedFilename(finalFilename);

    // Save generation history in Supabase
    await saveGeneration({
      projectId,
      openapiFilename:
        selectedFile?.name || "OpenAPI specification",
      language: targetLanguage,
      framework: targetFramework,
      generatedFilename: finalFilename,
      generatedCode: result.generatedCode,
    });

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

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

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
  // MAIN APPLICATION
  // =====================================================

  return (
    <div className="app dashboard-app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="sidebar-brand">
          <div className="brand-icon">
            ✦
          </div>

          <div>
            <strong>API Test AI</strong>
            <span>Generator</span>
          </div>
        </div>

        <nav className="sidebar-nav">

          <button
            className={`sidebar-link ${
              activePage === "dashboard"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("dashboard")
            }
          >
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className={`sidebar-link ${
              activePage === "projects"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("projects")
            }
          >
            <span>▣</span>
            Projects
          </button>

          <button
            className={`sidebar-link ${
              activePage === "apis"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("apis")
            }
          >
            <span>⌘</span>
            API Endpoints
          </button>

          <button
            className={`sidebar-link ${
              activePage === "generator"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("generator")
            }
          >
            <span>✧</span>
            AI Generator
          </button>
          <button
  className={`sidebar-link ${
    activePage === "history"
      ? "active"
      : ""
  }`}
  onClick={() =>
    setActivePage("history")
  }
>
  <span>◷</span>
  Generation History
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

      {/* MAIN CONTENT */}

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
            handleSelectProject={(project) =>
              handleSelectProject(project.id)
            }
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
            handleSelectProject={(project) =>
              handleSelectProject(project.id)
            }
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
            selectedFile={selectedFile}
            setTargetFramework={setTargetFramework}
            handleLanguageChange={handleLanguageChange}
            generateTestCode={generateTestCode}
            handleDownload={handleDownload}
          />
        )}

      </main>
    </div>
  );
}

export default App;