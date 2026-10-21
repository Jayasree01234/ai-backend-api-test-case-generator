
import { analyzeOpenApiWithAI } from "./browserAIService";

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
];

function clone(value) {
  return value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));
}

function slug(value) {
  const result = String(value || "api_test")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return result || "api_test";
}

function resolveRef(spec, value) {
  let current = value;
  const visited = new Set();

  while (
    current &&
    typeof current === "object" &&
    typeof current.$ref === "string" &&
    current.$ref.startsWith("#/") &&
    !visited.has(current.$ref)
  ) {
    const ref = current.$ref;
    visited.add(ref);

    current = ref
      .slice(2)
      .split("/")
      .reduce(
        (node, key) =>
          node?.[key.replace(/~1/g, "/").replace(/~0/g, "~")],
        spec
      );
  }

  return current && typeof current === "object" ? current : {};
}

function getBaseUrl(spec) {
  const server = spec?.servers?.[0];

  if (server?.url) {
    let url = server.url;

    for (const [name, variable] of Object.entries(
      server.variables || {}
    )) {
      const replacement =
        variable.default ?? variable.enum?.[0] ?? name;

      url = url.replaceAll(`{${name}}`, String(replacement));
    }

    return url.replace(/\/+$/, "");
  }

  if (spec?.swagger === "2.0" && spec?.host) {
    const protocol = spec.schemes?.[0] || "http";

    return `${protocol}://${spec.host}${spec.basePath || ""}`
      .replace(/\/+$/, "");
  }

  return "http://localhost:8080";
}

function sampleFromSchema(spec, inputSchema, depth = 0) {
  if (depth > 6) return null;

  const schema = resolveRef(spec, inputSchema);

  if (schema.example !== undefined) return clone(schema.example);
  if (schema.default !== undefined) return clone(schema.default);
  if (schema.enum?.length) return clone(schema.enum[0]);
  if (schema.const !== undefined) return clone(schema.const);

  if (schema.oneOf?.length) {
    return sampleFromSchema(spec, schema.oneOf[0], depth + 1);
  }

  if (schema.anyOf?.length) {
    return sampleFromSchema(spec, schema.anyOf[0], depth + 1);
  }

  const type =
    schema.type ||
    (schema.properties ? "object" : schema.items ? "array" : "string");

  switch (type) {
    case "object": {
      const result = {};

      for (const [key, childSchema] of Object.entries(
        schema.properties || {}
      )) {
        const child = resolveRef(spec, childSchema);
        if (child.readOnly) continue;

        result[key] = sampleFromSchema(spec, childSchema, depth + 1);
      }

      return result;
    }

    case "array":
      return [
        sampleFromSchema(spec, schema.items || {}, depth + 1),
      ];

    case "integer":
      return 1;

    case "number":
      return 1.5;

    case "boolean":
      return true;

    case "string":
      if (schema.format === "email") return "user@example.com";
      if (schema.format === "date") return "2026-01-15";
      if (schema.format === "date-time") return "2026-01-15T10:00:00Z";
      if (schema.format === "uuid") {
        return "123e4567-e89b-12d3-a456-426614174000";
      }
      if (["uri", "url"].includes(schema.format)) {
        return "https://example.com";
      }
      return "sample";

    default:
      return null;
  }
}

function getParameters(spec, pathItem, operation) {
  const combined = [
    ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : []),
  ];

  const unique = new Map();

  for (const entry of combined) {
    const parameter = resolveRef(spec, entry);

    if (parameter.name && parameter.in) {
      unique.set(`${parameter.in}:${parameter.name}`, parameter);
    }
  }

  return [...unique.values()];
}

function getParameterSample(spec, parameter) {
  if (parameter.example !== undefined) return parameter.example;

  return sampleFromSchema(
    spec,
    parameter.schema || { type: "string" }
  );
}

