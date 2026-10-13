/**
 * `fakeMutation(fn)` — a stand-in for a TanStack `useMutation` hook in tests
 * that `vi.mock` a `lib/hooks/<domain>` module. `fn` plays the server: its
 * return value (or thrown error / rejected promise) drives `isPending`,
 * `isSuccess` / `data`, `isError` / `error` and the per-call `onSuccess` /
 * `onError` callbacks, like the real hook. Not a test file; tests only.
 */
import React from "react";

type Status = "idle" | "pending" | "success" | "error";
interface CallOptions<V, R> {
  onSuccess?: (data: R, vars: V) => void;
  onError?: (err: unknown, vars: V) => void;
}

export function fakeMutation<V, R>(fn: (vars: V) => R | Promise<R>) {
  return function useFakeMutation() {
    const [state, setState] = React.useState<{ status: Status; data?: R; error: unknown }>({
      status: "idle",
      error: null,
    });
    const mutateAsync = async (vars: V, opts?: CallOptions<V, R>): Promise<R> => {
      setState({ status: "pending", error: null });
      try {
        const data = await fn(vars);
        setState({ status: "success", data, error: null });
        opts?.onSuccess?.(data, vars);
        return data;
      } catch (error) {
        setState({ status: "error", error });
        opts?.onError?.(error, vars);
        throw error;
      }
    };
    return {
      mutate: (vars: V, opts?: CallOptions<V, R>) => {
        mutateAsync(vars, opts).catch(() => undefined);
      },
      mutateAsync,
      reset: () => setState({ status: "idle", error: null }),
      isPending: state.status === "pending",
      isSuccess: state.status === "success",
      isError: state.status === "error",
      data: state.data,
      error: state.error,
    };
  };
}
