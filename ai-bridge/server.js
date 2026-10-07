const express = require("express");
const cors = require("cors");

const OLLAMA_URL = "http://localhost:11434";
const OLLAMA_MODEL = "llama3.2:3b";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// =====================================================
// OLLAMA AI
// =====================================================

async function analyzeWithOllama(openapiSpec) {
  const prompt = `
You are an API testing expert.

Analyze the following OpenAPI specification.

Identify:
1. API endpoints
2. HTTP methods
3. Successful test scenarios
4. Negative test scenarios
5. Edge-case scenarios
6. Important request parameters and request bodies
7. Expected response status codes

Return the result as valid JSON only.

Use this exact structure:

{
  "apis": [
    {
      "path": "/users",
      "method": "GET",
      "tests": [
        {
          "name": "Get users successfully",
          "type": "positive",
          "expectedStatus": 200,
          "description": "Retrieve the list of users successfully."
        }
      ]
    }
  ]
}

Rules:
- Include positive, negative, and edge-case scenarios when applicable.
- Use the actual API paths and HTTP methods from the OpenAPI specification.
- Use documented response status codes whenever available.
- Consider required parameters, optional parameters, request bodies, validation, authentication, and invalid input.
- Do not invent endpoints that are not present in the OpenAPI specification.
- Return JSON only. Do not include markdown or explanations outside the JSON.
OpenAPI specification:
${JSON.stringify(openapiSpec, null, 2)}
`;

  const response = await fetch(
    `${OLLAMA_URL}/api/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Ollama request failed with status ${response.status}`
    );
  }

  const data = await response.json();

  return data.response || "";
}

