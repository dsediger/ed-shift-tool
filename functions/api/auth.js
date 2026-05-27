function renderBody(status, content) {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Decap CMS Auth</title>
  </head>
  <body>
    <script>
      (function() {
        const message = 'authorization:github:${status}:${JSON.stringify(content)}';

        function receiveMessage(event) {
          if (event.data === "authorizing:github") {
            window.opener.postMessage(message, event.origin);
            window.close();
          }
        }

        window.addEventListener("message", receiveMessage, false);

        if (window.opener) {
          window.opener.postMessage("authorizing:github", "*");
        } else {
          document.body.innerText = "Authentication complete. You can close this window.";
        }
      })();
    </script>
    <p>Completing authentication...</p>
  </body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    const redirectUri = `${url.origin}/api/auth`;

    const githubAuthUrl =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${env.GITHUB_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("public_repo")}`;

    return Response.redirect(githubAuthUrl, 302);
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "decap-cms-cloudflare-pages",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const result = await tokenResponse.json();

    if (result.error) {
      return new Response(renderBody("error", result), {
        status: 401,
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(renderBody("success", result), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    return new Response(
      renderBody("error", {
        error: "server_error",
        error_description: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}