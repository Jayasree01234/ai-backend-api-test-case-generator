import { useState } from "react";
import "./App.css";

function App() {

// ================= LOGIN STATES =================

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [message, setMessage] = useState("");
const [loggedIn, setLoggedIn] = useState(false);

// ================= PROJECT STATES =================

const [projectName, setProjectName] = useState("");
const [projectDescription, setProjectDescription] = useState("");
const [projectId, setProjectId] = useState(null);

// ================= OPENAPI STATES =================

const [selectedFile, setSelectedFile] = useState(null);
const [uploadMessage, setUploadMessage] = useState("");
const [importedApis, setImportedApis] = useState([]);

// ================= TEST CASE STATES =================

const [testCases, setTestCases] = useState([]);
const [generating, setGenerating] = useState(false);

// =====================================================
// LOGIN
// =====================================================

async function handleLogin(event) {
event.preventDefault();


try {
  const response = await fetch(
    "http://127.0.0.1:8000/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    setMessage(data.detail || "Login failed");
    return;
  }

  localStorage.setItem("access_token", data.access_token);

  setLoggedIn(true);
  setMessage("");

} catch (error) {
  setMessage("Could not connect to backend.");
}


}

// =====================================================
// CREATE PROJECT
// =====================================================

async function createProject(event) {
event.preventDefault();


const token = localStorage.getItem("access_token");

try {
  const response = await fetch(
    "http://127.0.0.1:8000/projects/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: projectName,
        description: projectDescription
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(data.detail || "Project creation failed");
    return;
  }

  setProjectId(data.id);
  alert("Project created successfully!");

} catch (error) {
  alert("Could not connect to backend.");
}


}

// =====================================================
// UPLOAD OPENAPI
// =====================================================

async function uploadOpenApi(event) {
event.preventDefault();


if (!selectedFile) {
  setUploadMessage("Please select an OpenAPI file.");
  return;
}

if (!projectId) {
  setUploadMessage("Please create a project first.");
  return;
}

const token = localStorage.getItem("access_token");

const formData = new FormData();
formData.append("file", selectedFile);

try {
  setUploadMessage("Uploading OpenAPI file...");

  const response = await fetch(
    `http://127.0.0.1:8000/projects/${projectId}/import-openapi`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok) {
    setUploadMessage(data.detail || "Upload failed");
    return;
  }

  setUploadMessage(
    `File uploaded successfully! ${data.total_apis} APIs imported.`
  );

  setImportedApis(data.apis_imported || []);

} catch (error) {
  setUploadMessage("Could not connect to backend.");
}


}

// =====================================================
// GENERATE TEST CASES
// =====================================================

async function generateTestCases() {


if (!projectId) {
  alert("Please create a project first.");
  return;
}

const token = localStorage.getItem("access_token");

try {
  setGenerating(true);

  const response = await fetch(
    `http://127.0.0.1:8000/projects/${projectId}/generate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(data.detail || "Test case generation failed");
    return;
  }

  setTestCases(data.test_cases || []);

} catch (error) {
  alert("Could not connect to backend.");
} finally {
  setGenerating(false);
}


}

// =====================================================
// DOWNLOAD EXPORT
// =====================================================

const downloadExport = async (type, extension) => {


if (!projectId) {
  alert("Please create a project first.");
  return;
}

const token = localStorage.getItem("access_token");

try {

  const response = await fetch(
    `http://127.0.0.1:8000/projects/${projectId}/export/${type}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {

    const errorData = await response.json();

    alert(
      errorData.detail || "Export failed"
    );

    return;
  }

  const blob = await response.blob();

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download =
    `project_${projectId}_test_cases.${extension}`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);

} catch (error) {

  console.error("Export error:", error);

  alert(
    "Export failed. Please try again."
  );
}


};

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

const exportExcel = () => {
downloadExport("excel", "xlsx");
};

const exportPDF = () => {
downloadExport("pdf", "pdf");
};

const exportPostman = () => {
downloadExport("postman", "json");
};

// =====================================================
// LOGIN PAGE
// =====================================================

if (!loggedIn) {


return (

  <div className="login-page">

    <div className="login-background"></div>

    <div className="login-card">

      <div className="logo">
        <div className="logo-icon">AI</div>
        <span>TestForge</span>
      </div>

      <div className="login-heading">

        <h1>Welcome Back</h1>

        <p>
          Sign in to continue generating intelligent API test cases.
        </p>

      </div>


      <form onSubmit={handleLogin}>

        <div className="form-group">

          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
          />

        </div>


        <div className="form-group">

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
          />

        </div>


        <button
          type="submit"
          className="primary-button"
        >
          Sign In →
        </button>

      </form>


      {message && (

        <p className="error-message">
          {message}
        </p>

      )}


      <p className="login-footer">
        AI Powered API Testing Platform
      </p>

    </div>

  </div>
);


}