app.get("/test-ollama", async (req, res) => {
  try {
    const result = await analyzeWithOllama({
      openapi: "3.0.0",
      info: {
        title: "Test API",
        version: "1.0.0",
      },
      paths: {
        "/users": {
          get: {
            responses: {
              "200": {
                description: "Successful response",
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      ollamaResponse: result,
    });
  } catch (error) {
    console.error("Ollama test error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =====================================================
// BASIC ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message: "AI Bridge is running",
  });
});

// =====================================================
// GENERAL HELPERS
// =====================================================

function sanitizeName(value) {
  return String(value || "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
}

function capitalize(value) {
  if (!value) return "";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toPascalCase(value) {
  const cleaned = sanitizeName(value);

  if (!cleaned) {
    return "Endpoint";
  }

  return cleaned
    .split(/\s+/)
    .map((part) => capitalize(part.toLowerCase()))
    .join("");
}

function escapePythonString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function escapeJavaScriptString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function escapeJavaString(value) {
  return JSON.stringify(String(value));
}

// =====================================================
// OPENAPI HELPERS
// =====================================================

function resolveSchema(schema, openapiSpec) {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  if (schema.$ref) {
    const prefix = "#/components/schemas/";

    if (schema.$ref.startsWith(prefix)) {
      const schemaName = schema.$ref.substring(
        prefix.length
      );

      return (
        openapiSpec?.components?.schemas?.[schemaName] ||
        {}
      );
    }
  }

  return schema;
}

// =====================================================
// EXAMPLE VALUES
// =====================================================

function exampleFromSchema(schema, openapiSpec) {
  const resolved = resolveSchema(schema, openapiSpec);

  if (resolved.example !== undefined) {
    return resolved.example;
  }

  if (resolved.default !== undefined) {
    return resolved.default;
  }

  if (
    Array.isArray(resolved.enum) &&
    resolved.enum.length > 0
  ) {
    return resolved.enum[0];
  }

  if (
    resolved.type === "object" ||
    resolved.properties
  ) {
    const result = {};

    for (const [name, propertySchema] of Object.entries(
      resolved.properties || {}
    )) {
      result[name] = exampleFromProperty(
        name,
        propertySchema,
        openapiSpec
      );
    }

    return result;
  }

  if (resolved.type === "array") {
    return [];
  }

  if (resolved.type === "integer") {
    return 30;
  }

  if (resolved.type === "number") {
    return 30;
  }

  if (resolved.type === "boolean") {
    return true;
  }

  if (resolved.type === "string") {
    return "example";
  }

  return "example";
}

function exampleFromProperty(
  propertyName,
  schema,
  openapiSpec
) {
  const resolved = resolveSchema(
    schema,
    openapiSpec
  );

  if (resolved.example !== undefined) {
    return resolved.example;
  }

  if (resolved.default !== undefined) {
    return resolved.default;
  }

  if (
    Array.isArray(resolved.enum) &&
    resolved.enum.length > 0
  ) {
    return resolved.enum[0];
  }

  const name = String(propertyName || "").toLowerCase();

  if (
    name === "email" ||
    name.includes("email")
  ) {
    return "john@example.com";
  }

  if (
    name === "name" ||
    name.includes("username")
  ) {
    return "John Doe";
  }

  if (
    name === "age" ||
    name.endsWith("age")
  ) {
    return 30;
  }

  if (
    name === "id" ||
    name.endsWith("id")
  ) {
    return 1;
  }

  return exampleFromSchema(
    resolved,
    openapiSpec
  );
}

// =====================================================
// REQUEST BODY
// =====================================================

function getJsonRequestBody(
  operation,
  openapiSpec
) {
  const requestBody = operation?.requestBody;

  if (!requestBody) {
    return null;
  }

  const content = requestBody.content;

  if (!content || typeof content !== "object") {
    return null;
  }

  const jsonContent =
    content["application/json"] ||
    Object.entries(content).find(([key]) =>
      key.includes("json")
    )?.[1];

  if (!jsonContent) {
    return null;
  }

  if (jsonContent.example !== undefined) {
    return jsonContent.example;
  }

  if (
    jsonContent.examples &&
    typeof jsonContent.examples === "object"
  ) {
    const firstExample = Object.values(
      jsonContent.examples
    )[0];

    if (
      firstExample &&
      firstExample.value !== undefined
    ) {
      return firstExample.value;
    }
  }

  if (jsonContent.schema) {
    return exampleFromSchema(
      jsonContent.schema,
      openapiSpec
    );
  }

  return null;
}

// =====================================================
// PARAMETERS
// =====================================================

function getAllParameters(
  pathItem,
  operation
) {
  const parameters = [];

  if (Array.isArray(pathItem?.parameters)) {
    parameters.push(...pathItem.parameters);
  }

  if (Array.isArray(operation?.parameters)) {
    parameters.push(...operation.parameters);
  }

  return parameters;
}

function getParameterExample(parameter) {
  if (!parameter) {
    return "example";
  }

  if (parameter.example !== undefined) {
    return parameter.example;
  }

  if (parameter.schema) {
    if (parameter.schema.example !== undefined) {
      return parameter.schema.example;
    }

    if (parameter.schema.default !== undefined) {
      return parameter.schema.default;
    }

    if (
      Array.isArray(parameter.schema.enum) &&
      parameter.schema.enum.length > 0
    ) {
      return parameter.schema.enum[0];
    }

    if (
      parameter.schema.type === "integer" ||
      parameter.schema.type === "number"
    ) {
      return 1;
    }
  }

  const name = String(
    parameter.name || ""
  ).toLowerCase();

  if (
    name === "id" ||
    name.endsWith("id") ||
    name.includes("identifier")
  ) {
    return 1;
  }

  return "example";
}

function replacePathParameters(
  path,
  pathItem,
  operation
) {
  const parameters = getAllParameters(
    pathItem,
    operation
  );

  return path.replace(
    /\{([^}]+)\}/g,
    (match, parameterName) => {
      const parameter = parameters.find(
        (item) =>
          item &&
          item.in === "path" &&
          item.name === parameterName
      );

      return String(
        getParameterExample(parameter)
      );
    }
  );
}

// =====================================================
// RESPONSE STATUS
// =====================================================

function getDocumentedSuccessStatus(operation) {
  const responses = operation?.responses;

  if (!responses || typeof responses !== "object") {
    return null;
  }

  const statuses = Object.keys(responses)
    .filter((status) => /^2\d\d$/.test(status))
    .map(Number)
    .sort((a, b) => a - b);

  if (statuses.length === 0) {
    return null;
  }

  return statuses[0];
}

// =====================================================
// BASE URL
// =====================================================

function getBaseUrl(openapiSpec) {
  if (
    Array.isArray(openapiSpec?.servers) &&
    openapiSpec.servers.length > 0 &&
    openapiSpec.servers[0]?.url
  ) {
    return String(openapiSpec.servers[0].url)
      .replace(/\/+$/, "");
  }

  return "http://localhost:8080";
}

// =====================================================
// PYTHON VALUE
// =====================================================

function pythonValue(value, indent = 0) {
  const spaces = " ".repeat(indent);

  if (value === null) {
    return "None";
  }

  if (typeof value === "string") {
    return `'${escapePythonString(value)}'`;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    return `[${value
      .map((item) => pythonValue(item))
      .join(", ")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return "{}";
    }

    const lines = ["{"];

    for (const [key, val] of entries) {
      lines.push(
        `${spaces}    "${key}": ${pythonValue(
          val,
          indent + 4
        )},`
      );
    }

    lines.push(`${spaces}}`);

    return lines.join("\n");
  }

  return "None";
}

// =====================================================
// PYTHON TEST NAME
// =====================================================

function pythonTestName(method, path) {
  const clean = sanitizeName(path);

  const parts = clean
    ? clean
        .split(/\s+/)
        .map((part) => part.toLowerCase())
    : ["root"];

  return `test_${method.toLowerCase()}_${parts.join(
    "_"
  )}`;
}

// =====================================================
// PYTHON - PYTEST
// =====================================================

function generatePythonPytest(
  openapiSpec
) {
  const baseUrl = getBaseUrl(openapiSpec);
  const tests = [];

  const methods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
  ];

  for (const [path, pathItem] of Object.entries(
    openapiSpec.paths
  )) {
    for (const method of methods) {
      const operation = pathItem?.[method];

      if (!operation) {
        continue;
      }

      const actualPath =
        replacePathParameters(
          path,
          pathItem,
          operation
        );

      const testName = pythonTestName(
        method,
        path
      );

      const lines = [];

      lines.push(`def ${testName}():`);

      const body =
        ["post", "put", "patch"].includes(
          method
        )
          ? getJsonRequestBody(
              operation,
              openapiSpec
            )
          : null;

      if (body !== null) {
        lines.push(
          `    data = ${pythonValue(body, 4)}`
        );
      }

      let request = `    response = requests.${method}(`;
      request += `BASE_URL + '${escapePythonString(
        actualPath
      )}'`;

      if (body !== null) {
        request += ", json=data";
      }

      request += ")";

      lines.push(request);

      const status =
        getDocumentedSuccessStatus(
          operation
        );

      if (status !== null) {
        lines.push(
          `    assert response.status_code == ${status}`
        );
      }

      if (lines.length === 1) {
        lines.push("    pass");
      }

      tests.push(lines.join("\n"));
    }
  }

  if (tests.length === 0) {
    throw new Error(
      "No supported API operations were found."
    );
  }

  return [
    "import pytest",
    "import requests",
    "",
    `BASE_URL = "${baseUrl}"`,
    "",
    tests.join("\n\n"),
    "",
  ].join("\n");
}

// =====================================================
// PYTHON - UNITTEST
// =====================================================

function generatePythonUnittest(
  openapiSpec
) {
  const baseUrl = getBaseUrl(openapiSpec);
  const tests = [];

  const methods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
  ];

  for (const [path, pathItem] of Object.entries(
    openapiSpec.paths
  )) {
    for (const method of methods) {
      const operation = pathItem?.[method];

      if (!operation) {
        continue;
      }

      const actualPath =
        replacePathParameters(
          path,
          pathItem,
          operation
        );

      const testName = pythonTestName(
        method,
        path
      );

      const lines = [];

      lines.push("    def " + testName + "(self):");

      const body =
        ["post", "put", "patch"].includes(
          method
        )
          ? getJsonRequestBody(
              operation,
              openapiSpec
            )
          : null;

      if (body !== null) {
        lines.push(
          `        data = ${pythonValue(
            body,
            8
          )}`
        );
      }

      let request =
        `        response = requests.${method}(`;

      request +=
        `BASE_URL + '${escapePythonString(
          actualPath
        )}'`;

      if (body !== null) {
        request += ", json=data";
      }

      request += ")";

      lines.push(request);

      const status =
        getDocumentedSuccessStatus(
          operation
        );

      if (status !== null) {
        lines.push(
          `        self.assertEqual(response.status_code, ${status})`
        );
      }

      if (lines.length === 1) {
        lines.push("        pass");
      }

      tests.push(lines.join("\n"));
    }
  }

  if (tests.length === 0) {
    throw new Error(
      "No supported API operations were found."
    );
  }

  return [
    "import unittest",
    "import requests",
    "",
    `BASE_URL = "${baseUrl}"`,
    "",
    "",
    "class ApiTest(unittest.TestCase):",
    "",
    tests.join("\n\n"),
    "",
    "",
    'if __name__ == "__main__":',
    "    unittest.main()",
    "",
  ].join("\n");
}

// =====================================================
// NODE VALUE
// =====================================================

function nodeValue(value, indent = 0) {
  const spaces = " ".repeat(indent);

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return "{}";
    }

    const lines = ["{"];

    for (const [key, val] of entries) {
      lines.push(
        `${spaces}  ${JSON.stringify(
          key
        )}: ${nodeValue(val, indent + 2)},`
      );
    }

    lines.push(`${spaces}}`);

    return lines.join("\n");
  }

  return "null";
}

