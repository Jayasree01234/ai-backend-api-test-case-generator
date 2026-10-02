import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle browser CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { openapiSpec, language, framework } = await req.json();

    if (!openapiSpec) {
      return new Response(
        JSON.stringify({
          error: "OpenAPI specification is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!language || !framework) {
      return new Response(
        JSON.stringify({
          error: "Language and framework are required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    /*
     * AI generation will be connected here.
     *
     * For now, this function verifies that the React application
     * can successfully communicate with the Supabase Edge Function.
     */

    const generatedCode = `# AI test generation placeholder

Language: ${language}
Framework: ${framework}

OpenAPI specification received successfully.
`;

    return new Response(
      JSON.stringify({
        success: true,
        language,
        framework,
        generatedCode,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Generation error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to process test generation request.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});