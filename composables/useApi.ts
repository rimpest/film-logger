/**
 * Thin wrapper around `$fetch` for talking to our `/api` endpoints. Centralized so we
 * have one place to add interceptors (sync queue, error toasts, etc.).
 */
export function useApi() {
  const toast = useToast()

  async function call<T = unknown>(
    url: string,
    opts: Parameters<typeof $fetch>[1] = {},
  ): Promise<T> {
    try {
      return await $fetch<T>(url, opts)
    } catch (err: any) {
      const message = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Request failed'
      toast.add({ title: message, color: 'error' })
      throw err
    }
  }

  return {
    get: <T>(url: string) => call<T>(url),
    post: <T>(url: string, body: unknown) => call<T>(url, { method: 'POST', body }),
    patch: <T>(url: string, body: unknown) => call<T>(url, { method: 'PATCH', body }),
    del: <T>(url: string) => call<T>(url, { method: 'DELETE' }),
  }
}
