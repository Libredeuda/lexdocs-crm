import { useState, useCallback } from 'react';
import api from '../api';

export function useCases() {
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCases = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
      const qs = query.toString();
      const res = await api.get(`/cases${qs ? '?' + qs : ''}`);
      setCases(res.data.data || res.data);
      setTotal(res.data.total || 0);
      return res.data;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCase = useCallback(async (data) => {
    const res = await api.post('/cases', data);
    return res.data;
  }, []);

  const updateCase = useCallback(async (id, data) => {
    const res = await api.put(`/cases/${id}`, data);
    return res.data;
  }, []);

  return { cases, total, loading, error, fetchCases, createCase, updateCase };
}