function nodeTestName(method, path) {
  const clean = sanitizeName(path);

  const parts = clean
    ? clean
        .split(/\s+/)
        .map((part) => part.toLowerCase())
    : ["root"];

  return `should_${method.toLowerCase()}_${parts.join(
    "_"
  )}`;
}

// =====================================================
// NODE.JS - JEST
// =====================================================

function generateNodeJest(
  openapiSpec
) {
  const baseUrl = getBaseUrl(openapiSpec);
  const tests = [];

  const methods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
  ];

  for (const [path, pathItem] of Object.entries(
    openapiSpec.paths
  )) {
    for (const method of methods) {
      const operation = pathItem?.[method];

      if (!operation) {
        continue;
      }

      const actualPath =
        replacePathParameters(
          path,
          pathItem,
          operation
        );

      const body =
        ["post", "put", "patch"].includes(
          method
        )
          ? getJsonRequestBody(
              operation,
              openapiSpec
            )
          : null;

      const lines = [];

      lines.push(
        `  test('${nodeTestName(
          method,
          path
        )}', async () => {`
      );

      lines.push(
        "    const response = await axios({"
      );

      lines.push(
        `      method: '${method.toUpperCase()}',`
      );

      lines.push(
        `      url: BASE_URL + '${escapeJavaScriptString(
          actualPath
        )}',`
      );

      if (body !== null) {
        lines.push(
          `      data: ${nodeValue(body, 6)},`
        );
      }

      lines.push("    });");

      const status =
        getDocumentedSuccessStatus(
          operation
        );

      if (status !== null) {
        lines.push(
          `    expect(response.status).toBe(${status});`
        );
      }

      lines.push("  });");

      tests.push(lines.join("\n"));
    }
  }

  if (tests.length === 0) {
    throw new Error(
      "No supported API operations were found."
    );
  }

  return [
    "const axios = require('axios');",
    "",
    `const BASE_URL = '${escapeJavaScriptString(
      baseUrl
    )}';`,
    "",
    "describe('API Tests', () => {",
    tests.join("\n\n"),
    "});",
    "",
  ].join("\n");
}

