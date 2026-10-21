
export const LOCAL_AI_MODEL_ID =
  "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC";

let enginePromise = null;

function reportProgress(callback, message) {
  if (typeof callback === "function") {
    callback(message);
  }
}

function resolveReference(spec, schema, visited = new Set()) {
  let current = schema;

  while (
    current &&
    typeof current === "object" &&
    typeof current.$ref === "string" &&
    current.$ref.startsWith("#/") &&
    !visited.has(current.$ref)
  ) {
    const reference = current.$ref;
    visited.add(reference);

    current = reference
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

function getRequestSchema(spec, operation) {
  const requestBody = resolveReference(spec, operation.requestBody);
  const content = requestBody.content || {};

  const mediaType = Object.keys(content).find(
    (type) => type === "application/json" || type.endsWith("+json")
  );

  if (!mediaType) {
    return { required: false, properties: [] };
  }

  const schema = resolveReference(spec, content[mediaType].schema);
  const requiredFields = Array.isArray(schema.required)
    ? schema.required
    : [];

  const properties = Object.entries(schema.properties || {}).map(
    ([name, rawSchema]) => {
      const property = resolveReference(spec, rawSchema);

      return {
        name,
        type: property.type,
        format: property.format,
        required: requiredFields.includes(name),
        enum: property.enum,
        minimum: property.minimum,
        maximum: property.maximum,
        exclusiveMinimum: property.exclusiveMinimum,
        exclusiveMaximum: property.exclusiveMaximum,
        minLength: property.minLength,
        maxLength: property.maxLength,
        pattern: property.pattern,
      };
    }
  );

  return {
    required: requestBody.required === true,
    properties,
  };
}

function summarizeOpenApi(spec) {
  const methods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "options",
    "head",
  ];

  const operations = [];

  for (const [path, pathItemValue] of Object.entries(spec.paths || {})) {
    const pathItem = resolveReference(spec, pathItemValue);

    for (const method of methods) {
      if (!pathItem[method]) continue;

      const operation = resolveReference(spec, pathItem[method]);

      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId || "",
        summary: operation.summary || "",
        requestBody: getRequestSchema(spec, operation),
        responseStatuses: Object.keys(operation.responses || {}),
      });
    }
  }

  return {
    title: spec.info?.title || "OpenAPI project",
    version: spec.openapi || spec.swagger || "unknown",
    operations: operations.slice(0, 12),
    omittedOperationCount: Math.max(0, operations.length - 12),
  };
}

function validateIdeas(ideas, summary) {
  const validKinds = new Set([
    "below_minimum",
    "above_maximum",
    "string_too_short",
    "string_too_long",
    "invalid_enum",
    "pattern_mismatch",
  ]);

  const validated = [];
  const seen = new Set();

  for (const idea of Array.isArray(ideas) ? ideas : []) {
    if (!idea || typeof idea !== "object") continue;

    const method = String(idea.method || "").toUpperCase();
    const path = String(idea.path || "");
    const kind = String(idea.kind || "");
    const field = String(idea.field || "");

    const operation = summary.operations.find(
      (item) => item.method === method && item.path === path
    );

    if (!operation || !validKinds.has(kind)) continue;

    const property = operation.requestBody.properties.find(
      (item) => item.name === field
    );

    if (!property) continue;

    const isNumeric =
      property.type === "integer" || property.type === "number";

    const validConstraint =
      (kind === "below_minimum" &&
        isNumeric &&
        (property.minimum !== undefined ||
          property.exclusiveMinimum !== undefined)) ||
      (kind === "above_maximum" &&
        isNumeric &&
        (property.maximum !== undefined ||
          property.exclusiveMaximum !== undefined)) ||
      (kind === "string_too_short" &&
        property.type === "string" &&
        Number(property.minLength) > 0) ||
      (kind === "string_too_long" &&
        property.type === "string" &&
        Number.isFinite(property.maxLength)) ||
      (kind === "invalid_enum" &&
        Array.isArray(property.enum) &&
        property.enum.length > 0) ||
      (kind === "pattern_mismatch" &&
        property.type === "string" &&
        Boolean(property.pattern));

    if (!validConstraint) continue;

    const key = `${method}|${path}|${kind}|${field}`;

    if (seen.has(key)) continue;
    seen.add(key);

    validated.push({
      method,
      path,
      kind,
      field,
      reason: String(idea.reason || "Review this test idea.")
        .replace(/\s+/g, " ")
        .slice(0, 240),
    });

    if (validated.length >= 4) break;
  }

  return validated;
}

export async function analyzeOpenApiWithAI(openApiSpec, onProgress) {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    throw new Error(
      "Browser AI requires WebGPU. Try an updated Chrome or Edge browser with hardware acceleration enabled."
    );
  }

  if (!openApiSpec?.paths || typeof openApiSpec.paths !== "object") {
    throw new Error("A valid OpenAPI specification is required.");
  }

  try {
    // Load WebLLM only when AI analysis is requested.
    if (!enginePromise) {
      enginePromise = (async () => {
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

        return CreateMLCEngine(LOCAL_AI_MODEL_ID, {
          initProgressCallback: (progress) => {
            const percent =
              typeof progress?.progress === "number"
                ? ` ${Math.round(progress.progress * 100)}%`
                : "";

            reportProgress(
              onProgress,
              `Loading local AI model${percent}...`
            );
          },
        });
      })();
    }

    const engine = await enginePromise;

    reportProgress(onProgress, "AI model ready; analyzing OpenAPI...");

    const summary = summarizeOpenApi(openApiSpec);

    const response = await engine.chat.completions.create({
      messages: [
        {
          role: "system",
          content: [
            "You are an API test-design assistant.",
            "Analyze the provided OpenAPI summary.",
            "Return one JSON object with keys overview and additionalTestIdeas.",
            "overview must be one concise sentence.",
            "additionalTestIdeas must be an array of objects with method, path, kind, field, and reason.",
            "Allowed kinds: below_minimum, above_maximum, string_too_short, string_too_long, invalid_enum, pattern_mismatch.",
            "Only suggest tests supported by explicit constraints in the provided schema.",
            "Use exact method, path, and property names from the input.",
            "Do not invent endpoints, properties, or constraints.",
            "Suggest at most four ideas not already covered by basic success, required-field, invalid-value, and not-found checks.",
            "If there are no suitable additional ideas, return an empty array.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(summary),
        },
      ],
      temperature: 0.1,
      max_tokens: 700,
    });

    const raw = response.choices?.[0]?.message?.content;

    if (!raw || typeof raw !== "string") {
      throw new Error("The local AI returned an empty response.");
    }

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error("The local AI returned an invalid JSON response.");
    }

    const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));

    return {
      model: LOCAL_AI_MODEL_ID,
      overview: String(parsed.overview || "OpenAPI analysis completed.")
        .replace(/\s+/g, " ")
        .slice(0, 300),
      additionalTestIdeas: validateIdeas(
        parsed.additionalTestIdeas,
        summary
      ),
    };
  } catch (error) {
    // Allow model initialization to be retried after an error.
    enginePromise = null;

    throw new Error(
      `Browser AI analysis failed: ${error.message || "Unknown error"}`
    );
  }
}
