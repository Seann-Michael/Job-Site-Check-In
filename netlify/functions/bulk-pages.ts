import { Handler } from "@netlify/functions";
import { authMiddleware } from "./auth-middleware";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function renderTemplate(content: string, data: Record<string, any>) {
  return content.replace(/\{\{?\s*([^\}\s]+)\s*\}?\}/g, (match, key) => {
    const val = data[key];
    if (val === undefined || val === null) return match;
    return String(val);
  });
}

async function postToWordPress(siteUrl: string, apiKey: string | null, pagePayload: any) {
  const endpoint = siteUrl.replace(/\/$/, "") + "/wp-json/wp/v2/pages";
  const headers: any = { "Content-Type": "application/json" };
  if (apiKey) {
    if (apiKey.includes(":")) {
      headers["Authorization"] = `Basic ${Buffer.from(apiKey).toString("base64")}`;
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }
  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(pagePayload) });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

const handler: Handler = async (event, context) => {
  try {
    const { httpMethod, body, path } = event;

    // Create job and kick off processing
    if (httpMethod === "POST" && path?.endsWith("/generate")) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;

      if (!body) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Request body is required" }) };

      const { site_id, template_id, items, options } = JSON.parse(body);
      if (!site_id || !template_id || !Array.isArray(items)) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "site_id, template_id and items[] are required" }) };

      // Insert job record
      const jobOptions = { ...(options || {}), original_items: items };
      const { data: job, error: jobErr } = await supabase.from("bulk_page_jobs").insert({ user_id: user.id, site_id, template_id, status: 'pending', total_pages: items.length, completed_pages: 0, options: jobOptions, created_at: new Date().toISOString() }).select().single();
      if (jobErr || !job) {
        console.error("Failed to create job", jobErr);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to create job" }) };
      }

      // Respond quickly with job id, then attempt processing
      const jobId = job.id;

      // Start processing asynchronously (try/catch to avoid crashing)
      (async () => {
        try {
          await supabase.from("bulk_page_jobs").update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', jobId);

          // Fetch site and template
          const { data: site } = await supabase.from('wordpress_connections').select('*').eq('id', site_id).single();
          const { data: template } = await supabase.from('page_templates').select('*').eq('id', template_id).single();

          if (!site || !template) {
            await supabase.from('bulk_page_jobs').update({ status: 'failed', result_summary: { error: 'site or template not found' }, updated_at: new Date().toISOString() }).eq('id', jobId);
            return;
          }

          const siteUrl = site.site_url;
          const apiKey = site.api_key || null;

          let completed = 0;
          const results: any[] = [];

          // Process in batches of 20
          const BATCH_SIZE = 20;
          // helper to evaluate tokens like {{col}} or {{col[index]}}
          const evaluateTokens = (raw: string, rowIndex: number, rowsArr: any[], depth = 0): string => {
            if (typeof raw !== 'string') return String(raw ?? '');
            if (depth > 50) return raw;
            const tokenRe = /\{\{([a-zA-Z0-9_\-]+)(?:\[(\d+)\])?\}\}/g;
            let result = raw;
            let m: RegExpExecArray | null;
            while ((m = tokenRe.exec(raw)) !== null) {
              const col = m[1];
              const idxStr = m[2];
              const idx = idxStr !== undefined ? parseInt(idxStr, 10) : rowIndex;
              const refRow = rowsArr[idx];
              const replacement = refRow ? String(refRow[col] ?? '') : '';
              const evaluated = evaluateTokens(replacement, idx, rowsArr, depth + 1);
              result = result.replace(m[0], evaluated);
            }
            return result;
          };

          const callAI = async (prompt: string) => {
            const key = process.env.OPENAI_API_KEY || process.env.REPLACE_ENV_OPENAI_API_KEY || null;
            if (!key) return prompt;
            try {
              const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], max_tokens: 200 }),
              });
              const j = await resp.json();
              const txt = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || '';
              return String(txt).trim();
            } catch (err) {
              console.error('AI call failed', err);
              return prompt;
            }
          };

          for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (item, idxInBatch) => {
              try {
                // Apply column AI instructions if provided in options
                const cols: any[] = (jobOptions && jobOptions.columns) || (options && options.columns) || [];
                if (Array.isArray(cols) && cols.length > 0) {
                  for (const col of cols) {
                    if (col && col.slug && col.ai) {
                      const promptRaw = String(col.ai || '');
                      const promptEvaluated = evaluateTokens(promptRaw, i + idxInBatch, items);
                      const aiResult = await callAI(promptEvaluated);
                      item[col.slug] = aiResult;
                    }
                  }
                }

                const rendered = renderTemplate(template.template_content, item || {});
                const title = renderTemplate((template.metadata?.title_template as string) || item.title || (item.service && `${item.service} in ${item.city}`) || 'Page', item);
                const slug = renderTemplate((template.metadata?.slug_template as string) || (item.slug) || (title || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), item).slice(0, 200);
                const meta_description = renderTemplate((template.metadata?.meta_description_template as string) || (item.meta_description || ''), item);

                const payload = {
                  title,
                  content: rendered,
                  slug,
                  status: 'publish',
                } as any;
                if (meta_description) payload.meta = { description: meta_description };

                const res = await postToWordPress(siteUrl, apiKey, payload);

                const generated = {
                  job_id: jobId,
                  page_title: title,
                  page_slug: slug,
                  wordpress_post_id: res.json && (res.json.id || res.json.ID || res.json.post_id) || null,
                  variables_used: item,
                  result: { ok: res.ok, status: res.status, response: res.json },
                  created_at: new Date().toISOString(),
                };

                const { error: gpErr } = await supabase.from('generated_pages').insert(generated);
                if (gpErr) console.error('Failed to insert generated page record', gpErr);

                completed += 1;
                results.push(generated);

                // Update progress
                await supabase.from('bulk_page_jobs').update({ completed_pages: completed, updated_at: new Date().toISOString() }).eq('id', jobId);
              } catch (innerErr) {
                console.error('Error creating page for item', innerErr);
                completed += 1;
                await supabase.from('generated_pages').insert({ job_id: jobId, page_title: item.title || null, page_slug: item.slug || null, wordpress_post_id: null, variables_used: item, result: { error: innerErr.message || String(innerErr) }, created_at: new Date().toISOString() });
                await supabase.from('bulk_page_jobs').update({ completed_pages: completed, updated_at: new Date().toISOString() }).eq('id', jobId);
              }
            }));
          }

          // Job finished
          await supabase.from('bulk_page_jobs').update({ status: 'completed', result_summary: { total: items.length, completed }, updated_at: new Date().toISOString() }).eq('id', jobId);
        } catch (err) {
          console.error('Job processing failed', err);
          await supabase.from('bulk_page_jobs').update({ status: 'failed', result_summary: { error: (err as Error).message }, updated_at: new Date().toISOString() }).eq('id', jobId);
        }
      })();

      return { statusCode: 202, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ job_id: jobId }) };
    }

    // Pause job
    if (httpMethod === "POST" && path && path.match(/\/jobs\/[^\/]+\/pause$/)) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;
      const parts = path.split('/');
      const id = parts[parts.length - 2];
      const { data: job, error } = await supabase.from('bulk_page_jobs').select('*').eq('id', id).single();
      if (error || !job) return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Job not found' }) };
      if (job.user_id !== user.id) return { statusCode: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Not authorized' }) };
      await supabase.from('bulk_page_jobs').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', id);
      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
    }

    // Resume job
    if (httpMethod === "POST" && path && path.match(/\/jobs\/[^\/]+\/resume$/)) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;
      const parts = path.split('/');
      const id = parts[parts.length - 2];
      const { data: job, error } = await supabase.from('bulk_page_jobs').select('*').eq('id', id).single();
      if (error || !job) return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Job not found' }) };
      if (job.user_id !== user.id) return { statusCode: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Not authorized' }) };

      // Kick off processing from stored original_items
      const items: any[] = (job.options && job.options.original_items) || [];
      const startIndex = job.completed_pages || 0;
      await supabase.from('bulk_page_jobs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', id);

      (async () => {
        try {
          const { data: site } = await supabase.from('wordpress_connections').select('*').eq('id', job.site_id).single();
          const { data: template } = await supabase.from('page_templates').select('*').eq('id', job.template_id).single();
          if (!site || !template) {
            await supabase.from('bulk_page_jobs').update({ status: 'failed', result_summary: { error: 'site or template not found' }, updated_at: new Date().toISOString() }).eq('id', id);
            return;
          }

          const siteUrl = site.site_url;
          const apiKey = site.api_key || null;

          let completed = startIndex;

          const BATCH_SIZE = 20;
          // helper functions copied from above
          const evaluateTokens = (raw: string, rowIndex: number, rowsArr: any[], depth = 0): string => {
            if (typeof raw !== 'string') return String(raw ?? '');
            if (depth > 50) return raw;
            const tokenRe = /\{\{([a-zA-Z0-9_\-]+)(?:\[(\d+)\])?\}\}/g;
            let result = raw;
            let m: RegExpExecArray | null;
            while ((m = tokenRe.exec(raw)) !== null) {
              const col = m[1];
              const idxStr = m[2];
              const idx = idxStr !== undefined ? parseInt(idxStr, 10) : rowIndex;
              const refRow = rowsArr[idx];
              const replacement = refRow ? String(refRow[col] ?? '') : '';
              const evaluated = evaluateTokens(replacement, idx, rowsArr, depth + 1);
              result = result.replace(m[0], evaluated);
            }
            return result;
          };
          const callAI = async (prompt: string) => {
            const key = process.env.OPENAI_API_KEY || process.env.REPLACE_ENV_OPENAI_API_KEY || null;
            if (!key) return prompt;
            try {
              const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], max_tokens: 200 }),
              });
              const j = await resp.json();
              const txt = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || '';
              return String(txt).trim();
            } catch (err) {
              console.error('AI call failed', err);
              return prompt;
            }
          };

          for (let i = startIndex; i < items.length; i += BATCH_SIZE) {
            // Check if job was paused or canceled
            const { data: current } = await supabase.from('bulk_page_jobs').select('status').eq('id', id).single();
            if (!current || current.status === 'paused' || current.status === 'canceled') break;
            const batch = items.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (item, idxInBatch) => {
              try {
                const cols: any[] = (job.options && job.options.columns) || [];
                if (Array.isArray(cols) && cols.length > 0) {
                  for (const col of cols) {
                    if (col && col.slug && col.ai) {
                      const promptRaw = String(col.ai || '');
                      const promptEvaluated = evaluateTokens(promptRaw, i + idxInBatch, items);
                      const aiResult = await callAI(promptEvaluated);
                      item[col.slug] = aiResult;
                    }
                  }
                }

                const rendered = renderTemplate(template.template_content, item || {});
                const title = renderTemplate((template.metadata?.title_template as string) || item.title || (item.service && `${item.service} in ${item.city}`) || 'Page', item);
                const slug = renderTemplate((template.metadata?.slug_template as string) || (item.slug) || (title || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), item).slice(0, 200);
                const meta_description = renderTemplate((template.metadata?.meta_description_template as string) || (item.meta_description || ''), item);

                const payload = {
                  title,
                  content: rendered,
                  slug,
                  status: 'publish',
                } as any;
                if (meta_description) payload.meta = { description: meta_description };

                const res = await postToWordPress(siteUrl, apiKey, payload);

                const generated = {
                  job_id: id,
                  page_title: title,
                  page_slug: slug,
                  wordpress_post_id: res.json && (res.json.id || res.json.ID || res.json.post_id) || null,
                  variables_used: item,
                  result: { ok: res.ok, status: res.status, response: res.json },
                  created_at: new Date().toISOString(),
                };

                const { error: gpErr } = await supabase.from('generated_pages').insert(generated);
                if (gpErr) console.error('Failed to insert generated page record', gpErr);

                completed += 1;
                await supabase.from('bulk_page_jobs').update({ completed_pages: completed, updated_at: new Date().toISOString() }).eq('id', id);
              } catch (innerErr) {
                console.error('Error creating page for item', innerErr);
                completed += 1;
                await supabase.from('generated_pages').insert({ job_id: id, page_title: item.title || null, page_slug: item.slug || null, wordpress_post_id: null, variables_used: item, result: { error: innerErr.message || String(innerErr) }, created_at: new Date().toISOString() });
                await supabase.from('bulk_page_jobs').update({ completed_pages: completed, updated_at: new Date().toISOString() }).eq('id', id);
              }
            }));
          }

          // Determine final status
          const { data: finalStatus } = await supabase.from('bulk_page_jobs').select('status').eq('id', id).single();
          if (finalStatus && finalStatus.status !== 'paused' && finalStatus.status !== 'canceled') {
            await supabase.from('bulk_page_jobs').update({ status: 'completed', result_summary: { total: items.length, completed }, updated_at: new Date().toISOString() }).eq('id', id);
          }
        } catch (err) {
          console.error('Resume processing failed', err);
          await supabase.from('bulk_page_jobs').update({ status: 'failed', result_summary: { error: (err as Error).message }, updated_at: new Date().toISOString() }).eq('id', id);
        }
      })();

      return { statusCode: 202, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ job_id: id }) };
    }

    // Cancel job
    if (httpMethod === "POST" && path && path.match(/\/jobs\/[^\/]+\/cancel$/)) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;
      const parts = path.split('/');
      const id = parts[parts.length - 2];
      const { data: job, error } = await supabase.from('bulk_page_jobs').select('*').eq('id', id).single();
      if (error || !job) return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Job not found' }) };
      if (job.user_id !== user.id) return { statusCode: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Not authorized' }) };
      await supabase.from('bulk_page_jobs').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', id);
      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
    }

    // List jobs
    if (httpMethod === "GET" && path?.endsWith("/jobs")) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;

      const { data, error } = await supabase.from('bulk_page_jobs').select('*, wordpress_connections(site_name, site_url)').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to list jobs', error);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Failed to list jobs' }) };
      }

      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ jobs: data }) };
    }

    // Get job details
    if (httpMethod === "GET" && path && path.match(/\/jobs\/[^\/]+$/)) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;
      const parts = path.split('/');
      const id = parts[parts.length - 1];

      const { data: job, error } = await supabase.from('bulk_page_jobs').select('*').eq('id', id).single();
      if (error || !job) return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Job not found' }) };
      if (job.user_id !== user.id) return { statusCode: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Not authorized' }) };

      const { data: pages } = await supabase.from('generated_pages').select('*').eq('job_id', id).order('created_at', { ascending: true });

      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ job, pages }) };
    }

    // Preview pages (generate previews for first N items without posting to WP)
    if (httpMethod === "POST" && path?.endsWith("/preview")) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      if (!body) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Request body is required" }) };

      const { template_id, items } = JSON.parse(body);
      if (!template_id || !Array.isArray(items)) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "template_id and items[] are required" }) };

      const { data: template, error: tErr } = await supabase.from('page_templates').select('*').eq('id', template_id).single();
      if (tErr || !template) return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: 'Template not found' }) };

      // apply column AI instructions to preview items if provided
      const colsPreview: any[] = ( (options && options.columns) || [] );
      const evaluateTokens = (raw: string, rowIndex: number, rowsArr: any[], depth = 0): string => {
        if (typeof raw !== 'string') return String(raw ?? '');
        if (depth > 50) return raw;
        const tokenRe = /\{\{([a-zA-Z0-9_\-]+)(?:\[(\d+)\])?\}\}/g;
        let result = raw;
        let m: RegExpExecArray | null;
        while ((m = tokenRe.exec(raw)) !== null) {
          const col = m[1];
          const idxStr = m[2];
          const idx = idxStr !== undefined ? parseInt(idxStr, 10) : rowIndex;
          const refRow = rowsArr[idx];
          const replacement = refRow ? String(refRow[col] ?? '') : '';
          const evaluated = evaluateTokens(replacement, idx, rowsArr, depth + 1);
          result = result.replace(m[0], evaluated);
        }
        return result;
      };
      const callAI = async (prompt: string) => {
        const key = process.env.OPENAI_API_KEY || process.env.REPLACE_ENV_OPENAI_API_KEY || null;
        if (!key) return prompt;
        try {
          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], max_tokens: 200 }),
          });
          const j = await resp.json();
          const txt = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || '';
          return String(txt).trim();
        } catch (err) {
          console.error('AI call failed', err);
          return prompt;
        }
      };

      const previews = [];
      const previewItems = items.slice(0,5);
      for (let pi = 0; pi < previewItems.length; pi++) {
        const item = { ...previewItems[pi] };
        if (Array.isArray(colsPreview) && colsPreview.length > 0) {
          for (const col of colsPreview) {
            if (col && col.slug && col.ai) {
              const promptRaw = String(col.ai || '');
              const promptEvaluated = evaluateTokens(promptRaw, pi, previewItems);
              // call AI only if key present
              const aiVal = await callAI(promptEvaluated);
              item[col.slug] = aiVal;
            }
          }
        }
        const rendered = renderTemplate(template.template_content, item || {});
        const title = renderTemplate((template.metadata?.title_template as string) || (item.title || ''), item);
        const slug = renderTemplate((template.metadata?.slug_template as string) || (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), item);
        previews.push({ title, slug, rendered: rendered.slice(0, 3000), variables: item });
      }

      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ previews }) };
    }

    // CORS
    if (httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE" }, body: "" };
    }

    return { statusCode: 405, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (error) {
    console.error("Unhandled error in bulk-pages:", error);
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal server error" }) };
  }
};

export { handler };
