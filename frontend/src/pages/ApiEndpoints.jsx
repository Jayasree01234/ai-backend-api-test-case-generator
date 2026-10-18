function ApiEndpoints({
  projects = [],
  projectId,
  projectApis = [],
  apiMethod,
  apiEndpoint,
  apiRequestBody,
  apiError,
  apiLoading,
  selectedFile,
  importedApis = [],
  uploadError,
  uploading,
  setApiMethod,
  setApiEndpoint,
  setApiRequestBody,
  handleCreateApi,
  handleFileChange,
  handleImportOpenApi,
  handleSelectProject,
}) {
  const hasSelectedFile =
    selectedFile instanceof File;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>API Endpoints</h1>
          <p>
            Add, manage, and import API endpoints for your project.
          </p>
        </div>
      </div>

      {/* PROJECT SELECTION */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>Project</h2>
            <p>
              Select the project whose APIs you want to manage.
            </p>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="api-project-select">
            Select Project
          </label>

          <select
            id="api-project-select"
            value={projectId || ""}
            onChange={(event) => {
              const project = projects.find(
                (item) =>
                  String(item.id) === event.target.value
              );

              if (project) {
                handleSelectProject(project);
              }
            }}
          >
            <option value="">Select a project</option>

            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!projectId ? (
        <div className="dashboard-card">
          <div className="empty-state">
            <h3>Select a project</h3>
            <p>
              Select a project above to manage its API endpoints.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* MANUAL API */}
          <div className="dashboard-card">
            <div className="card-header">
              <div>
                <h2>Add API Endpoint</h2>
                <p>
                  Add an API endpoint manually.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="api-method">
                  HTTP Method
                </label>

                <select
                  id="api-method"
                  value={apiMethod}
                  onChange={(event) =>
                    setApiMethod(event.target.value)
                  }
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="api-endpoint">
                  Endpoint
                </label>

                <input
                  id="api-endpoint"
                  type="text"
                  value={apiEndpoint}
                  onChange={(event) =>
                    setApiEndpoint(event.target.value)
                  }
                  placeholder="/users"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="api-request-body">
                Request Body
              </label>

              <textarea
                id="api-request-body"
                value={apiRequestBody}
                onChange={(event) =>
                  setApiRequestBody(event.target.value)
                }
                placeholder='{"name":"John"}'
                rows={5}
              />
            </div>

            {apiError && (
              <div className="error-message" role="alert">
                {apiError}
              </div>
            )}

            <button
              type="button"
              className="primary-button"
              onClick={handleCreateApi}
              disabled={apiLoading}
            >
              {apiLoading ? "Adding..." : "Add Endpoint"}
            </button>
          </div>

          {/* OPENAPI IMPORT */}
          <div className="dashboard-card">
            <div className="card-header">
              <div>
                <h2>Import OpenAPI Specification</h2>
                <p>
                  Upload an OpenAPI JSON or YAML file to detect
                  API endpoints automatically.
                </p>
              </div>
            </div>

            <div className="upload-area">
              <label htmlFor="openapi-file">
                Choose OpenAPI file
              </label>

              <input
                id="openapi-file"
                type="file"
                accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
                onChange={handleFileChange}
                disabled={uploading}
              />

              {hasSelectedFile && (
                <div className="selected-file">
                  <strong>Selected file</strong>
                  <span>{selectedFile.name}</span>
                </div>
              )}

              {!hasSelectedFile && (
                <p>
                  Choose a JSON, YAML, or YML file from your computer.
                  After refreshing the page, select the file again before
                  importing it.
                </p>
              )}

              {uploadError && (
                <div className="error-message" role="alert">
                  {uploadError}
                </div>
              )}

              <button
                type="button"
                className="primary-button"
                onClick={handleImportOpenApi}
                disabled={!hasSelectedFile || uploading}
              >
                {uploading
                  ? "Importing..."
                  : "Import OpenAPI"}
              </button>

              {uploading && (
                <p role="status">
                  Reading the OpenAPI specification and saving endpoints...
                </p>
              )}
            </div>

            {importedApis.length > 0 && (
              <div className="imported-api-list">
                <h3>
                  Detected Endpoints ({importedApis.length})
                </h3>

                {importedApis.map((api, index) => (
                  <div
                    className="api-item"
                    key={`${api.method}-${api.endpoint}-${index}`}
                  >
                    <span className="api-method">
                      {api.method}
                    </span>

                    <span>{api.endpoint}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EXISTING APIS */}
          <div className="dashboard-card">
            <div className="card-header">
              <div>
                <h2>Project API Endpoints</h2>
                <p>
                  API endpoints currently available in this project.
                </p>
              </div>

              <span className="endpoint-count">
                {projectApis.length} endpoint
                {projectApis.length !== 1 ? "s" : ""}
              </span>
            </div>

            {projectApis.length === 0 ? (
              <div className="empty-state">
                <h3>No API endpoints</h3>
                <p>
                  Add an endpoint manually or import an OpenAPI
                  specification.
                </p>
              </div>
            ) : (
              <div className="api-list">
                {projectApis.map((api) => (
                  <div
                    className="api-item"
                    key={api.id}
                  >
                    <span className="api-method">
                      {api.method}
                    </span>

                    <span className="api-endpoint">
                      {api.endpoint}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ApiEndpoints;