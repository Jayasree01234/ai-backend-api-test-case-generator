import { useEffect, useState } from "react";
import * as yaml from "js-yaml";
import "./App.css";
import { registerUser, loginUser } from "./services/authService";
import {
  getProjects,
  createProject as createProjectInSupabase,
  getProjectApis,
  createProjectApis,
} from "./services/projectService";
const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Python");
const [targetFramework, setTargetFramework] = useState("Pytest");

  // =====================================================
  // AUTHENTICATION
  // =====================================================

  /// Restore login session after page refresh.
  const [token, setToken] = useState(
  () => localStorage.getItem("access_token") || ""
);

const [loggedIn, setLoggedIn] = useState(
  () => !!localStorage.getItem("access_token")
);

  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Registration
  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [registering, setRegistering] = useState(false);

  // =====================================================
  // PROJECT STATE
  // =====================================================

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

 const [projectId, setProjectId] = useState(
  () => localStorage.getItem("current_project_id") || null
);

const [projectName, setProjectName] = useState(
  () => localStorage.getItem("current_project_name") || ""
);
  const [projectDescription, setProjectDescription] = useState("");

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [openingProject, setOpeningProject] = useState(false);

  const [projectError, setProjectError] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // =====================================================
  // OPENAPI STATE
  // =====================================================

  const [selectedFile, setSelectedFile] = useState(null);
  const [importedApis, setImportedApis] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");

  // =====================================================
  // TEST CASE STATE
  // =====================================================

  const [testCases, setTestCases] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  // =====================================================
  // LOAD PROJECTS AFTER LOGIN
  // =====================================================

  useEffect(() => {
    if (!loggedIn || !token) {
      return;
    }

    fetchProjects();
  }, [loggedIn, token]);

  const fetchProjects = async () => {
  setProjectsLoading(true);
  setProjectError("");

  try {
    const data = await getProjects();

    setProjects(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Fetch projects error:", error);

    setProjectError(
      error.message || "Failed to fetch projects"
    );
  } finally {
    setProjectsLoading(false);
  }
};
  // =====================================================
  // LOGIN
  // =====================================================

const handleLogin = async (event) => {
  event.preventDefault();

  setLoginError("");
  setLoggingIn(true);

  try {
    const data = await loginUser(email, password);

    const accessToken = data?.session?.access_token;

    if (!accessToken) {
      throw new Error("Login succeeded but no access token was returned.");
    }

    localStorage.setItem("access_token", accessToken);

    setToken(accessToken);
    setLoggedIn(true);

    setEmail("");
    setPassword("");

    setProjectId(null);
    setProjectName("");
    setProjectDescription("");

    setImportedApis([]);
    setTestCases([]);
  } catch (error) {
    setLoginError(
      error.message || "Login failed"
    );
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
  setRegisterSuccess("");
  setRegistering(true);

  try {
    await registerUser(
      registerName,
      registerEmail,
      registerPassword
    );

    setRegisterSuccess(
      "Registration successful! Please check your email to confirm your account."
    );

    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");

    setShowRegister(false);

    setEmail("");
    setPassword("");
    setLoginError("");
  } catch (error) {
    setRegisterError(
      error.message || "Registration failed"
    );
  } finally {
    setRegistering(false);
  }
};
  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_project_id");
    localStorage.removeItem("current_project_name");
    localStorage.removeItem("current_project_description");

    setToken("");
    setLoggedIn(false);

    setEmail("");
    setPassword("");

    setProjects([]);

    setProjectId(null);
    setProjectName("");
    setProjectDescription("");

    setImportedApis([]);
    setTestCases([]);

    setSelectedFile(null);

    setUploadMessage("");
    setUploadError("");

    setGenerateError("");
    setProjectError("");

    setShowCreateProject(false);

    // Reset registration state.
    setShowRegister(false);
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterError("");
    setRegisterSuccess("");
  };

  // =====================================================
  // CREATE PROJECT
  // =====================================================
  const startNewProject = () => {
  setProjectError("");
  setProjectName("");
  setProjectDescription("");
  setProjectId(null);
  setImportedApis([]);
  setTestCases([]);
  setShowCreateProject(true);
};
  const createProject = async (event) => {
  event.preventDefault();

  setProjectError("");
  setCreatingProject(true);

  try {
    const data = await createProjectInSupabase(
      projectName,
      projectDescription
    );

    localStorage.setItem(
      "current_project_id",
      data.id
    );

    localStorage.setItem(
      "current_project_name",
      data.name || ""
    );

    localStorage.setItem(
      "current_project_description",
      data.description || ""
    );

    setProjectId(data.id);
    setProjectName(data.name || "");
    setProjectDescription(data.description || "");

    setImportedApis([]);
    setTestCases([]);

    setShowCreateProject(false);

    await fetchProjects();
  } catch (error) {
    console.error("Create project error:", error);

    setProjectError(
      error.message || "Failed to create project"
    );
  } finally {
    setCreatingProject(false);
  }
};
  // =====================================================
  // OPEN PROJECT
  // =====================================================
const openProject = async (project) => {
  setOpeningProject(true);
  setProjectError("");

  try {
    localStorage.setItem(
      "current_project_id",
      project.id
    );

    localStorage.setItem(
      "current_project_name",
      project.name || ""
    );

    localStorage.setItem(
      "current_project_description",
      project.description || ""
    );

    setProjectId(project.id);
    setProjectName(project.name || "");
    setProjectDescription(project.description || "");

    const apiList = await getProjectApis(project.id);

    setImportedApis(
      Array.isArray(apiList) ? apiList : []
    );

    setTestCases([]);
  } catch (error) {
    console.error("Open project error:", error);

    setProjectError(
      error.message || "Failed to open project"
    );
  } finally {
    setOpeningProject(false);
  }
};
 
  // =====================================================
  // BACK TO PROJECTS
  // =====================================================

  const backToProjects = async () => {
    localStorage.removeItem("current_project_id");
    localStorage.removeItem("current_project_name");
    localStorage.removeItem("current_project_description");

    setProjectId(null);
    setProjectName("");
    setProjectDescription("");

    setImportedApis([]);
    setTestCases([]);

    setSelectedFile(null);
    setUploadMessage("");
    setUploadError("");
    setGenerateError("");
    setProjectError("");

    setShowCreateProject(false);

    await fetchProjects();
  };

  // =====================================================
  // OPENAPI FILE
  // =====================================================

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    setSelectedFile(file || null);
    setUploadMessage("");
    setUploadError("");

    if (file) {
      setUploadMessage(`Selected file: ${file.name}`);
    }
  };
