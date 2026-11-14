export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const text = url.searchParams.get('text');
  const accent = url.searchParams.get('accent') || 'uk';

  if (!text || !text.trim()) {
    return new Response('Missing text', { status: 400 });
  }
  // Google's endpoint reads at most ~200 characters; the longest text on the page is
  // far shorter, so anything longer is not ours.
  if (text.length > 200) {
    return new Response('Text too long', { status: 413 });
  }

  const lang = accent === 'us' ? 'en-US' : 'en-GB';
  const googleUrl =
    'https://translate.googleapis.com/translate_tts?ie=UTF-8&q=' +
    encodeURIComponent(text) +
    '&tl=' + lang +
    '&client=gtx&sl=en';

  try {
    const resp = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!resp.ok) {
      return new Response('TTS upstream error', { status: 502 });
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response('TTS fetch failed', { status: 502 });
  }
}
