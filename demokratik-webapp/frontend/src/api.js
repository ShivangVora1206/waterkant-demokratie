const jsonHeaders = {
  "Content-Type": "application/json"
};

export async function api(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export function getAuthHeaders(token) {
  return {
    ...jsonHeaders,
    Authorization: `Bearer ${token}`
  };
}

export { jsonHeaders };
