export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });

export const error = (code, message, status = 400) => json({ ok: false, code, message }, { status });

export const ok = (data = {}, init = {}) => json({ ok: true, ...data }, init);

export const notFound = () => error("NOT_FOUND", "资源不存在", 404);

export const methodNotAllowed = () => error("METHOD_NOT_ALLOWED", "请求方法不支持", 405);

export const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

export const noStoreHeaders = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};