const uploadOpenAPI = async () => {
  if (!projectId) {
    setUploadError(
      "Please create or open a project first."
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
  setUploadError("");
  setUploadMessage(
    `Processing ${selectedFile.name}...`
  );

  try {
    const fileName = selectedFile.name;
    const fileText = await selectedFile.text();

    let spec;

    if (fileName.toLowerCase().endsWith(".json")) {
      spec = JSON.parse(fileText);
    } else if (
      fileName.toLowerCase().endsWith(".yaml") ||
      fileName.toLowerCase().endsWith(".yml")
    ) {
      spec = yaml.load(fileText);
    } else {
      throw new Error(
        "Unsupported file type. Please upload JSON or YAML."
      );
    }

    if (
      !spec ||
      typeof spec !== "object" ||
      !spec.paths
    ) {
      throw new Error(
        "Invalid OpenAPI specification: paths were not found."
      );
    }

    const apisToInsert = [];

    for (const [path, pathItem] of Object.entries(
      spec.paths
    )) {
      if (
        !pathItem ||
        typeof pathItem !== "object"
      ) {
        continue;
      }

      for (const [method, operation] of Object.entries(
        pathItem
      )) {
        const upperMethod = method.toUpperCase();

        const supportedMethods = [
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "OPTIONS",
          "HEAD",
        ];

        if (
          !supportedMethods.includes(upperMethod)
        ) {
          continue;
        }

        let requestBody = "";

        if (operation?.requestBody) {
          requestBody = JSON.stringify(
            operation.requestBody.content?.[
              "application/json"
            ]?.schema ||
              operation.requestBody.content ||
              operation.requestBody
          );
        }

        apisToInsert.push({
          project_id: projectId,
          method: upperMethod,
          endpoint: path,
          request_body: requestBody,
        });
      }
    }

    if (apisToInsert.length === 0) {
      throw new Error(
        "No API endpoints were found in the OpenAPI specification."
      );
    }

    const savedApis = await createProjectApis(
      apisToInsert
    );

    setImportedApis(
      Array.isArray(savedApis)
        ? savedApis
        : []
    );

    setSelectedFile(null);

    setUploadMessage(
      `Successfully imported ${savedApis.length} API endpoint(s) from ${fileName}.`
    );
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
  // GENERATE TEST CASES
  // =====================================================

  const generateTestCases = async () => {
    if (!projectId) {
      setGenerateError(
        "Please create or open a project first."
      );
      return;
    }

    if (importedApis.length === 0) {
      setGenerateError(
        "Please import at least one API before generating test cases."
      );
      return;
    }

    setGenerating(true);
    setGenerateError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${projectId}/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to generate test cases"
        );
      }

      setTestCases(
        Array.isArray(data.test_cases)
          ? data.test_cases
          : []
      );

      localStorage.setItem(
        "current_project_id",
        projectId
      );
      localStorage.setItem(
        "current_project_name",
        projectName
      );
      localStorage.setItem(
        "current_project_description",
        projectDescription
      );
    } catch (error) {
      setGenerateError(error.message);
    } finally {
      setGenerating(false);
    }
  };

  // =====================================================
  // EXPORT HELPERS
  // =====================================================

  const downloadExport = async (type, filename) => {
    try {
      if (!token) {
        throw new Error(
          "You are not authenticated. Please login again."
        );
      }

      if (!projectId) {
        throw new Error(
          "Please open a project first."
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/projects/${projectId}/export/${type}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          data.detail ||
            `Failed to export ${type}`
        );
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert(error.message);
    }
  };

  const exportExcel = () => {
    downloadExport(
      "excel",
      `project_${projectId}_test_cases.xlsx`
    );
  };

  const exportPDF = () => {
    downloadExport(
      "pdf",
      `project_${projectId}_test_cases.pdf`
    );
  };

  const exportPostman = () => {
    downloadExport(
      "postman",
      `project_${projectId}_postman.json`
    );
  };

  // =====================================================
  // LOGIN / REGISTER PAGE
  // =====================================================

  if (!loggedIn || !token) {
    // ===================================================
    // REGISTER PAGE
    // ===================================================

    if (showRegister) {
      return (
        <div className="login-page">
          <div className="login-background"></div>

          <div className="login-card">
            <div className="logo">
              <div className="logo-icon">AI</div>

              <span>API Test Generator</span>
            </div>

            <div className="login-heading">
              <h1>Create account</h1>

              <p>
                Register to start generating intelligent
                API test cases with AI.
              </p>
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="registerName">
                  Full Name
                </label>

                <input
                  id="registerName"
                  type="text"
                  value={registerName}
                  onChange={(event) =>
                    setRegisterName(event.target.value)
                  }
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="registerEmail">
                  Email address
                </label>

                <input
                  id="registerEmail"
                  type="email"
                  value={registerEmail}
                  onChange={(event) =>
                    setRegisterEmail(event.target.value)
                  }
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="registerPassword">
                  Password
                </label>

                <input
                  id="registerPassword"
                  type="password"
                  value={registerPassword}
                  onChange={(event) =>
                    setRegisterPassword(event.target.value)
                  }
                  placeholder="Create a password"
                  required
                  minLength={6}
                />
              </div>

              {registerError && (
                <div className="error-message">
                  {registerError}
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={registering}
              >
                {registering
                  ? "Creating account..."
                  : "Create Account →"}
              </button>
            </form>

            <div
              style={{
                textAlign: "center",
                marginTop: "20px",
              }}
            >
              <span>
                Already have an account?{" "}
              </span>

              <button
                type="button"
                onClick={() => {
                  setShowRegister(false);
                  setRegisterError("");
                  setRegisterSuccess("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#7c3aed",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "inherit",
                }}
              >
                Login
              </button>
            </div>

            <div className="login-footer">
              AI-powered REST API testing platform
            </div>
          </div>
        </div>
      );
    }

    // ===================================================
    // LOGIN PAGE
    // ===================================================

    return (
      <div className="login-page">
        <div className="login-background"></div>

        <div className="login-card">
          <div className="logo">
            <div className="logo-icon">AI</div>

            <span>API Test Generator</span>
          </div>

          <div className="login-heading">
            <h1>Welcome back</h1>

            <p>
              Generate intelligent API test cases with AI.
              Login to continue to your workspace.
            </p>
          </div>

          {registerSuccess && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "8px",
                background: "#dcfce7",
                color: "#166534",
                fontSize: "14px",
              }}
            >
              ✓ {registerSuccess}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">
                Email address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                required
              />
            </div>

            {loginError && (
              <div className="error-message">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={loggingIn}
            >
              {loggingIn
                ? "Signing in..."
                : "Login →"}
            </button>
          </form>

          <div
            style={{
              textAlign: "center",
              marginTop: "20px",
            }}
          >
            <span>
              Don't have an account?{" "}
            </span>

            <button
              type="button"
              onClick={() => {
                setShowRegister(true);
                setLoginError("");
                setRegisterError("");
                setRegisterSuccess("");
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#7c3aed",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "inherit",
              }}
            >
              Register
            </button>
          </div>

          <div className="login-footer">
            AI-powered REST API testing platform
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // PROJECT LIST
  // =====================================================

  if (!projectId && !showCreateProject) {
    return (
      <div className="app">
        <div className="dashboard">
          <main className="main-content">
            <div className="top-header">
              <div>
                <div className="eyebrow">
                  WORKSPACE
                </div>

                <h1>
                  My <span>Projects</span>
                </h1>

                <p className="header-description">
                  Select an existing project or create a
                  new project to begin API testing.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div className="header-status">
                  <div className="pulse"></div>
                  Connected
                </div>

                <button
                  onClick={handleLogout}
                  style={{
                    padding: "10px 18px",
                    border: "none",
                    borderRadius: "8px",
                    background: "#dc2626",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Logout
                </button>
              </div>
            </div>

            <button
              className="gradient-button"
              onClick={startNewProject}
            >
              <span>＋</span>
              Create New Project
            </button>

            {projectError && (
              <div className="error-message">
                {projectError}
              </div>
            )}

            <div style={{ marginTop: "30px" }}>
              {projectsLoading ? (
                <div className="content-card">
                  <p>Loading your projects...</p>
                </div>
              ) : projects.length === 0 ? (
                <div className="content-card">
                  <div className="section-heading">
                    <div className="section-icon">
                      📁
                    </div>

                    <div>
                      <h2>No projects yet</h2>

                      <p>
                        Create your first project to start
                        generating API test cases.
                      </p>
                    </div>
                  </div>

                  <button
                    className="gradient-button"
                    onClick={startNewProject}
                  >
                    <span>＋</span>
                    Create Your First Project
                  </button>
                </div>
              ) : (
                <div className="test-grid">
                  {projects.map((project) => (
                    <div
                      className="test-card"
                      key={project.id}
                    >
                      <div className="test-card-top">
                        <span className="type-badge">
                          PROJECT
                        </span>

                        <span className="test-number">
                          #{project.id}
                        </span>
                      </div>

                      <h3>{project.name}</h3>

                      <p className="test-description">
                        {project.description ||
                          "No description provided."}
                      </p>

                      <button
                        className="gradient-button"
                        onClick={() =>
                          openProject(project)
                        }
                        disabled={openingProject}
                      >
                        {openingProject
                          ? "Opening..."
                          : "Open Project →"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // =====================================================
  // CREATE PROJECT
  // =====================================================

  if (showCreateProject && !projectId) {
    return (
      <div className="app">
        <div className="dashboard">
          <main className="main-content">
            <div className="top-header">
              <div>
                <div className="eyebrow">
                  NEW PROJECT
                </div>

                <h1>
                  Create <span>Project</span>
                </h1>

                <p className="header-description">
                  Set up a workspace for your REST API
                  testing.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <button
                  className="gradient-button"
                  onClick={backToProjects}
                >
                  ← My Projects
                </button>

                <button
                  onClick={handleLogout}
                  style={{
                    padding: "10px 18px",
                    border: "none",
                    borderRadius: "8px",
                    background: "#dc2626",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="content-card">
              <div className="section-heading">
                <div className="section-icon">
                  🚀
                </div>

                <div>
                  <h2>Project Details</h2>

                  <p>
                    Enter the basic information for your
                    project.
                  </p>
                </div>
              </div>

              <form
                className="project-form"
                onSubmit={createProject}
              >
                <div className="form-group">
                  <label htmlFor="projectName">
                    Project Name
                  </label>

                  <input
                    id="projectName"
                    value={projectName}
                    onChange={(event) =>
                      setProjectName(event.target.value)
                    }
                    placeholder="Example: User Management API"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="projectDescription">
                    Description
                  </label>

                  <textarea
                    id="projectDescription"
                    value={projectDescription}
                    onChange={(event) =>
                      setProjectDescription(
                        event.target.value
                      )
                    }
                    placeholder="Describe your API testing project"
                  />
                </div>

                {projectError && (
                  <div className="error-message">
                    {projectError}
                  </div>
                )}

                <button
                  type="submit"
                  className="gradient-button"
                  disabled={creatingProject}
                >
                  {creatingProject
                    ? "Creating Project..."
                    : "Create Project →"}
                </button>
              </form>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // =====================================================
  // PROJECT WORKSPACE
  // =====================================================

  return (
    <div className="app">
      <div className="dashboard">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              AI
            </div>

            <div>
              <h2>API Generator</h2>

              <span>AI Testing Platform</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-item active">
              <span>▦</span>
              Workspace
            </div>

            <div
              className="nav-item"
              onClick={backToProjects}
            >
              <span>▤</span>
              My Projects
            </div>
          </nav>

          <div className="sidebar-footer">
            <div className="online-dot"></div>
            Backend connected
          </div>
        </aside>

        <main className="main-content">
          <div className="top-header">
            <div>
              <div className="eyebrow">
                API TESTING WORKSPACE
              </div>

              <h1>
                {projectName || "API Testing"}{" "}
                <span>Workspace</span>
              </h1>

              <p className="header-description">
                {projectDescription ||
                  "AI-powered REST API test case generation and analysis."}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div className="header-status">
                <div className="pulse"></div>
                Project #{projectId}
              </div>

              <button
                onClick={handleLogout}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: "8px",
                  background: "#dc2626",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple">
                📁
              </div>

              <div>
                <p>PROJECT ID</p>
                <h3>#{projectId}</h3>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                🔌
              </div>

              <div>
                <p>API ENDPOINTS</p>
                <h3>{importedApis.length}</h3>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon pink">
                🧪
              </div>

              <div>
                <p>TEST CASES</p>
                <h3>{testCases.length}</h3>
              </div>
            </div>
          </div>

          <div className="workflow-card">
            <div className="workflow-title">
              <h2>Testing Workflow</h2>
            </div>

            <div className="workflow">
              <div
                className={`workflow-step ${
                  importedApis.length > 0
                    ? "completed"
                    : ""
                }`}
              >
                <div className="step-number">
                  1
                </div>

                <div>
                  <h4>Import API</h4>
                  <p>
                    Upload OpenAPI specification
                  </p>
                </div>
              </div>

              <div className="workflow-line"></div>

              <div
                className={`workflow-step ${
                  testCases.length > 0
                    ? "completed"
                    : ""
                }`}
              >
                <div className="step-number">
                  2
                </div>

                <div>
                  <h4>Generate Tests</h4>
                  <p>
                    AI creates test scenarios
                  </p>
                </div>
              </div>

              <div className="workflow-line"></div>

              <div
                className={`workflow-step ${
                  testCases.length > 0
                    ? "completed"
                    : ""
                }`}
              >
                <div className="step-number">
                  3
                </div>

                <div>
                  <h4>Review Results</h4>
                  <p>
                    Inspect generated test cases
                  </p>
                </div>
              </div>
            </div>
          </div>

          <section className="content-card">
            <div className="section-heading">
              <div className="section-icon">
                📤
              </div>

              <div>
                <h2>
                  Upload OpenAPI / Swagger
                </h2>

                <p>
                  Upload a JSON or YAML specification
                  to import your REST API endpoints.
                </p>
              </div>
            </div>

            <div className="file-upload">
              <input
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileChange}
              />

              <div className="upload-visual">
                <div className="upload-icon">
                  ↑
                </div>

                <h3>
                  {selectedFile
                    ? selectedFile.name
                    : "Drop your OpenAPI file here"}
                </h3>

                <p>
                  Supports .json, .yaml and .yml
                  files
                </p>
              </div>
            </div>

            {selectedFile && (
              <button
                className="gradient-button"
                onClick={uploadOpenAPI}
                disabled={uploading}
              >
                {uploading
                  ? "Uploading..."
                  : "Upload & Import →"}
              </button>
            )}

            {uploading && (
              <div className="upload-message">
                ⏳ Uploading and processing your
                OpenAPI file...
              </div>
            )}

            {uploadMessage && !uploading && (
              <div className="upload-message">
                ✓ {uploadMessage}
              </div>
            )}

            {uploadError && (
              <div className="error-message">
                ✕ {uploadError}
              </div>
            )}
          </section>

          <section className="content-card">
            <div className="api-card-header">
              <div>
                <h2>
                  Imported API Endpoints
                </h2>

                <p>
                  Endpoints imported from your
                  OpenAPI specification.
                </p>
              </div>

              <button
                className="generate-button"
                onClick={generateTestCases}
                disabled={
                  generating ||
                  importedApis.length === 0
                }
              >
                {generating
                  ? "Generating..."
                  : "Generate AI Tests →"}
              </button>
            </div>

            {importedApis.length === 0 ? (
              <p>No APIs imported yet.</p>
            ) : (
              <div className="api-list">
                {importedApis.map((api) => (
                  <div
                    className="api-row"
                    key={api.id}
                  >
                    <span
                      className={`method ${String(
                        api.method
                      ).toLowerCase()}`}
                    >
                      {api.method}
                    </span>

                    <span className="endpoint">
                      {api.endpoint}
                    </span>

                    <span className="api-status">
                      Imported
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {generating && (
            <section className="content-card generating-card">
              <div className="ai-loader">
                <div className="loader-ring"></div>

                <div className="loader-center">
                  AI
                </div>
              </div>

              <div>
                <h2>
                  AI is generating test cases
                </h2>

                <p>
                  Analyzing your API endpoints and
                  creating functional, negative,
                  boundary and security scenarios...
                </p>
              </div>
            </section>
          )}

          {generateError && (
            <div className="error-message">
              ✕ {generateError}
            </div>
          )}

          <section className="content-card">
            <div className="tests-header">
              <div>
                <h2>
                  Generated Test Cases
                </h2>

                <p>
                  AI-generated scenarios for your
                  API endpoints.
                </p>
              </div>

              <div className="tests-count">
                {testCases.length}
              </div>
            </div>

            {testCases.length === 0 ? (
              <p>
                No generated test cases yet.
              </p>
            ) : (
              <div className="test-grid">
                {testCases.map(
                  (testCase, index) => {
                    const status =
                      testCase.execution_status ||
                      "NOT RUN";

                    const statusUpper =
                      String(status).toUpperCase();

                    const type = String(
                      testCase.test_type || ""
                    )
                      .toLowerCase()
                      .replace(/\s+/g, "-");

                    return (
                      <div
                        className="test-card"
                        key={
                          testCase.id || index
                        }
                      >
                        <div className="test-card-top">
                          <span
                            className={`type-badge ${type}`}
                          >
                            {testCase.test_type ||
                              "TEST"}
                          </span>

                          <span className="test-number">
                            #{index + 1}
                          </span>
                        </div>

                        <h3>
                          {testCase.title ||
                            "Untitled Test Case"}
                        </h3>

                        <div className="test-meta">
                          <span
                            className={`method ${String(
                              testCase.method
                            ).toLowerCase()}`}
                          >
                            {testCase.method}
                          </span>

                          <span>
                            {testCase.endpoint}
                          </span>
                        </div>

                        {testCase.description && (
                          <p className="test-description">
                            {testCase.description}
                          </p>
                        )}

                        <div className="expected-result">
                          <span>
                            Expected Result
                          </span>

                          <p>
                            {testCase.expected_result ||
                              "Not specified"}
                          </p>
                        </div>

                        {testCase.expected_status_code && (
                          <div className="expected-result">
                            <span>
                              Expected Status Code
                            </span>

                            <p>
                              {
                                testCase.expected_status_code
                              }
                            </p>
                          </div>
                        )}

                        <div className="expected-result">
                          <span>
                            Execution Status
                          </span>

                          <p>{statusUpper}</p>
                        </div>

                        {testCase.actual_result && (
                          <div className="expected-result">
                            <span>
                              Actual Result
                            </span>

                            <p>
                              {testCase.actual_result}
                            </p>
                          </div>
                        )}

                        {testCase.test_code && (
                          <div className="expected-result">
                            <span>
                              Executable Test Code
                            </span>

                            <pre
                              style={{
                                marginTop: "10px",
                                padding: "15px",
                                background:
                                  "#080b14",
                                borderRadius:
                                  "10px",
                                overflowX:
                                  "auto",
                                color:
                                  "#dbeafe",
                                fontSize:
                                  "12px",
                                lineHeight:
                                  "1.5",
                                whiteSpace:
                                  "pre-wrap",
                              }}
                            >
                              {testCase.test_code}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          <section className="content-card">
            <div className="tests-header">
              <div>
                <h2>
                  Export Results
                </h2>

                <p>
                  Download your generated test
                  cases.
                </p>
              </div>
            </div>

            <div className="export-buttons">
              <button
                className="export-btn excel-btn"
                onClick={exportExcel}
                disabled={
                  testCases.length === 0
                }
              >
                Export Excel
              </button>

              <button
                className="export-btn pdf-btn"
                onClick={exportPDF}
                disabled={
                  testCases.length === 0
                }
              >
                Export PDF
              </button>

              <button
                className="export-btn postman-btn"
                onClick={exportPostman}
                disabled={
                  testCases.length === 0
                }
              >
                Export Postman
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;