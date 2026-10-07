function Dashboard({
  projects,
  projectApis,
  openApiSpec,
  generatedCode,
}) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back. Manage your API projects and generate automated
            test cases.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">▣</div>
          <div>
            <span className="stat-label">Projects</span>
            <h2>{projects?.length || 0}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⌘</div>
          <div>
            <span className="stat-label">API Endpoints</span>
            <h2>{projectApis?.length || 0}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">◇</div>
          <div>
            <span className="stat-label">OpenAPI Status</span>
            <h2>{openApiSpec ? "Ready" : "—"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✧</div>
          <div>
            <span className="stat-label">Generated Tests</span>
            <h2>{generatedCode ? "Ready" : "—"}</h2>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>API Test Generator</h2>
              <p>
                Upload an OpenAPI specification and generate executable test
                code using AI.
              </p>
            </div>
          </div>

          <div className="workflow-steps">
            <div className="workflow-step">
              <span>1</span>
              <div>
                <strong>Upload OpenAPI</strong>
                <p>Import your JSON or YAML API specification.</p>
              </div>
            </div>

            <div className="workflow-step">
              <span>2</span>
              <div>
                <strong>Choose Technology</strong>
                <p>Select Python, Node.js, or Spring Boot.</p>
              </div>
            </div>

            <div className="workflow-step">
              <span>3</span>
              <div>
                <strong>Generate Tests</strong>
                <p>AI generates a single executable test-code file.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Quick Overview</h2>
              <p>Current workspace status.</p>
            </div>
          </div>

          <div className="overview-list">
            <div className="overview-item">
              <span>Projects</span>
              <strong>{projects?.length || 0}</strong>
            </div>

            <div className="overview-item">
              <span>Selected APIs</span>
              <strong>{projectApis?.length || 0}</strong>
            </div>

            <div className="overview-item">
              <span>OpenAPI Specification</span>
              <strong>{openApiSpec ? "Uploaded" : "Not uploaded"}</strong>
            </div>

            <div className="overview-item">
              <span>Generated Test File</span>
              <strong>{generatedCode ? "Available" : "Not generated"}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;