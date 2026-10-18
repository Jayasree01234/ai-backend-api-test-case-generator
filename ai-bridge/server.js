const express = require("express");
const cors = require("cors");

const OLLAMA_URL = "http://localhost:11434";
const OLLAMA_MODEL = "llama3.2:3b";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// =====================================================
// OLLAMA AI ANALYSIS
// =====================================================

async function analyzeWithOllama(openapiSpec) {
  const prompt = `
You are an expert API test engineer.

Analyze the OpenAPI specification and return JSON only:

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
          "description": "Retrieve users successfully."
        }
      ]
    }
  ]
}

Rules:
1. Use only paths and methods present in the specification.
2. Never invent parameters, request fields, schemas, or authentication requirements.
3. Generate parameter tests only for defined parameters.
4. Generate body tests only when a request body and schema exist.
5. Prefer documented response status codes.
6. Do not invent negative tests merely because a 4xx response is documented.
7. Identify the exact field or parameter involved in each negative test.
8. Missing-field tests must identify an actual required field.
9. Invalid-field tests must identify an actual schema property.
10. A non-existent-resource test requires a path parameter and a documented 404.
11. Do not generate query tests if no query parameters exist.
12. Do not generate body tests if no request body exists.
13. Include positive scenarios when supported by the specification.
14. Return valid JSON only, without markdown.

OpenAPI specification:
${JSON.stringify(openapiSpec, null, 2)}
`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawResponse = String(data.response || "").trim();

  try {
    const firstBrace = rawResponse.indexOf("{");
    const lastBrace = rawResponse.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON object found.");
    }

    const parsed = JSON.parse(
      rawResponse.substring(firstBrace, lastBrace + 1)
    );

    if (!parsed || !Array.isArray(parsed.apis)) {
      throw new Error("Invalid AI scenario structure.");
    }

    return parsed;
  } catch (error) {
    console.error("Invalid Ollama JSON response:", rawResponse);
    throw new Error("Ollama returned an invalid test scenario response.");
  }
}

// =====================================================
// BASIC ROUTES
// =====================================================

app.get("/", (req, res) => {
  res.json({ message: "AI Bridge is running" });
});

app.get("/test-ollama", async (req, res) => {
  try {
    const testSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            responses: {
              "200": { description: "Successful response" },
            },
          },
        },
      },
    };

    const ollamaResponse = await analyzeWithOllama(testSpec);
    res.json({ success: true, ollamaResponse });
  } catch (error) {
    console.error("Test Ollama error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Ollama test failed.",
    });
  }
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
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function toPascalCase(value) {
  return (
    sanitizeName(value)
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => capitalize(part.toLowerCase()))
      .join("") || "Endpoint"
  );
}

function escapePythonString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function escapeJavaScriptString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

// =====================================================
// OPENAPI RESOLUTION
// =====================================================

function resolveSchema(schema, openapiSpec) {
  if (!schema || typeof schema !== "object") return {};

  if (schema.$ref) {
    const prefix = "#/components/schemas/";

    if (schema.$ref.startsWith(prefix)) {
      const name = schema.$ref.substring(prefix.length);
      return openapiSpec?.components?.schemas?.[name] || {};
    }
  }

  return schema;
}

function resolveParameter(parameter, openapiSpec) {
  if (!parameter || typeof parameter !== "object") return null;

  if (parameter.$ref) {
    const prefix = "#/components/parameters/";

    if (parameter.$ref.startsWith(prefix)) {
      const name = parameter.$ref.substring(prefix.length);
      return openapiSpec?.components?.parameters?.[name] || null;
    }
  }

  return parameter;
}

function resolveRequestBodyReference(requestBody, openapiSpec) {
  if (!requestBody?.$ref) return requestBody;

  const prefix = "#/components/requestBodies/";

  if (!requestBody.$ref.startsWith(prefix)) return requestBody;

  const name = requestBody.$ref.substring(prefix.length);

  return openapiSpec?.components?.requestBodies?.[name] || null;
}

// =====================================================
// EXAMPLE VALUES
// =====================================================

function exampleFromSchema(schema, openapiSpec) {
  const resolved = resolveSchema(schema, openapiSpec);

  if (resolved.example !== undefined) return cloneValue(resolved.example);
  if (resolved.default !== undefined) return cloneValue(resolved.default);

  if (Array.isArray(resolved.enum) && resolved.enum.length) {
    return cloneValue(resolved.enum[0]);
  }

  if (resolved.type === "object" || resolved.properties) {
    const result = {};

    for (const [name, propertySchema] of Object.entries(
      resolved.properties || {}
    )) {
      result[name] = exampleFromProperty(name, propertySchema, openapiSpec);
    }

    return result;
  }

  if (resolved.type === "array") return [];
  if (resolved.type === "integer" || resolved.type === "number") return 30;
  if (resolved.type === "boolean") return true;
  if (resolved.type === "string") return "example";

  return "example";
}

