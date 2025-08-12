import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fetch, { Headers } from 'node-fetch';
import dotenv from 'dotenv';
import morgan from 'morgan';
dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.text({ type: '*/*', limit: '10mb' }));

const DEBUG = String(process.env.DEBUG||'false').toLowerCase()==='true';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
const wideOpen = String(process.env.CORS_WIDE_OPEN||'false').toLowerCase()==='true';
const pathRegex = new RegExp(process.env.PATH_REGEX || '\\/rest\\/api\\/');

app.use(cors({
  origin: (origin, cb) => {
    if (wideOpen || !origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin no permitido: '+origin));
  },
  credentials: true,
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
}));

if (DEBUG) app.use(morgan('dev'));

app.use('/forward', rateLimit({ windowMs: 60_000, max: 180 }));
app.use('/scrape', rateLimit({ windowMs: 60_000, max: 60 }));

app.get('/scrape', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).type('text').send('Falta parámetro url');

  let targetUrl;
  try {
    targetUrl = new URL(url);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return res.status(400).type('text').send('URL con protocolo no válido.');
    }
  } catch (e) {
    return res.status(400).type('text').send('URL inválida.');
  }

  try {
    if (DEBUG) console.log('[scrape] =>', url);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Confluence-MJMC-Scraper/1.0' }
    });
    if (!response.ok) {
      return res.status(response.status).type('text').send(`Error al fetchear la URL: ${response.statusText}`);
    }
    const text = await response.text();
    if (DEBUG) console.log('[scrape] <=', response.status, url);
    res.type('text').send(text);
  } catch (e) {
    if (DEBUG) console.error('[scrape] error', e);
    res.status(502).type('text').send(`Error de red al intentar fetchear la URL: ${e.message}`);
  }
});

const hopHeaders = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade']);

function normalizePath(pathStr) {
  const isAbsolute = pathStr.startsWith('/');
  const parts = pathStr.split('/').filter(Boolean);
  const resolved = [];
  for (const part of parts) {
    if (part === '..') {
      resolved.pop();
    } else if (part !== '.') {
      resolved.push(part);
    }
  }
  let result = resolved.join('/');
  if (isAbsolute) {
    result = '/' + result;
  }
  if (pathStr.endsWith('/') && result !== '/') {
    result += '/';
  }
  return result;
}

function sanitizeIncomingHeaders(h) {
  const out = new Headers();
  for (const [k,v] of Object.entries(h)) {
    const key = k.toLowerCase();
    if (hopHeaders.has(key)) continue;
    if (['authorization','content-type','accept','if-none-match','if-modified-since'].includes(key)) out.set(k, v);
  }
  return out;
}
function sanitizeOutgoingHeaders(h) {
  const out = {};
  for (const [k,v] of h.entries()) {
    const key = k.toLowerCase();
    if (hopHeaders.has(key)) continue;
    if (['content-type','content-length','etag','last-modified'].includes(key)) out[k]=v;
  }
  out['access-control-expose-headers'] = 'etag,last-modified';
  return out;
}
function isAllowedHost(urlStr) {
  try {
    const u = new URL(urlStr);
    const allowed = (process.env.ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean);
    return ['https:','http:'].includes(u.protocol) && allowed.includes(u.host);
  } catch { return false; }
}

function validatePath(urlStr){
  try {
    const u = new URL(urlStr);
    const normalized = normalizePath(u.pathname);
    return pathRegex.test(normalized);
  } catch {
    return false;
  }
}

