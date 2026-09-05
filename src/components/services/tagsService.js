import { apiFetch } from '../../utils/apiClient';
// src/services/tagsService.js

async function requestJSON(url, opts = {}) {

  const res = await apiFetch(url, opts);

  if (!res.ok) {

    // try to pull JSON error body

    let errMsg = res.statusText;

    try {

      const errBody = await res.json();

      errMsg = errBody.error || JSON.stringify(errBody);

    } catch {/* ignore */}

    throw new Error(`HTTP ${res.status}: ${errMsg}`);

  }

  const ct = res.headers.get('content-type') || '';

  if (!ct.includes('application/json')) {

    const text = await res.text();

    console.error('Non-JSON response:', text);

    throw new Error('Expected JSON but got HTML');

  }

  return res.json();

}



export function listTags({ search = '', category = 'All' } = {}) {

  const params = new URLSearchParams();

  if (search)   params.append('search', search);

  if (category) params.append('category', category);

  return requestJSON(`/tags?${params.toString()}`);

}



export function createTag({ name, category, color }) {

  return requestJSON('/tags', {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({ name, category, color })

  });

}



export function updateTag(id, updates) {

  return requestJSON(`/tags/${id}`, {

    method: 'PUT',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify(updates)

  });

}



export function deleteTag(id) {

  return requestJSON(`/tags/${id}`, {

    method: 'DELETE'

  });

}
