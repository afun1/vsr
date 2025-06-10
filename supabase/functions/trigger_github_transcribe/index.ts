import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { recording_id } = await req.json();

    if (!recording_id) {
      return new Response(JSON.stringify({ error: "Missing recording_id" }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Get secrets from environment variables
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const GITHUB_REPO = Deno.env.get("GITHUB_REPO");
    const GITHUB_WORKFLOW = Deno.env.get("GITHUB_WORKFLOW");

    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_WORKFLOW) {
      return new Response(JSON.stringify({ error: "Missing GitHub configuration" }), {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Prepare the workflow dispatch payload
    const githubApiUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`;
    const githubPayload = {
      ref: "main",
      inputs: {
        recording_id: recording_id,
      },
    };

    // Call GitHub Actions workflow_dispatch API
    const githubRes = await fetch(githubApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(githubPayload),
    });

    if (!githubRes.ok) {
      const errorText = await githubRes.text();
      return new Response(JSON.stringify({ error: "GitHub API error", details: errorText }), {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});