function getRequestBody(spec, operation) {
  if (!operation.requestBody) {
    return { hasBody: false, schema: {}, body: undefined };
  }

  const requestBody = resolveRef(spec, operation.requestBody);
  const content = requestBody.content || {};

  const mediaType =
    Object.keys(content).find(
      (key) => key === "application/json" || key.endsWith("+json")
    ) || Object.keys(content)[0];

  if (!mediaType || !content[mediaType]?.schema) {
    return { hasBody: false, schema: {}, body: undefined };
  }

  const schema = resolveRef(spec, content[mediaType].schema);

  return {
    hasBody: true,
    schema,
    body: sampleFromSchema(spec, content[mediaType].schema),
  };
}

function successStatus(operation, method) {
  const responses = operation.responses || {};
  const codes = Object.keys(responses).filter((code) => /^2\d\d$/.test(code));

  for (const preferred of ["200", "201", "202", "204"]) {
    if (codes.includes(preferred)) return Number(preferred);
  }

  if (codes.length) {
    return Number(codes.sort((a, b) => Number(a) - Number(b))[0]);
  }

  if (method === "post") return 201;
  if (method === "delete") return 204;

  return 200;
}

function errorStatus(operation) {
  const codes = Object.keys(operation.responses || {}).filter(
    (code) => /^4\d\d$/.test(code)
  );

  for (const preferred of ["400", "422", "409", "401", "403", "404"]) {
    if (codes.includes(preferred)) return Number(preferred);
  }

  return codes.length
    ? Number(codes.sort((a, b) => Number(a) - Number(b))[0])
    : 400;
}

function findInvalidProperty(spec, schema) {
  const properties = Object.entries(schema.properties || {});
  if (!properties.length) return null;

  function priority(entry) {
    const child = resolveRef(spec, entry[1]);

    if (child.type === "integer" || child.type === "number") return 0;
    if (child.enum?.length) return 1;
    if (child.format === "email") return 2;
    if (child.type === "string") return 3;
    if (child.type === "boolean") return 4;

    return 5;
  }

  return properties.sort((a, b) => priority(a) - priority(b))[0];
}

function invalidValue(spec, schema) {
  const resolved = resolveRef(spec, schema);

  if (resolved.enum?.length) return "__invalid_enum_value__";
  if (resolved.type === "integer") return "invalid-integer";
  if (resolved.type === "number") return "invalid-number";
  if (resolved.format === "email") return "not-an-email";
  if (resolved.type === "string") return 12345;
  if (resolved.type === "boolean") return "invalid-boolean";
  if (resolved.type === "array") return "not-an-array";
  if (resolved.type === "object") return "not-an-object";

  return "__invalid_value__";
}

