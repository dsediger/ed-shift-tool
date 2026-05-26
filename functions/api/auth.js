function renderBody(status, content) {
  return `
<!doctype html>
<html>
  <body>
    <script>
      (function() {
        function receiveMessage(message) {
          window.opener.postMessage(
            'authorization:github:${status}:${JSON.stringify(content)}',
            message.origin
          );
          window.removeEventListener("message", receiveMessage, false);
        }

        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:github", "*");
      })();
    </script>
  </body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;

  const client_id = env.GITHUB_CLIENT_ID;
  const client_secret = env.GITHUB_CLIENT_SECRET;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing GitHub OAuth code", { status: 400 });
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "decap-cms-cloudflare-pages",
        accept: "application/json",
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code,
      }),
    });

    const result = await response.json();

    if (result.error) {
      return new Response(renderBody("error", result), {
        status: 401,
        headers: { "content-type": "text/html" },
      });
    }

    return new Response(renderBody("success", result), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  } catch (error) {
    return new Response(
      renderBody("error", {
        error: "server_error",
        error_description: error.message,
      }),
      {
        status: 500,
        headers: { "content-type": "text/html" },
      }
    );
  }
}