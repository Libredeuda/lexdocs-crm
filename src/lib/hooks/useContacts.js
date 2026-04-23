import { useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { getCurrentOrgId } from '../currentOrg';

export function useContacts() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchContacts = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const orgId = await getCurrentOrgId();
      let query = supabase
        .from('contacts')
        .select('*, assigned_user:users!contacts_assigned_to_fkey(full_name, email)', { count: 'exact' })
        .eq('org_id', orgId);

      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }
      if (params.source) {
        query = query.eq('source', params.source);
      }
      if (params.assigned_to) {
        query = query.eq('assigned_to', params.assigned_to);
      }
      if (params.search) {
        query = query.or(`first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%,phone.ilike.%${params.search}%`);
      }

      // Pagination
      const page = params.page || 1;
      const limit = params.limit || 25;
      const from = (page - 1) * limit;
      query = query.range(from, from + limit - 1);

      // Sort
      const sortBy = params.sort_by || 'created_at';
      const sortOrder = params.sort_order === 'asc' ? true : false;
      query = query.order(sortBy, { ascending: sortOrder });

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

      setContacts(data || []);
      setTotal(count || 0);
      return { data, total: count };
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getContact = useCallback(async (id) => {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase
      .from('contacts')
      .select('*, assigned_user:users!contacts_assigned_to_fkey(id, full_name, email)')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();
    if (error) throw error;
    return data;
  }, []);

  const createContact = useCallback(async (contactData) => {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...contactData, org_id: orgId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  const updateContact = useCallback(async (id, updates) => {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  const deleteContact = useCallback(async (id) => {
    const orgId = await getCurrentOrgId();
    const { error } = await supabase
      .from('contacts')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('org_id', orgId);
    if (error) throw error;
  }, []);

  return { contacts, total, loading, error, fetchContacts, getContact, createContact, updateContact, deleteContact };
}