function buildScenarios(spec) {
  if (!spec?.paths || typeof spec.paths !== "object") {
    throw new Error(
      "The uploaded specification does not contain valid API paths."
    );
  }

  const scenarios = [];
  const usedNames = new Set();

  function addScenario(scenario) {
    const base = slug(scenario.testBase);
    let testName = `test_${base}`;
    let counter = 2;

    while (usedNames.has(testName)) {
      testName = `test_${base}_${counter++}`;
    }

    usedNames.add(testName);
    scenarios.push({ ...scenario, testName });
  }

  for (const [originalPath, originalPathItem] of Object.entries(spec.paths)) {
    const pathItem = resolveRef(spec, originalPathItem);

    for (const method of HTTP_METHODS) {
      if (!pathItem[method]) continue;

      const operation = resolveRef(spec, pathItem[method]);
      const parameters = getParameters(spec, pathItem, operation);

      const resolvedPath = originalPath.replace(/\{([^}]+)\}/g, (_, name) => {
        const parameter = parameters.find(
          (item) => item.in === "path" && item.name === name
        );

        let value = parameter
          ? getParameterSample(spec, parameter)
          : name.toLowerCase().includes("id")
            ? 1
            : "sample";

        if (value === undefined || value === null) {
          value = name.toLowerCase().includes("id") ? 1 : "sample";
        }

        return encodeURIComponent(String(value));
      });

      const query = {};

      for (const parameter of parameters.filter((item) => item.in === "query")) {
        query[parameter.name] = getParameterSample(spec, parameter);
      }

      const requestBody = getRequestBody(spec, operation);
      const nameBase = slug(operation.operationId || `${method}_${originalPath}`);

      const common = {
        method: method.toUpperCase(),
        path: resolvedPath,
        query,
      };

      addScenario({
        ...common,
        title: `${method.toUpperCase()} ${originalPath} — successful request`,
        testBase: `${nameBase}_success`,
        body: requestBody.body,
        hasBody: requestBody.hasBody,
        expectedStatus: successStatus(operation, method),
      });

      const bodySchema = requestBody.schema;
      const required = Array.isArray(bodySchema.required)
        ? bodySchema.required
        : [];

      if (
        requestBody.hasBody &&
        requestBody.body &&
        typeof requestBody.body === "object" &&
        !Array.isArray(requestBody.body) &&
        required.length
      ) {
        const missingBody = clone(requestBody.body);
        delete missingBody[required[0]];

        addScenario({
          ...common,
          title: `${method.toUpperCase()} ${originalPath} — missing required field ${required[0]}`,
          testBase: `${nameBase}_missing_${slug(required[0])}`,
          body: missingBody,
          hasBody: true,
          expectedStatus: errorStatus(operation),
        });
      }

      if (
        requestBody.hasBody &&
        bodySchema.properties &&
        Object.keys(bodySchema.properties).length
      ) {
        const invalidProperty = findInvalidProperty(spec, bodySchema);

        if (invalidProperty) {
          const [propertyName, propertySchema] = invalidProperty;
          const invalidBody = clone(requestBody.body || {});

          invalidBody[propertyName] = invalidValue(spec, propertySchema);

          addScenario({
            ...common,
            title: `${method.toUpperCase()} ${originalPath} — invalid ${propertyName}`,
            testBase: `${nameBase}_invalid_${slug(propertyName)}`,
            body: invalidBody,
            hasBody: true,
            expectedStatus: errorStatus(operation),
          });
        }
      }

      const hasPathParameter = parameters.some((item) => item.in === "path");

      if (hasPathParameter && operation.responses?.["404"]) {
        const missingPath = originalPath.replace(/\{([^}]+)\}/g, (_, name) => {
          const parameter = parameters.find(
            (item) => item.in === "path" && item.name === name
          );
          const schema = resolveRef(spec, parameter?.schema || {});

          return encodeURIComponent(
            schema.type === "string" ? "__missing_resource__" : "999999"
          );
        });

        addScenario({
          ...common,
          path: missingPath,
          title: `${method.toUpperCase()} ${originalPath} — resource not found`,
          testBase: `${nameBase}_not_found`,
          hasBody: false,
          body: undefined,
          expectedStatus: 404,
        });
      }
    }
  }

  if (!scenarios.length) {
    throw new Error(
      "No supported HTTP operations were found in this specification."
    );
  }

  return scenarios;
}

function pyLiteral(value) {
  if (value === undefined || value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";

  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    return `[${value.map(pyLiteral).join(", ")}]`;
  }

  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${pyLiteral(item)}`)
      .join(", ")}}`;
  }

  return "None";
}