// =====================================================
// DASHBOARD
// =====================================================

return (


<div className="dashboard">


  {/* ================= SIDEBAR ================= */}

  <aside className="sidebar">

    <div className="brand">

      <div className="brand-icon">AI</div>

      <div>
        <h2>TestForge</h2>
        <span>AI Testing Platform</span>
      </div>

    </div>


    <nav className="sidebar-nav">

      <div className="nav-item active">
        <span>◈</span>
        Dashboard
      </div>

      <div className="nav-item">
        <span>▣</span>
        Projects
      </div>

      <div className="nav-item">
        <span>⌘</span>
        API Testing
      </div>

      <div className="nav-item">
        <span>◉</span>
        Test Cases
      </div>

    </nav>


    <div className="sidebar-footer">

      <div className="online-dot"></div>

      Backend Connected

    </div>

  </aside>


  {/* ================= MAIN CONTENT ================= */}

  <main className="main-content">


    {/* ================= HEADER ================= */}

    <header className="top-header">

      <div>

        <p className="eyebrow">
          AI-POWERED TEST AUTOMATION
        </p>

        <h1>
          Build Better APIs.
          <span> Test Smarter.</span>
        </h1>

        <p className="header-description">
          Generate comprehensive API test cases automatically
          using intelligent analysis.
        </p>

      </div>


      <div className="header-status">

        <div className="pulse"></div>

        System Online

      </div>

    </header>


    {/* ================= STATS ================= */}

    <section className="stats-grid">

      <div className="stat-card">

        <div className="stat-icon purple">
          ◈
        </div>

        <div>

          <p>Current Project</p>

          <h3>
            {projectId ? `#${projectId}` : "None"}
          </h3>

        </div>

      </div>


      <div className="stat-card">

        <div className="stat-icon blue">
          ⌘
        </div>

        <div>

          <p>APIs Imported</p>

          <h3>{importedApis.length}</h3>

        </div>

      </div>


      <div className="stat-card">

        <div className="stat-icon pink">
          ✦
        </div>

        <div>

          <p>Test Cases</p>

          <h3>{testCases.length}</h3>

        </div>

      </div>

    </section>


    {/* ================= WORKFLOW ================= */}

    <section className="workflow-card">

      <div className="workflow-title">

        <div>

          <p className="eyebrow">
            WORKFLOW
          </p>

          <h2>
            Your Testing Pipeline
          </h2>

        </div>

      </div>


      <div className="workflow">


        <div className="workflow-step completed">

          <div className="step-number">1</div>

          <div>
            <h4>Create Project</h4>
            <p>Set up your testing workspace</p>
          </div>

        </div>


        <div className="workflow-line"></div>


        <div
          className={`workflow-step ${
            importedApis.length > 0
              ? "completed"
              : ""
          }`}
        >

          <div className="step-number">2</div>

          <div>
            <h4>Import API</h4>
            <p>Upload OpenAPI specification</p>
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

          <div className="step-number">3</div>

          <div>
            <h4>Generate Tests</h4>
            <p>AI creates intelligent scenarios</p>
          </div>

        </div>

      </div>

    </section>


    {/* ================= CREATE PROJECT ================= */}

    {!projectId && (

      <section className="content-card project-card">

        <div className="section-heading">

          <div className="section-icon">
            +
          </div>

          <div>

            <p className="eyebrow">
              STEP 01
            </p>

            <h2>Create New Project</h2>

            <p>
              Start by creating a workspace for your API testing.
            </p>

          </div>

        </div>


        <form
          onSubmit={createProject}
          className="project-form"
        >

          <div className="form-group">

            <label>Project Name</label>

            <input
              type="text"
              placeholder="Example: User Management API"
              value={projectName}
              onChange={(event) =>
                setProjectName(event.target.value)
              }
              required
            />

          </div>


          <div className="form-group">

            <label>Project Description</label>

            <textarea
              placeholder="Describe what this API project is about..."
              value={projectDescription}
              onChange={(event) =>
                setProjectDescription(
                  event.target.value
                )
              }
            />

          </div>


          <button
            type="submit"
            className="gradient-button"
          >

            Create Project

            <span>→</span>

          </button>

        </form>

      </section>

    )}


    {/* ================= PROJECT CREATED ================= */}

    {projectId && (

      <section className="project-success-card">

        <div className="success-left">

          <div className="success-icon">
            ✓
          </div>

          <div>

            <p className="eyebrow">
              PROJECT READY
            </p>

            <h2>
              {projectName || "Project Created Successfully"}
            </h2>

            <p>
              Project ID #{projectId} is ready for API testing.
            </p>

          </div>

        </div>


        <div className="success-badge">
          Active
        </div>

      </section>

    )}


    {/* ================= UPLOAD OPENAPI ================= */}

    {projectId && importedApis.length === 0 && (

      <section className="content-card upload-card">

        <div className="section-heading">

          <div className="section-icon">
            ↑
          </div>

          <div>

            <p className="eyebrow">
              STEP 02
            </p>

            <h2>Import API Specification</h2>

            <p>
              Upload your Swagger or OpenAPI JSON/YAML file.
            </p>

          </div>

        </div>


        <form onSubmit={uploadOpenApi}>

          <div className="file-upload">

            <input
              type="file"
              accept=".json,.yaml,.yml"
              onChange={(event) =>
                setSelectedFile(
                  event.target.files[0]
                )
              }
            />


            <div className="upload-visual">

              <div className="upload-icon">
                ⇧
              </div>

              <h3>
                Drop your API specification here
              </h3>

              <p>
                Supports OpenAPI JSON, YAML and Swagger files
              </p>

            </div>

          </div>


          <button
            type="submit"
            className="gradient-button"
          >

            Import API Specification

            <span>→</span>

          </button>

        </form>


        {uploadMessage && (

          <div className="upload-message">
            {uploadMessage}
          </div>

        )}

      </section>

    )}


    {/* ================= IMPORTED APIs ================= */}

    {importedApis.length > 0 && (

      <section className="content-card api-card">

        <div className="api-card-header">

          <div>

            <p className="eyebrow">
              STEP 03
            </p>

            <h2>
              Imported API Endpoints
            </h2>

            <p>
              {importedApis.length} endpoint
              {importedApis.length !== 1
                ? "s"
                : ""}{" "}
              ready for intelligent test generation.
            </p>

          </div>


          <button
            onClick={generateTestCases}
            disabled={generating}
            className="generate-button"
          >

            {generating
              ? "AI is Generating..."
              : "✦ Generate Test Cases"}

          </button>

        </div>


        <div className="api-list">

          {importedApis.map(
            (api, index) => (

              <div
                className="api-row"
                key={index}
              >

                <span
                  className={`method ${api.method.toLowerCase()}`}
                >
                  {api.method}
                </span>

                <span className="endpoint">
                  {api.endpoint}
                </span>

                <span className="api-status">
                  Ready
                </span>

              </div>

            )
          )}

        </div>

      </section>

    )}


    {/* ================= GENERATING ================= */}

    {generating && (

      <section className="content-card generating-card">

        <div className="ai-loader">

          <div className="loader-ring"></div>

          <div className="loader-center">
            AI
          </div>

        </div>


        <div>

          <p className="eyebrow">
            ARTIFICIAL INTELLIGENCE AT WORK
          </p>

          <h2>
            Generating Intelligent Test Cases
          </h2>

          <p>
            Analyzing endpoints, validations,
            edge cases and security scenarios...
          </p>

        </div>

      </section>

    )}


    {/* ================= TEST CASES ================= */}

    {testCases.length > 0 && (

      <section className="content-card tests-section">

        <div className="tests-header">

          <div>

            <p className="eyebrow">
              GENERATED RESULTS
            </p>

            <h2>
              AI Generated Test Cases
            </h2>

            <p>
              {testCases.length} intelligent
              testing scenarios generated automatically.
            </p>

          </div>


          <div className="tests-count">
            {testCases.length}
          </div>

        </div>


        {/* ================= EXPORT BUTTONS ================= */}

        <div className="export-buttons">

          <button
            onClick={exportExcel}
            className="export-btn excel-btn"
          >
            📊 Export Excel
          </button>


          <button
            onClick={exportPDF}
            className="export-btn pdf-btn"
          >
            📄 Export PDF
          </button>


          <button
            onClick={exportPostman}
            className="export-btn postman-btn"
          >
            ⚡ Export Postman
          </button>

        </div>


        <div className="test-grid">

          {testCases.map(
            (testCase, index) => (

              <div
                className="test-card"
                key={index}
              >

                <div className="test-card-top">

                  <span
                    className={`type-badge ${
                      (
                        testCase.test_type || ""
                      ).toLowerCase()
                    }`}
                  >
                    {testCase.test_type}
                  </span>


                  <span className="test-number">
                    #{index + 1}
                  </span>

                </div>


                <h3>
                  {testCase.title}
                </h3>


                <div className="test-meta">

                  <span
                    className={`method ${
                      (
                        testCase.method || ""
                      ).toLowerCase()
                    }`}
                  >
                    {testCase.method}
                  </span>

                  <span>
                    {testCase.endpoint}
                  </span>

                </div>


                <p className="test-description">
                  {testCase.description}
                </p>


                <div className="expected-result">

                  <span>
                    Expected Result
                  </span>

                  <p>
                    {testCase.expected_result}
                  </p>

                </div>

              </div>

            )
          )}

        </div>

      </section>

    )}

  </main>

</div>


);
}

export default App;