app.all('/forward', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'Falta parámetro url' });
  if (!isAllowedHost(target)) return res.status(400).json({ error: 'Host destino no permitido' });
  if (!validatePath(target)) return res.status(400).json({ error: 'Ruta no permitida (solo /rest/api/*)' });

  try {
    const method = req.method;
    const body = ['GET','HEAD'].includes(method) ? undefined : req.body;
    const headers = sanitizeIncomingHeaders(req.headers);
    if (DEBUG) console.log('[proxy] =>', method, target);

    const r = await fetch(target, { method, headers, body, redirect: 'manual' });
    const buf = Buffer.from(await r.arrayBuffer());
    const hdrs = sanitizeOutgoingHeaders(r.headers);
    if (DEBUG) console.log('[proxy] <=', r.status, r.statusText, hdrs['content-type']);

    res.status(r.status).set(hdrs).send(buf);
  } catch (e) {
    if (DEBUG) console.error('[proxy] error', e);
    res.status(502).json({ error: 'Fetch falló', detail: String(e) });
  }
});

app.get('/', (_req,res)=> res.type('text').send('Confluence CORS Proxy OK'));
const port = Number(process.env.PORT||8787);
app.listen(port, ()=> console.log('Proxy escuchando en http://localhost:'+port));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const DEBUG = String(env.DEBUG||'false').toLowerCase()==='true';

    if (url.pathname === '/') return new Response('Confluence CORS Worker OK');

    if (url.pathname === '/scrape') {
      const target = url.searchParams.get('url');
      if (!target) return json({ error: 'Falta parámetro url' }, 400);
      try {
        const targetUrl = new URL(target);
        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          return json({ error: 'URL con protocolo no válido.' }, 400);
        }
      } catch (e) {
        return json({ error: 'URL inválida.' }, 400);
      }
      if (DEBUG) console.log('[worker-scrape] =>', target);
      const resp = await fetch(target, { headers: { 'User-Agent': 'Confluence-MJMC-Scraper/1.0' }});
      if (DEBUG) console.log('[worker-scrape] <=', resp.status);
      // Return the response directly, allowing headers like content-type to pass through.
      return new Response(resp.body, { status: resp.status, headers: { 'access-control-allow-origin': '*' } });
    }

    if (url.pathname === '/forward') {
      const target = url.searchParams.get('url');
      if (!target) return json({ error: 'Falta parámetro url' }, 400);

      const allowedHosts = (env.ALLOWED_HOSTS || '').split(',').map(s=>s.trim()).filter(Boolean);
      const pathRegex = new RegExp(env.PATH_REGEX || '\\/rest\\/api\\/');

      let u;
      try { u = new URL(target); } catch { return json({ error: 'URL inválida' }, 400); }
      if (!['https:','http:'].includes(u.protocol) || !allowedHosts.includes(u.host)) {
        return json({ error: 'Host destino no permitido' }, 400);
      }
      const normalizedPath = normalizePath(u.pathname);
      if (!pathRegex.test(normalizedPath)) return json({ error:'Ruta no permitida (solo /rest/api/*)' }, 400);

      const incoming = new Headers(request.headers);
      const fwdHeaders = new Headers();
      for (const [k,v] of incoming.entries()) {
        const key = k.toLowerCase();
        if (['authorization','content-type','accept','if-none-match','if-modified-since'].includes(key)) fwdHeaders.set(k, v);
      }

      const init = {
        method: request.method,
        headers: fwdHeaders,
        body: ['GET','HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
        redirect: 'manual'
      };
      if (DEBUG) console.log('[worker] =>', init.method, target);

      const resp = await fetch(target, init);

      const outHeaders = new Headers();
      for (const [k,v] of resp.headers) {
        if (['content-type','etag','last-modified','content-length'].includes(k.toLowerCase())) outHeaders.set(k, v);
      }
      outHeaders.set('access-control-allow-origin', '*'); // o limita por origen con lógica extra
      outHeaders.set('access-control-expose-headers', 'etag,last-modified');

      if (DEBUG) console.log('[worker] <=', resp.status, outHeaders.get('content-type'));

      return new Response(resp.body, { status: resp.status, headers: outHeaders });
    }

    return new Response('Not found', { status: 404 });
  }
};

function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type':'application/json' }});
}