function exampleFromProperty(propertyName, schema, openapiSpec) {
  const resolved = resolveSchema(schema, openapiSpec);

  if (resolved.example !== undefined) return cloneValue(resolved.example);
  if (resolved.default !== undefined) return cloneValue(resolved.default);

  if (Array.isArray(resolved.enum) && resolved.enum.length) {
    return cloneValue(resolved.enum[0]);
  }

  const name = String(propertyName || "").toLowerCase();

  if (resolved.format === "email" || name.includes("email")) {
    return "john@example.com";
  }

  if (name === "name" || name.includes("username")) return "John Doe";
  if (name === "age" || name.endsWith("age")) return 30;
  if (name === "id" || name.endsWith("id")) return 1;

  return exampleFromSchema(resolved, openapiSpec);
}

// =====================================================
// REQUEST BODY
// =====================================================

function getJsonContent(operation, openapiSpec) {
  let requestBody = operation?.requestBody;

  if (!requestBody) return null;

  if (requestBody.$ref) {
    requestBody = resolveRequestBodyReference(requestBody, openapiSpec);
  }

  const content = requestBody?.content;

  if (!content || typeof content !== "object") return null;

  return (
    content["application/json"] ||
    Object.entries(content).find(([key]) =>
      key.toLowerCase().includes("json")
    )?.[1] ||
    null
  );
}

function getJsonRequestBody(operation, openapiSpec) {
  const content = getJsonContent(operation, openapiSpec);

  if (!content) return null;
  if (content.example !== undefined) return cloneValue(content.example);

  if (content.examples && typeof content.examples === "object") {
    const firstExample = Object.values(content.examples)[0];

    if (firstExample && firstExample.value !== undefined) {
      return cloneValue(firstExample.value);
    }
  }

  return content.schema
    ? exampleFromSchema(content.schema, openapiSpec)
    : null;
}

function getRequestBodySchema(operation, openapiSpec) {
  return getJsonContent(operation, openapiSpec)?.schema || null;
}

function getBodyProperties(operation, openapiSpec) {
  const schema = getRequestBodySchema(operation, openapiSpec);

  if (!schema) {
    return { schema: null, properties: {}, required: [] };
  }

  const resolved = resolveSchema(schema, openapiSpec);

  return {
    schema: resolved,
    properties: resolved.properties || {},
    required: Array.isArray(resolved.required) ? resolved.required : [],
  };
}

// =====================================================
// PARAMETERS
// =====================================================

function getAllParameters(pathItem, operation, openapiSpec) {
  const parameters = [
    ...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation?.parameters) ? operation.parameters : []),
  ]
    .map((parameter) => resolveParameter(parameter, openapiSpec))
    .filter(Boolean);

  const unique = new Map();

  for (const parameter of parameters) {
    const key = `${parameter.in}:${parameter.name}`;
    unique.set(key, parameter);
  }

  return Array.from(unique.values());
}

function getParameterExample(parameter, openapiSpec) {
  if (!parameter) return "example";

  if (parameter.example !== undefined) return cloneValue(parameter.example);

  const schema = resolveSchema(parameter.schema || {}, openapiSpec);

  if (schema.example !== undefined) return cloneValue(schema.example);
  if (schema.default !== undefined) return cloneValue(schema.default);

  if (Array.isArray(schema.enum) && schema.enum.length) {
    return cloneValue(schema.enum[0]);
  }

  if (schema.type === "integer" || schema.type === "number") return 1;
  if (schema.type === "boolean") return true;

  const name = String(parameter.name || "").toLowerCase();

  if (name === "id" || name.endsWith("id") || name.includes("identifier")) {
    return 1;
  }

  return "example";
}

// =====================================================
// PATH AND RESPONSE HELPERS
// =====================================================

function buildPath(path, pathItem, operation, openapiSpec, overrides = {}) {
  const parameters = getAllParameters(pathItem, operation, openapiSpec);

  return path.replace(/\{([^}]+)\}/g, (match, name) => {
    const parameter = parameters.find(
      (item) => item.in === "path" && item.name === name
    );

    const value = Object.prototype.hasOwnProperty.call(overrides, name)
      ? overrides[name]
      : getParameterExample(parameter, openapiSpec);

    return encodeURIComponent(String(value));
  });
}

function getDocumentedSuccessStatus(operation) {
  const statuses = Object.keys(operation?.responses || {})
    .filter((status) => /^2\d\d$/.test(status))
    .map(Number)
    .sort((a, b) => a - b);

  return statuses.length ? statuses[0] : null;
}

