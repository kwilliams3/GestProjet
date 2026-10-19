import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Charge `path` depuis l'API.
 * reload() relance la requête en gardant les données affichées ; setData() permet les mises à jour optimistes.
 */
export function useApi(path) {
  const [state, setState] = useState({ path, data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) =>
      s.path === path ? { ...s, loading: true, error: null } : { path, data: null, error: null, loading: true },
    );
    api(path).then(
      (data) => !cancelled && setState({ path, data, error: null, loading: false }),
      (error) => !cancelled && setState({ path, data: null, error, loading: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })),
    [],
  );

  return { data: state.data, error: state.error, loading: state.loading, reload, setData };
}

/** Ferme un menu déroulant (ref) sur un clic à l'extérieur ou la touche Échap. */
export function useDismiss(ref, active, onDismiss) {
  useEffect(() => {
    if (!active) return undefined;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onDismiss();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, active, onDismiss]);
}