function generatePython(scenarios, baseUrl, framework) {
  const isUnitTest = framework.toLowerCase().includes("unittest");

  const lines = [
    "import requests",
    ...(isUnitTest ? ["import unittest"] : []),
    "",
    `BASE_URL = ${JSON.stringify(baseUrl)}`,
    "",
  ];

  if (isUnitTest) {
    lines.push("class GeneratedApiTests(unittest.TestCase):", "");

    for (const scenario of scenarios) {
      const args = [
        JSON.stringify(scenario.method),
        `BASE_URL.rstrip("/") + ${JSON.stringify(scenario.path)}`,
        `params=${pyLiteral(scenario.query)}`,
      ];

      if (scenario.hasBody) args.push(`json=${pyLiteral(scenario.body)}`);
      args.push("timeout=15");

      lines.push(`    def ${scenario.testName}(self):`);
      lines.push(`        response = requests.request(${args.join(", ")})`);
      lines.push(
        `        self.assertEqual(response.status_code, ${scenario.expectedStatus}, ${JSON.stringify(scenario.title)})`
      );
      lines.push("");
    }

    lines.push('if __name__ == "__main__":', "    unittest.main()");
  } else {
    for (const scenario of scenarios) {
      const args = [
        JSON.stringify(scenario.method),
        `BASE_URL.rstrip("/") + ${JSON.stringify(scenario.path)}`,
        `params=${pyLiteral(scenario.query)}`,
      ];

      if (scenario.hasBody) args.push(`json=${pyLiteral(scenario.body)}`);
      args.push("timeout=15");

      lines.push(`def ${scenario.testName}():`);
      lines.push(`    response = requests.request(${args.join(", ")})`);
      lines.push(
        `    assert response.status_code == ${scenario.expectedStatus}, ${JSON.stringify(scenario.title)}`
      );
      lines.push("");
    }
  }

  return lines.join("\n");
}

function generateNode(scenarios, baseUrl, framework) {
  const isMocha = framework.toLowerCase().includes("mocha");

  const lines = [
    ...(isMocha ? ['const assert = require("node:assert/strict");'] : []),
    `const BASE_URL = ${JSON.stringify(baseUrl)};`,
    "",
    "async function sendRequest(method, path, query, body) {",
    '  const url = new URL(BASE_URL.replace(/\\/+$/, "") + path);',
    "  for (const [key, value] of Object.entries(query || {})) {",
    "    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));",
    "  }",
    '  const options = { method, headers: { Accept: "application/json" } };',
    "  if (body !== undefined) {",
    '    options.headers["Content-Type"] = "application/json";',
    "    options.body = JSON.stringify(body);",
    "  }",
    "  return fetch(url, options);",
    "}",
    "",
  ];

  if (isMocha) {
    lines.push('describe("Generated API tests", function () {');
    lines.push("  this.timeout(15000);");
  }

  for (const scenario of scenarios) {
    const body = scenario.hasBody
      ? JSON.stringify(scenario.body, null, 2)
      : "undefined";

    const request =
      `await sendRequest(${JSON.stringify(scenario.method)}, ` +
      `${JSON.stringify(scenario.path)}, ` +
      `${JSON.stringify(scenario.query, null, 2)}, ${body})`;

    if (isMocha) {
      lines.push(`  it(${JSON.stringify(scenario.title)}, async function () {`);
      lines.push(`    const response = ${request};`);
      lines.push(
        `    assert.equal(response.status, ${scenario.expectedStatus}, ${JSON.stringify(scenario.title)});`
      );
      lines.push("  });", "");
    } else {
      lines.push(`test(${JSON.stringify(scenario.title)}, async () => {`);
      lines.push(`  const response = ${request};`);
      lines.push(`  expect(response.status).toBe(${scenario.expectedStatus});`);
      lines.push("});", "");
    }
  }

  if (isMocha) lines.push("});");

  return lines.join("\n");
}

function javaString(value) {
  return JSON.stringify(String(value));
}

function javaPathWithQuery(scenario) {
  const entries = Object.entries(scenario.query || {});
  if (!entries.length) return scenario.path;

  const query = entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join("&");

  return `${scenario.path}?${query}`;
}