// =====================================================
// NODE.JS - MOCHA
// =====================================================

function generateNodeMocha(
  openapiSpec
) {
  const baseUrl = getBaseUrl(openapiSpec);
  const tests = [];

  const methods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
  ];

  for (const [path, pathItem] of Object.entries(
    openapiSpec.paths
  )) {
    for (const method of methods) {
      const operation = pathItem?.[method];

      if (!operation) {
        continue;
      }

      const actualPath =
        replacePathParameters(
          path,
          pathItem,
          operation
        );

      const body =
        ["post", "put", "patch"].includes(
          method
        )
          ? getJsonRequestBody(
              operation,
              openapiSpec
            )
          : null;

      const lines = [];

      lines.push(
        `  it('${nodeTestName(
          method,
          path
        )}', async function () {`
      );

      lines.push(
        "    const response = await axios({"
      );

      lines.push(
        `      method: '${method.toUpperCase()}',`
      );

      lines.push(
        `      url: BASE_URL + '${escapeJavaScriptString(
          actualPath
        )}',`
      );

      if (body !== null) {
        lines.push(
          `      data: ${nodeValue(body, 6)},`
        );
      }

      lines.push("    });");

      const status =
        getDocumentedSuccessStatus(
          operation
        );

      if (status !== null) {
        lines.push(
          `    assert.strictEqual(response.status, ${status});`
        );
      }

      lines.push("  });");

      tests.push(lines.join("\n"));
    }
  }

  if (tests.length === 0) {
    throw new Error(
      "No supported API operations were found."
    );
  }

  return [
    "const axios = require('axios');",
    "const assert = require('assert');",
    "",
    `const BASE_URL = '${escapeJavaScriptString(
      baseUrl
    )}';`,
    "",
    "describe('API Tests', function () {",
    tests.join("\n\n"),
    "});",
    "",
  ].join("\n");
}