function getDocumentedStatuses(operation) {
  return new Set(
    Object.keys(operation?.responses || {})
      .filter((status) => /^\d{3}$/.test(status))
      .map(Number)
  );
}

function getBaseUrl(openapiSpec) {
  const url = openapiSpec?.servers?.[0]?.url;

  return url ? String(url).replace(/\/+$/, "") : "http://localhost:8080";
}

// =====================================================
// CODE VALUE SERIALIZERS
// =====================================================

function pythonValue(value, indent = 0) {
  const spaces = " ".repeat(indent);

  if (value === null) return "None";
  if (typeof value === "string") return `'${escapePythonString(value)}'`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "True" : "False";

  if (Array.isArray(value)) {
    return `[${value.map((item) => pythonValue(item)).join(", ")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    if (!entries.length) return "{}";

    return [
      "{",
      ...entries.map(
        ([key, val]) =>
          `${spaces}    ${JSON.stringify(key)}: ${pythonValue(val, indent + 4)},`
      ),
      `${spaces}}`,
    ].join("\n");
  }

  return "None";
}

function nodeValue(value, indent = 0) {
  const spaces = " ".repeat(indent);

  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return `[${value.map((item) => nodeValue(item)).join(", ")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    if (!entries.length) return "{}";

    return [
      "{",
      ...entries.map(
        ([key, val]) =>
          `${spaces}  ${JSON.stringify(key)}: ${nodeValue(val, indent + 2)},`
      ),
      `${spaces}}`,
    ].join("\n");
  }

  return "null";
}

// =====================================================
// SCENARIO CLASSIFICATION
// =====================================================

function scenarioText(test) {
  return `${String(test?.name || "").toLowerCase()} ${String(
    test?.description || ""
  ).toLowerCase()}`;
}

function isQueryScenario(text) {
  return (
    text.includes("query parameter") ||
    text.includes("query parameters") ||
    /\bquery\b/.test(text)
  );
}

function isMissingFieldScenario(text) {
  return [
    "missing required field",
    "missing field",
    "required field",
    "missing property",
    "without required",
  ].some((phrase) => text.includes(phrase));
}

function isNonExistentScenario(text) {
  return [
    "non-existent",
    "nonexistent",
    "does not exist",
    "doesn't exist",
    "not found",
    "missing resource",
    "unknown resource",
  ].some((phrase) => text.includes(phrase));
}

function isInvalidScenario(text) {
  return [
    "invalid",
    "incorrect",
    "wrong",
    "malformed",
    "bad ",
    "non-numeric",
    "non numeric",
    "non-integer",
    "non integer",
  ].some((phrase) => text.includes(phrase));
}

function isPathScenario(text, pathParameters, expectedStatus) {
  if (
    [
      "path parameter",
      "path param",
      "invalid path",
      "malformed path",
      "incorrect path",
      "wrong path",
      "bad path",
      "invalid id",
      "invalid identifier",
      "non-integer id",
      "non integer id",
      "non numeric id",
      "non-numeric id",
      "invalid path id",
      "invalid path identifier",
    ].some((phrase) => text.includes(phrase))
  ) {
    return true;
  }

  return (
    pathParameters.length > 0 &&
    expectedStatus === 404 &&
    isNonExistentScenario(text)
  );
}

function findBodyPropertyFromText(text, properties) {
  for (const field of Object.keys(properties)) {
    const name = field.toLowerCase();

    if (
      [
        `invalid ${name}`,
        `${name} invalid`,
        `wrong ${name}`,
        `${name} wrong`,
        `incorrect ${name}`,
        `${name} incorrect`,
        `invalid ${name} value`,
        `invalid ${name} format`,
        `${name} format`,
        `${name} is invalid`,
        `${name} is wrong`,
        `non numeric ${name}`,
        `non-numeric ${name}`,
        `empty ${name}`,
        `${name} empty`,
        `blank ${name}`,
        `${name} blank`,
      ].some((phrase) => text.includes(phrase))
    ) {
      return field;
    }
  }

  for (const field of Object.keys(properties)) {
    if (text.includes(field.toLowerCase()) && isInvalidScenario(text)) {
      return field;
    }
  }

  return null;
}

function findMissingBodyPropertyFromText(text, properties, required) {
  for (const field of required) {
    const name = field.toLowerCase();

    if (
      [
        `missing ${name}`,
        `missing required ${name}`,
        `${name} is missing`,
        `without ${name}`,
        `omit ${name}`,
        `omitting ${name}`,
      ].some((phrase) => text.includes(phrase))
    ) {
      return field;
    }
  }

  if (isMissingFieldScenario(text)) {
    return required[0] || null;
  }

  return null;
}

function invalidValueForSchema(schema, openapiSpec) {
  const resolved = resolveSchema(schema, openapiSpec);

  if (resolved.format === "email") return "not-an-email";
  if (resolved.format === "date") return "not-a-date";
  if (resolved.format === "date-time") return "not-a-datetime";

  if (Array.isArray(resolved.enum) && resolved.enum.length) {
    return "__invalid_enum_value__";
  }

  switch (resolved.type) {
    case "integer":
      return "invalid-integer";
    case "number":
      return "invalid-number";
    case "boolean":
      return "not-a-boolean";
    case "string":
      return "invalid-string";
    case "array":
      return "not-an-array";
    case "object":
      return "not-an-object";
    default:
      return "__invalid_value__";
  }
}

// =====================================================
// BUILD REQUEST BODY FOR A SCENARIO
// =====================================================

function buildBodyForScenario(aiTest, operation, openapiSpec) {
  const normalBody = getJsonRequestBody(operation, openapiSpec);

  if (normalBody === null) return null;

  const text = scenarioText(aiTest);
  const { properties, required } = getBodyProperties(
    operation,
    openapiSpec
  );

  // An empty request body must actually omit the body.
  if (text.includes("empty request body") || text.includes("empty body")) {
    return null;
  }

  // Malformed JSON cannot be represented by the JSON-body generators.
  // Skip this scenario rather than falsely generating a valid JSON object.
  if (
    text.includes("malformed json") ||
    text.includes("invalid json") ||
    text.includes("body is not valid json") ||
    text.includes("non-json body")
  ) {
    return null;
  }

  if (
    normalBody &&
    typeof normalBody === "object" &&
    !Array.isArray(normalBody) &&
    isMissingFieldScenario(text)
  ) {
    const field = findMissingBodyPropertyFromText(
      text,
      properties,
      required
    );

    if (!field || !required.includes(field)) {
      console.log(
        `Skipping unsupported missing-field scenario: ${aiTest?.name}`
      );
      return cloneValue(normalBody);
    }

    const body = cloneValue(normalBody);
    delete body[field];
    return body;
  }

  if (
    normalBody &&
    typeof normalBody === "object" &&
    !Array.isArray(normalBody)
  ) {
    const field = findBodyPropertyFromText(text, properties);

    if (field) {
      const body = cloneValue(normalBody);
      body[field] = invalidValueForSchema(properties[field], openapiSpec);
      return body;
    }
  }

  return cloneValue(normalBody);
}

// =====================================================
// PATH AND QUERY VALUES
// =====================================================

function getNonExistentPathValue(parameter, openapiSpec) {
  const schema = resolveSchema(parameter?.schema || {}, openapiSpec);

  if (schema.type === "integer" || schema.type === "number") return 999999;
  if (schema.type === "string") return "non-existent-resource";
  if (schema.type === "boolean") return "not-a-boolean";

  return "999999";
}

function getInvalidPathValue(parameter, openapiSpec) {
  const schema = resolveSchema(parameter?.schema || {}, openapiSpec);

  if (schema.type === "integer" || schema.type === "number") return "invalid";
  if (schema.type === "boolean") return "not-a-boolean";

  return "invalid";
}

function getQueryValue(parameter, text, openapiSpec) {
  const schema = resolveSchema(parameter?.schema || {}, openapiSpec);

  if (text.includes("empty") || text.includes("blank")) return "";

  if (
    isInvalidScenario(text) &&
    (schema.type === "integer" || schema.type === "number")
  ) {
    return "invalid";
  }

  if (text.includes("boolean")) return "not-a-boolean";

  return getParameterExample(parameter, openapiSpec);
}

function buildRequestForScenario(
  aiTest,
  path,
  pathItem,
  operation,
  openapiSpec
) {
  const text = scenarioText(aiTest);
  const expectedStatus = Number(aiTest?.expectedStatus);

  const parameters = getAllParameters(pathItem, operation, openapiSpec);
  const pathParameters = parameters.filter((item) => item.in === "path");
  const queryParameters = parameters.filter((item) => item.in === "query");

  const pathOverrides = {};
  let queryParams = null;

  if (isPathScenario(text, pathParameters, expectedStatus)) {
    const parameter =
      pathParameters.find((item) =>
        text.includes(String(item.name).toLowerCase())
      ) || pathParameters[0];

    if (parameter) {
      pathOverrides[parameter.name] =
        expectedStatus === 404 && isNonExistentScenario(text)
          ? getNonExistentPathValue(parameter, openapiSpec)
          : getInvalidPathValue(parameter, openapiSpec);
    }
  }

  if (isQueryScenario(text) && queryParameters.length) {
    const parameter =
      queryParameters.find((item) =>
        text.includes(String(item.name).toLowerCase())
      ) || queryParameters[0];

    queryParams = {
      [parameter.name]: getQueryValue(parameter, text, openapiSpec),
    };
  } else {
    const requiredQueries = queryParameters.filter(
      (parameter) => parameter.required === true
    );

    if (
      requiredQueries.length &&
      !isInvalidScenario(text) &&
      !isNonExistentScenario(text)
    ) {
      queryParams = {};

      for (const parameter of requiredQueries) {
        queryParams[parameter.name] = getParameterExample(
          parameter,
          openapiSpec
        );
      }
    }
  }

  return {
    path: buildPath(
      path,
      pathItem,
      operation,
      openapiSpec,
      pathOverrides
    ),
    queryParams,
  };
}

// =====================================================
// VALIDATE AI TESTS
// =====================================================

function validateAiTests(aiTests, pathItem, operation, openapiSpec) {
  if (!Array.isArray(aiTests)) return [];

  const parameters = getAllParameters(pathItem, operation, openapiSpec);
  const queryParameters = parameters.filter((item) => item.in === "query");
  const pathParameters = parameters.filter((item) => item.in === "path");
  const hasRequestBody = !!operation?.requestBody;
  const documentedStatuses = getDocumentedStatuses(operation);

  const { properties, required } = getBodyProperties(
    operation,
    openapiSpec
  );

  const seen = new Set();

  return aiTests.filter((test) => {
    if (!test || typeof test !== "object") return false;

    const text = scenarioText(test);
    const status = Number(test.expectedStatus);
    const type = normalizeName(test.type);

    if (
      Number.isInteger(status) &&
      documentedStatuses.size > 0 &&
      !documentedStatuses.has(status)
    ) {
      console.log(`Skipping "${test.name}": undocumented status ${status}.`);
      return false;
    }

    if (isQueryScenario(text) && queryParameters.length === 0) {
      console.log(`Skipping "${test.name}": no query parameter exists.`);
      return false;
    }

    if (
      isPathScenario(text, pathParameters, status) &&
      pathParameters.length === 0
    ) {
      console.log(`Skipping "${test.name}": no path parameter exists.`);
      return false;
    }

    const bodyScenario =
      isMissingFieldScenario(text) ||
      text.includes("request body") ||
      text.includes("json body") ||
      text.includes("body field");

    if (bodyScenario && !hasRequestBody) {
      console.log(`Skipping "${test.name}": no request body exists.`);
      return false;
    }

    if (isMissingFieldScenario(text)) {
      const field = findMissingBodyPropertyFromText(text, properties, required);

      if (!field || !required.includes(field)) {
        console.log(
          `Skipping "${test.name}": missing field is not a defined required property.`
        );
        return false;
      }
    }

    if (
      isInvalidScenario(text) &&
      hasRequestBody &&
      !isPathScenario(text, pathParameters, status) &&
      !isQueryScenario(text) &&
      !text.includes("malformed json") &&
      !text.includes("invalid json") &&
      !text.includes("empty body") &&
      !text.includes("empty request body") &&
      !findBodyPropertyFromText(text, properties)
    ) {
      console.log(
        `Skipping "${test.name}": no matching request-body field was found.`
      );
      return false;
    }

    if (type === "negative" && parameters.length === 0 && !hasRequestBody) {
      console.log(
        `Skipping "${test.name}": no input exists for a negative test.`
      );
      return false;
    }

    const key = [
      test.name,
      test.expectedStatus,
      test.type,
      test.description,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .join("|");

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

// =====================================================
// SCENARIO LIST
// =====================================================

function getScenarios(path, pathItem, operation, aiAnalysis, openapiSpec) {
  const method = Object.keys(pathItem).find(
    (key) => pathItem[key] === operation
  );

  const aiApi = (aiAnalysis?.apis || []).find(
    (api) =>
      api &&
      api.path === path &&
      normalizeName(api.method) === normalizeName(method)
  );

  const validated = validateAiTests(
    aiApi?.tests,
    pathItem,
    operation,
    openapiSpec
  );

  if (validated.length) return validated;

  const successStatus = getDocumentedSuccessStatus(operation);

  return [
    {
      name: `${capitalize(method)} ${path} successfully`,
      type: "positive",
      expectedStatus: successStatus,
      description: "Execute the operation successfully.",
    },
  ];
}

// =====================================================
// PYTHON REQUEST
// =====================================================

function buildPythonRequest(method, requestInfo, body) {
  let request = `    response = requests.${method}(`;
  request += `BASE_URL + '${escapePythonString(requestInfo.path)}'`;

  if (body !== null) request += ", json=data";

  if (requestInfo.queryParams !== null) {
    request += `, params=${pythonValue(requestInfo.queryParams)}`;
  }

  return `${request})`;
}

// =====================================================
// PYTHON GENERATORS
// =====================================================

function generatePython(openapiSpec, aiAnalysis, useUnittest) {
  const baseUrl = getBaseUrl(openapiSpec);
  const tests = [];
  const methods = ["get", "post", "put", "patch", "delete"];

  for (const [path, pathItem] of Object.entries(openapiSpec.paths || {})) {
    for (const method of methods) {
      const operation = pathItem?.[method];
      if (!operation) continue;

      const scenarios = getScenarios(
        path,
        pathItem,
        operation,
        aiAnalysis,
        openapiSpec
      );

      const defaultBody = ["post", "put", "patch"].includes(method)
        ? getJsonRequestBody(operation, openapiSpec)
        : null;

      scenarios.forEach((test, index) => {
        const safeName =
          sanitizeName(test.name)
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "") || `${method}_test`;

        const testName = `test_${safeName}_${index + 1}`;
        const requestBody =
          defaultBody !== null
            ? buildBodyForScenario(test, operation, openapiSpec)
            : null;

        const requestInfo = buildRequestForScenario(
          test,
          path,
          pathItem,
          operation,
          openapiSpec
        );

        const indent = useUnittest ? "        " : "    ";
        const lines = [
          useUnittest
            ? `    def ${testName}(self):`
            : `def ${testName}():`,
        ];

        if (requestBody !== null) {
          lines.push(`${indent}data = ${pythonValue(requestBody, indent.length)}`);
        }

        if (useUnittest) {
          let request = `        response = requests.${method}(`;
          request += `BASE_URL + '${escapePythonString(requestInfo.path)}'`;

          if (requestBody !== null) request += ", json=data";

          if (requestInfo.queryParams !== null) {
            request += `, params=${pythonValue(requestInfo.queryParams)}`;
          }

          lines.push(`${request})`);
        } else {
          lines.push(buildPythonRequest(method, requestInfo, requestBody));
        }

        let status = Number(test.expectedStatus);

        if (!Number.isInteger(status)) {
          status = getDocumentedSuccessStatus(operation);
        }

        if (Number.isInteger(status)) {
          lines.push(
            useUnittest
              ? `        self.assertEqual(response.status_code, ${status})`
              : `    assert response.status_code == ${status}`
          );
        }

        tests.push(lines.join("\n"));
      });
    }
  }

  if (!tests.length) {
    throw new Error("No supported API operations were found.");
  }

  if (useUnittest) {
    return [
      "import unittest",
      "import requests",
      "",
      `BASE_URL = "${baseUrl}"`,
      "",
      "class ApiTest(unittest.TestCase):",
      "",
      tests.join("\n\n"),
      "",
      'if __name__ == "__main__":',
      "    unittest.main()",
      "",
    ].join("\n");
  }

  return [
    "import requests",
    "",
    `BASE_URL = "${baseUrl}"`,
    "",
    tests.join("\n\n"),
    "",
  ].join("\n");
}

function generatePythonPytest(openapiSpec, aiAnalysis) {
  return generatePython(openapiSpec, aiAnalysis, false);
}

function generatePythonUnittest(openapiSpec, aiAnalysis) {
  return generatePython(openapiSpec, aiAnalysis, true);
}

// =====================================================
// NODE GENERATORS
// =====================================================

function buildNodeRequest(method, requestInfo, body) {
  const lines = [
    "    const response = await axios({",
    `      method: '${method.toUpperCase()}',`,
    `      url: BASE_URL + '${escapeJavaScriptString(requestInfo.path)}',`,
    "      validateStatus: () => true,",
  ];

  if (body !== null) lines.push(`      data: ${nodeValue(body, 6)},`);

  if (requestInfo.queryParams !== null) {
    lines.push(`      params: ${nodeValue(requestInfo.queryParams, 6)},`);
  }

  lines.push("    });");
  return lines.join("\n");
}

function generateNode(openapiSpec, aiAnalysis, useJest) {
  const baseUrl = getBaseUrl(openapiSpec);
  const tests = [];
  const methods = ["get", "post", "put", "patch", "delete"];

  for (const [path, pathItem] of Object.entries(openapiSpec.paths || {})) {
    for (const method of methods) {
      const operation = pathItem?.[method];
      if (!operation) continue;

      const scenarios = getScenarios(
        path,
        pathItem,
        operation,
        aiAnalysis,
        openapiSpec
      );

      const defaultBody = ["post", "put", "patch"].includes(method)
        ? getJsonRequestBody(operation, openapiSpec)
        : null;

      scenarios.forEach((test, index) => {
        const body =
          defaultBody !== null
            ? buildBodyForScenario(test, operation, openapiSpec)
            : null;

        const requestInfo = buildRequestForScenario(
          test,
          path,
          pathItem,
          operation,
          openapiSpec
        );

        const name = `${sanitizeName(test.name) || method}_${index + 1}`;
        const lines = [
          useJest
            ? `  test('${escapeJavaScriptString(name)}', async () => {`
            : `  it('${escapeJavaScriptString(name)}', async function () {`,
        ];

        lines.push(buildNodeRequest(method, requestInfo, body));

        let status = Number(test.expectedStatus);

        if (!Number.isInteger(status)) {
          status = getDocumentedSuccessStatus(operation);
        }

        if (Number.isInteger(status)) {
          lines.push(
            useJest
              ? `    expect(response.status).toBe(${status});`
              : `    assert.strictEqual(response.status, ${status});`
          );
        }

        lines.push("  });");
        tests.push(lines.join("\n"));
      });
    }
  }

  if (!tests.length) {
    throw new Error("No supported API operations were found.");
  }

  return [
    "const axios = require('axios');",
    ...(useJest ? [] : ["const assert = require('assert');"]),
    "",
    `const BASE_URL = '${escapeJavaScriptString(baseUrl)}';`,
    "",
    useJest
      ? "describe('API Tests', () => {"
      : "describe('API Tests', function () {",
    tests.join("\n\n"),
    "});",
    "",
  ].join("\n");
}

function generateNodeJest(openapiSpec, aiAnalysis) {
  return generateNode(openapiSpec, aiAnalysis, true);
}

function generateNodeMocha(openapiSpec, aiAnalysis) {
  return generateNode(openapiSpec, aiAnalysis, false);
}

// =====================================================
// SPRING BOOT GENERATORS
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

  return matchers[status] || `is(${status})`;
}

function springRequestBuilderImport(method) {
  return `import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.${method};`;
}

function escapeJavaPath(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function springBuildRequest(method, requestInfo, body) {
  let request = `${method}("${escapeJavaPath(requestInfo.path)}")`;

  if (requestInfo.queryParams !== null) {
    for (const [key, value] of Object.entries(requestInfo.queryParams)) {
      request += `.param("${escapeJavaPath(key)}", "${escapeJavaPath(value)}")`;
    }
  }

  if (body !== null) {
    request += ".contentType(MediaType.APPLICATION_JSON)";
    request += ".content(json)";
  }

  return request;
}

function generateSpring(openapiSpec, aiAnalysis, useTestNG) {
  const tests = [];
  const methods = ["get", "post", "put", "patch", "delete"];
  const usedMethods = new Set();

  let usesMediaType = false;
  let usesStatus = false;

  for (const [path, pathItem] of Object.entries(openapiSpec.paths || {})) {
    for (const method of methods) {
      const operation = pathItem?.[method];
      if (!operation) continue;

      const scenarios = getScenarios(
        path,
        pathItem,
        operation,
        aiAnalysis,
        openapiSpec
      );

      const defaultBody = ["post", "put", "patch"].includes(method)
        ? getJsonRequestBody(operation, openapiSpec)
        : null;

      scenarios.forEach((test, index) => {
        const body =
          defaultBody !== null
            ? buildBodyForScenario(test, operation, openapiSpec)
            : null;

        const requestInfo = buildRequestForScenario(
          test,
          path,
          pathItem,
          operation,
          openapiSpec
        );

        const methodName = `test${toPascalCase(
          test.name || `${method} ${path}`
        )}${index + 1}`;

        const lines = [
          "    @Test",
          `    ${useTestNG ? "public " : ""}void ${methodName}() throws Exception {`,
        ];

        if (body !== null) {
          lines.push(`        String json = ${JSON.stringify(JSON.stringify(body))};`);
          lines.push("");
          usesMediaType = true;
        }

        usedMethods.add(method);

        lines.push(
          `        mockMvc.perform(${springBuildRequest(method, requestInfo, body)})`
        );

        let status = Number(test.expectedStatus);

        if (!Number.isInteger(status)) {
          status = getDocumentedSuccessStatus(operation);
        }

        if (Number.isInteger(status)) {
          usesStatus = true;
          lines.push(
            `                .andExpect(status().${springStatusMatcher(status)});`
          );
        } else {
          lines[lines.length - 1] += ";";
        }

        lines.push("    }");
        tests.push(lines.join("\n"));
      });
    }
  }

  if (!tests.length) {
    throw new Error("No supported API operations were found.");
  }

  const imports = [
    "import org.springframework.beans.factory.annotation.Autowired;",
    "import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;",
    "import org.springframework.boot.test.context.SpringBootTest;",
    "import org.springframework.test.web.servlet.MockMvc;",
    useTestNG
      ? "import org.testng.annotations.Test;"
      : "import org.junit.jupiter.api.Test;",
  ];

  if (usesMediaType) {
    imports.push("import org.springframework.http.MediaType;");
  }

  for (const method of methods) {
    if (usedMethods.has(method)) {
      imports.push(springRequestBuilderImport(method));
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

function generateSpringJUnit(openapiSpec, aiAnalysis) {
  return generateSpring(openapiSpec, aiAnalysis, false);
}

function generateSpringTestNG(openapiSpec, aiAnalysis) {
  return generateSpring(openapiSpec, aiAnalysis, true);
}

// =====================================================
// INPUT NORMALIZATION
// =====================================================

function normalizeLanguage(language) {
  return String(language || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeFramework(framework) {
  return String(framework || "").toLowerCase().trim().replace(/\s+/g, " ");
}

// =====================================================
// GENERATE TESTS
// =====================================================

app.post("/generate-tests", async (req, res) => {
  try {
    const { openapiSpec, language, framework } = req.body || {};

    if (!openapiSpec || typeof openapiSpec !== "object") {
      return res.status(400).json({
        success: false,
        error: "OpenAPI specification is required as a JSON object.",
      });
    }

    if (
      !openapiSpec.paths ||
      typeof openapiSpec.paths !== "object" ||
      Array.isArray(openapiSpec.paths)
    ) {
      return res.status(400).json({
        success: false,
        error: "OpenAPI specification must contain a valid paths object.",
      });
    }

    if (!language) {
      return res.status(400).json({
        success: false,
        error: "Target language is required.",
      });
    }

    if (!framework) {
      return res.status(400).json({
        success: false,
        error: "Testing framework is required.",
      });
    }

    const normalizedLanguage = normalizeLanguage(language);
    const normalizedFramework = normalizeFramework(framework);

    console.log(`Generating ${language} / ${framework} tests...`);

    let aiAnalysis = null;

    try {
      aiAnalysis = await analyzeWithOllama(openapiSpec);

      console.log("\n===== OLLAMA AI ANALYSIS =====");
      console.log(JSON.stringify(aiAnalysis, null, 2));
      console.log("===== END OLLAMA AI ANALYSIS =====\n");
    } catch (error) {
      console.error("Ollama analysis failed:", error.message);
      console.log("Continuing with deterministic fallback generation.");
    }

    // PYTHON
    if (normalizedLanguage === "python") {
      if (
        normalizedFramework === "pytest" ||
        normalizedFramework === "py.test"
      ) {
        return res.json({
          success: true,
          language: "Python",
          framework: "Pytest",
          filename: "test_api.py",
          generatedCode: generatePythonPytest(openapiSpec, aiAnalysis),
        });
      }

      if (normalizedFramework === "unittest") {
        return res.json({
          success: true,
          language: "Python",
          framework: "Unittest",
          filename: "test_api.py",
          generatedCode: generatePythonUnittest(openapiSpec, aiAnalysis),
        });
      }

      return res.status(400).json({
        success: false,
        error: "Unsupported Python framework. Choose Pytest or Unittest.",
      });
    }

    // NODE.JS
    if (
      ["node.js", "nodejs", "node"].includes(normalizedLanguage)
    ) {
      if (normalizedFramework === "jest") {
        return res.json({
          success: true,
          language: "Node.js",
          framework: "Jest",
          filename: "api.test.js",
          generatedCode: generateNodeJest(openapiSpec, aiAnalysis),
        });
      }

      if (normalizedFramework === "mocha") {
        return res.json({
          success: true,
          language: "Node.js",
          framework: "Mocha",
          filename: "api.test.js",
          generatedCode: generateNodeMocha(openapiSpec, aiAnalysis),
        });
      }

      return res.status(400).json({
        success: false,
        error: "Unsupported Node.js framework. Choose Jest or Mocha.",
      });
    }

    // SPRING BOOT / JAVA
    if (
      ["spring boot", "springboot", "java"].includes(normalizedLanguage)
    ) {
      if (normalizedFramework === "junit") {
        return res.json({
          success: true,
          language: "Spring Boot",
          framework: "JUnit",
          filename: "ApiTest.java",
          generatedCode: generateSpringJUnit(openapiSpec, aiAnalysis),
        });
      }

      if (normalizedFramework === "testng") {
        return res.json({
          success: true,
          language: "Spring Boot",
          framework: "TestNG",
          filename: "ApiTest.java",
          generatedCode: generateSpringTestNG(openapiSpec, aiAnalysis),
        });
      }

      return res.status(400).json({
        success: false,
        error: "Unsupported Spring Boot framework. Choose JUnit or TestNG.",
      });
    }

    return res.status(400).json({
      success: false,
      error: `Unsupported target language: ${language}`,
    });
  } catch (error) {
    console.error("Generation error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate test code.",
    });
  }
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`AI Bridge running at http://localhost:${PORT}`);
  console.log("Supported combinations:");
  console.log("Python -> Pytest / Unittest");
  console.log("Node.js -> Jest / Mocha");
  console.log("Spring Boot -> JUnit / TestNG");
});