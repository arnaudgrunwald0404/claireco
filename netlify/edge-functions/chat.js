// Netlify Edge Function — proxies Claude API with SSE streaming
// Runs on Deno, keeps ANTHROPIC_API_KEY server-side

export default async (request) => {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { messages, system, max_tokens = 300 } = body;

  if (!messages || !Array.isArray(messages)) {
    return new Response('messages array is required', { status: 400 });
  }

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens,
      stream: true,
      system: system || '',
      messages,
    }),
  });

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    console.error('Anthropic API error:', anthropicResponse.status, errorText);
    return new Response(
      JSON.stringify({ error: `Anthropic API error: ${anthropicResponse.status}` }),
      {
        status: anthropicResponse.status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Pass the SSE stream directly through
  return new Response(anthropicResponse.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