// =====================================================
// SPRING STATUS
// =====================================================

function springStatusMatcher(status) {
  const matchers = {
    200: "isOk()",
    201: "isCreated()",
    202: "isAccepted()",
    204: "isNoContent()",
    205: "isResetContent()",
    206: "isPartialContent()",
    207: "isMultiStatus()",
    208: "isAlreadyReported()",
  };

  return (
    matchers[status] ||
    `is(${status})`
  );
}

// =====================================================
// SPRING REQUEST IMPORT
// =====================================================

function springRequestBuilderImport(method) {
  return `import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.${method};`;
}

// =====================================================
// SPRING BOOT - JUNIT
// =====================================================

function generateSpringJUnit(
  openapiSpec
) {
  const tests = [];

  const methods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
  ];

  const usedMethods = new Set();
  let usesMediaType = false;
  let usesStatus = false;

  for (const [path, pathItem] of Object.entries(
    openapiSpec.paths
  )) {
    for (const method of methods) {
      const operation = pathItem?.[method];

      if (!operation) {
        continue;
      }

      const actualPath =
        replacePathParameters(
          path,
          pathItem,
          operation
        );

      const body =
        ["post", "put", "patch"].includes(
          method
        )
          ? getJsonRequestBody(
              operation,
              openapiSpec
            )
          : null;

      const methodName =
        `test${capitalize(
          method
        )}${toPascalCase(path)}`;

      const lines = [];

      lines.push("    @Test");
      lines.push(
        `    void ${methodName}() throws Exception {`
      );

      if (body !== null) {
        lines.push(
          `        String json = ${escapeJavaString(
            JSON.stringify(body)
          )};`
        );

        lines.push("");
        usesMediaType = true;
      }

      let request =
        `${method}("${actualPath}")`;

      if (body !== null) {
        request +=
          ".contentType(MediaType.APPLICATION_JSON)";
        request += ".content(json)";
      }

      usedMethods.add(method);

      lines.push(
        `        mockMvc.perform(${request})`
      );

      const status =
        getDocumentedSuccessStatus(
          operation
        );

      if (status !== null) {
        usesStatus = true;

        lines.push(
          `                .andExpect(status().${springStatusMatcher(
            status
          )});`
        );
      } else {
        lines[
          lines.length - 1
        ] += ";";
      }

      lines.push("    }");

      tests.push(lines.join("\n"));
    }
  }

  if (tests.length === 0) {
    throw new Error(
      "No supported API operations were found."
    );
  }

  const imports = [
    "import org.junit.jupiter.api.Test;",
    "import org.springframework.beans.factory.annotation.Autowired;",
    "import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;",
    "import org.springframework.boot.test.context.SpringBootTest;",
  ];

  if (usesMediaType) {
    imports.push(
      "import org.springframework.http.MediaType;"
    );
  }

  imports.push(
    "import org.springframework.test.web.servlet.MockMvc;"
  );

  for (const method of methods) {
    if (usedMethods.has(method)) {
      imports.push(
        springRequestBuilderImport(method)
      );
    }
  }

  if (usesStatus) {
    imports.push(
      "import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;"
    );
  }

  return [
    ...imports,
    "",
    "@SpringBootTest",
    "@AutoConfigureMockMvc",
    "public class ApiTest {",
    "",
    "    @Autowired",
    "    private MockMvc mockMvc;",
    "",
    tests.join("\n\n"),
    "",
    "}",
    "",
  ].join("\n");
}