function generateJava(scenarios, baseUrl, framework) {
  const isTestNG = framework.toLowerCase().includes("testng");

  const lines = [
    "import java.net.URI;",
    "import java.net.http.HttpClient;",
    "import java.net.http.HttpRequest;",
    "import java.net.http.HttpResponse;",
    ...(isTestNG
      ? [
          "import org.testng.annotations.Test;",
          "import static org.testng.Assert.assertEquals;",
        ]
      : [
          "import org.junit.jupiter.api.Test;",
          "import static org.junit.jupiter.api.Assertions.assertEquals;",
        ]),
    "",
    "public class ApiTest {",
    `    private static final String BASE_URL = ${javaString(baseUrl)};`,
    "    private final HttpClient client = HttpClient.newHttpClient();",
    "",
    "    private HttpResponse<String> sendRequest(String method, String path, String body) throws Exception {",
    '        String url = BASE_URL.replaceAll("/+$", "") + path;',
    "        HttpRequest.Builder builder = HttpRequest.newBuilder()",
    "            .uri(URI.create(url))",
    '            .header("Accept", "application/json");',
    "",
    "        if (body == null) {",
    "            builder.method(method, HttpRequest.BodyPublishers.noBody());",
    "        } else {",
    '            builder.header("Content-Type", "application/json");',
    "            builder.method(method, HttpRequest.BodyPublishers.ofString(body));",
    "        }",
    "",
    "        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());",
    "    }",
    "",
  ];

  for (const scenario of scenarios) {
    const body = scenario.hasBody
      ? javaString(JSON.stringify(scenario.body))
      : "null";

    lines.push("    @Test");
    lines.push(`    public void ${scenario.testName}() throws Exception {`);
    lines.push(
      `        HttpResponse<String> response = sendRequest(${javaString(scenario.method)}, ${javaString(javaPathWithQuery(scenario))}, ${body});`
    );

    const assertion = isTestNG
      ? `assertEquals(response.statusCode(), ${scenario.expectedStatus}, ${javaString(scenario.title)});`
      : `assertEquals(${scenario.expectedStatus}, response.statusCode(), ${javaString(scenario.title)});`;

    lines.push(`        ${assertion}`);
    lines.push("    }", "");
  }

  lines.push("}");
  return lines.join("\n");
}

export async function generateTestsWithAI(
  openapiSpec,
  language,
  framework,
  onProgress = () => {}
) {
  if (typeof onProgress !== "function") {
    onProgress = () => {};
  }

  const languageKey = String(language || "").toLowerCase();
  const frameworkKey = String(framework || "").toLowerCase();

  // Validate the selected output format before loading the model.
  if (
    languageKey === "python" &&
    !["pytest", "unittest"].includes(frameworkKey)
  ) {
    throw new Error("Choose Pytest or Unittest for Python.");
  }

  if (
    ["node.js", "nodejs"].includes(languageKey) &&
    !["jest", "mocha"].includes(frameworkKey)
  ) {
    throw new Error("Choose Jest or Mocha for Node.js.");
  }

  if (
    ["spring boot", "springboot"].includes(languageKey) &&
    !["junit", "testng"].includes(frameworkKey)
  ) {
    throw new Error("Choose JUnit or TestNG for Spring Boot.");
  }

  if (
    ![
      "python",
      "node.js",
      "nodejs",
      "spring boot",
      "springboot",
    ].includes(languageKey)
  ) {
    throw new Error("Choose Python, Node.js, or Spring Boot.");
  }

  onProgress("Analyzing OpenAPI specification with local AI...");

  // Fail clearly if browser AI is unavailable; do not silently claim AI ran.
  const aiAnalysis = await analyzeOpenApiWithAI(
    openapiSpec,
    onProgress
  );

  onProgress("Generating executable test code...");

  const scenarios = buildScenarios(openapiSpec);
  const baseUrl = getBaseUrl(openapiSpec);

  let generatedCode;
  let filename;

  if (languageKey === "python") {
    filename = "test_api.py";
    generatedCode = generatePython(scenarios, baseUrl, framework);
  } else if (["node.js", "nodejs"].includes(languageKey)) {
    filename = "api.test.js";
    generatedCode = generateNode(scenarios, baseUrl, framework);
  } else {
    filename = "ApiTest.java";
    generatedCode = generateJava(scenarios, baseUrl, framework);
  }

  onProgress("Preparing generated test file...");

  return {
    success: true,
    language,
    framework,
    filename,
    generatedCode,
    testCount: scenarios.length,
    aiAnalysis,
    aiModel: aiAnalysis.model,
    aiOverview: aiAnalysis.overview,
    additionalTestIdeas: aiAnalysis.additionalTestIdeas || [],
  };
}
