const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoOKBCWHN2N-dCRxrwoHVKTQy8pmoUwYuxrp-uGLbEMA2XKrHzIB7oSXPKPDo-nzF-/exec';

exports.handler = async (event) => {
  const params = new URLSearchParams(event.queryStringParameters || {}).toString();
  const url = `${APPS_SCRIPT_URL}?${params}`;
  const res  = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: text,
  };
};