// =====================================================
// SPRING BOOT - TESTNG
// =====================================================

function generateSpringTestNG(
  openapiSpec
) {
  const tests = [];

  const methods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
  ];

  const usedMethods = new Set();
  let usesMediaType = false;
  let usesStatus = false;

  for (const [path, pathItem] of Object.entries(
    openapiSpec.paths
  )) {
    for (const method of methods) {
      const operation = pathItem?.[method];

      if (!operation) {
        continue;
      }

      const actualPath =
        replacePathParameters(
          path,
          pathItem,
          operation
        );

      const body =
        ["post", "put", "patch"].includes(
          method
        )
          ? getJsonRequestBody(
              operation,
              openapiSpec
            )
          : null;

      const methodName =
        `test${capitalize(
          method
        )}${toPascalCase(path)}`;

      const lines = [];

      lines.push("    @Test");
      lines.push(
        `    public void ${methodName}() throws Exception {`
      );

      if (body !== null) {
        lines.push(
          `        String json = ${escapeJavaString(
            JSON.stringify(body)
          )};`
        );

        lines.push("");
        usesMediaType = true;
      }

      let request =
        `${method}("${actualPath}")`;

      if (body !== null) {
        request +=
          ".contentType(MediaType.APPLICATION_JSON)";
        request += ".content(json)";
      }

      usedMethods.add(method);

      lines.push(
        `        mockMvc.perform(${request})`
      );

      const status =
        getDocumentedSuccessStatus(
          operation
        );

      if (status !== null) {
        usesStatus = true;

        lines.push(
          `                .andExpect(status().${springStatusMatcher(
            status
          )});`
        );
      } else {
        lines[
          lines.length - 1
        ] += ";";
      }

      lines.push("    }");

      tests.push(lines.join("\n"));
    }
  }

  if (tests.length === 0) {
    throw new Error(
      "No supported API operations were found."
    );
  }

  const imports = [
    "import org.springframework.beans.factory.annotation.Autowired;",
    "import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;",
    "import org.springframework.boot.test.context.SpringBootTest;",
    "import org.springframework.test.web.servlet.MockMvc;",
    "import org.testng.annotations.Test;",
  ];

  if (usesMediaType) {
    imports.push(
      "import org.springframework.http.MediaType;"
    );
  }

  for (const method of methods) {
    if (usedMethods.has(method)) {
      imports.push(
        springRequestBuilderImport(method)
      );
    }
  }

  if (usesStatus) {
    imports.push(
      "import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;"
    );
  }

  return [
    ...imports,
    "",
    "@SpringBootTest",
    "@AutoConfigureMockMvc",
    "public class ApiTest {",
    "",
    "    @Autowired",
    "    private MockMvc mockMvc;",
    "",
    tests.join("\n\n"),
    "",
    "}",
    "",
  ].join("\n");
}

// =====================================================
// NORMALIZE INPUT
// =====================================================

