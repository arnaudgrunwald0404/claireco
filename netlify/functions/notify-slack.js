// Posts a brief summary to the #claireco Slack channel via webhook.
// Gracefully no-ops if SLACK_WEBHOOK_URL is not configured.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    // Slack not configured — silently succeed so the UI isn't blocked
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, skipped: true, reason: 'SLACK_WEBHOOK_URL not set' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  const { brief } = payload;
  if (!brief) {
    return { statusCode: 400, body: 'brief is required' };
  }

  const matchLabel = brief.match_type === 'known' ? '✅ Known use case' : '🆕 New use case';
  const readinessEmoji = {
    ready_to_build: '🟢',
    needs_followup: '🟡',
    exploratory:    '🔵',
  }[brief.readiness] || '⚪';

  const slackMessage = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `New brief from ${brief.department || 'Unknown team'}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Brief ID*\n${brief.brief_ref || '—'}` },
          { type: 'mrkdwn', text: `*Department*\n${brief.department || '—'}` },
          { type: 'mrkdwn', text: `*Type*\n${matchLabel}` },
          { type: 'mrkdwn', text: `*Readiness*\n${readinessEmoji} ${(brief.readiness || 'exploratory').replace(/_/g, ' ')}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Pain point*\n${brief.pain_summary || '—'}`,
        },
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Submitted via ClaireCo · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` },
        ],
      },
    ],
  };

  try {
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    });

    if (!slackRes.ok) {
      const text = await slackRes.text();
      console.error('Slack webhook error:', slackRes.status, text);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, error: `Slack returned ${slackRes.status}` }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('notify-slack error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
