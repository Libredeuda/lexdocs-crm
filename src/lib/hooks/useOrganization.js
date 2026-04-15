import { useState, useCallback } from 'react';
import api from '../api';

export function useOrganization() {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/organizations');
      setOrg(res.data);
    } catch (e) {
      console.error('Failed to fetch org', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOrg = useCallback(async (data) => {
    const res = await api.put('/organizations', data);
    setOrg(res.data);
    return res.data;
  }, []);

  return { org, loading, fetchOrg, updateOrg };
}