function normalizeLanguage(language) {
  return String(language || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeFramework(framework) {
  return String(framework || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// =====================================================
// GENERATE TESTS
// =====================================================

app.post(
  "/generate-tests",
  async (req, res) => {
    try {
      const {
        openapiSpec,
        language,
        framework,
      } = req.body;

      if (!openapiSpec) {
        return res.status(400).json({
          success: false,
          error:
            "OpenAPI specification is required.",
        });
      }

      if (!language) {
        return res.status(400).json({
          success: false,
          error:
            "Target language is required.",
        });
      }

      if (!framework) {
        return res.status(400).json({
          success: false,
          error:
            "Testing framework is required.",
        });
      }

      const normalizedLanguage =
        normalizeLanguage(language);

      const normalizedFramework =
        normalizeFramework(framework);

      console.log(
        `Generating ${language} / ${framework} tests...`
      );

      // =================================================
// OLLAMA AI ANALYSIS
// =================================================

let aiAnalysis = "";

try {
  aiAnalysis = await analyzeWithOllama(
    openapiSpec
  );

  console.log("\n===== OLLAMA AI ANALYSIS =====");
  console.log(aiAnalysis);
  console.log("===== END OLLAMA AI ANALYSIS =====\n");
} catch (error) {
  console.error(
    "Ollama analysis failed:",
    error.message
  );
}

      // =================================================
      // PYTHON
      // =================================================

      if (
        normalizedLanguage === "python"
      ) {
        if (
          normalizedFramework ===
            "pytest" ||
          normalizedFramework ===
            "py.test"
        ) {
          return res.json({
            success: true,
            language: "Python",
            framework: "Pytest",
            filename: "test_api.py",
            generatedCode:
              generatePythonPytest(
                openapiSpec
              ),
          });
        }

        if (
          normalizedFramework ===
          "unittest"
        ) {
          return res.json({
            success: true,
            language: "Python",
            framework: "Unittest",
            filename: "test_api.py",
            generatedCode:
              generatePythonUnittest(
                openapiSpec
              ),
          });
        }

        return res.status(400).json({
          success: false,
          error:
            "Unsupported Python framework. Choose Pytest or Unittest.",
        });
      }

      // =================================================
      // NODE.JS
      // =================================================

      if (
        normalizedLanguage === "node.js" ||
        normalizedLanguage === "nodejs" ||
        normalizedLanguage === "node"
      ) {
        if (
          normalizedFramework ===
          "jest"
        ) {
          return res.json({
            success: true,
            language: "Node.js",
            framework: "Jest",
            filename: "api.test.js",
            generatedCode:
              generateNodeJest(
                openapiSpec
              ),
          });
        }

        if (
          normalizedFramework ===
          "mocha"
        ) {
          return res.json({
            success: true,
            language: "Node.js",
            framework: "Mocha",
            filename: "api.test.js",
            generatedCode:
              generateNodeMocha(
                openapiSpec
              ),
          });
        }

        return res.status(400).json({
          success: false,
          error:
            "Unsupported Node.js framework. Choose Jest or Mocha.",
        });
      }

      // =================================================
      // SPRING BOOT
      // =================================================

      if (
        normalizedLanguage ===
          "spring boot" ||
        normalizedLanguage ===
          "springboot" ||
        normalizedLanguage ===
          "java"
      ) {
        if (
          normalizedFramework ===
          "junit"
        ) {
          return res.json({
            success: true,
            language: "Spring Boot",
            framework: "JUnit",
            filename: "ApiTest.java",
            generatedCode:
              generateSpringJUnit(
                openapiSpec
              ),
          });
        }

        if (
          normalizedFramework ===
          "testng"
        ) {
          return res.json({
            success: true,
            language: "Spring Boot",
            framework: "TestNG",
            filename: "ApiTest.java",
            generatedCode:
              generateSpringTestNG(
                openapiSpec
              ),
          });
        }

        return res.status(400).json({
          success: false,
          error:
            "Unsupported Spring Boot framework. Choose JUnit or TestNG.",
        });
      }

      return res.status(400).json({
        success: false,
        error:
          `Unsupported target language: ${language}`,
      });
    } catch (error) {
      console.error(
        "Generation error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to generate test code.",
      });
    }
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(
    `AI Bridge running at http://localhost:${PORT}`
  );

  console.log(
    "Supported combinations:"
  );

  console.log(
    "Python  -> Pytest / Unittest"
  );

  console.log(
    "Node.js -> Jest / Mocha"
  );

  console.log(
    "Spring Boot -> JUnit / TestNG"
  );
});