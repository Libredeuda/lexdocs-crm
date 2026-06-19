-- Crea/re-enlaza tenant + organización + perfil admin para LexDocs.
-- Re-ejecutable: detecta el usuario de Authentication MÁS RECIENTE y limpia
-- enlaces huérfanos (p.ej. si recreaste el usuario y cambió su ID interno).
do $$
declare
  v_uid uuid;
  v_email text;
  v_tenant uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
begin
  select id, email into v_uid, v_email
  from auth.users order by created_at desc limit 1;

  if v_uid is null then
    raise exception 'No hay ningún usuario en Authentication. Créalo primero (Authentication -> Add user).';
  end if;

  -- Tenant (la app lo busca por slug "libredeuda")
  insert into tenants (id, slug, name, plan, modules_enabled, is_active, license_count, max_users)
  values (v_tenant, 'libredeuda', 'LibreDeuda Abogados', 'pro',
          array['lexdocs','lexcrm','lexconsulta'], true, 25, 25)
  on conflict (slug) do update set is_active = true, plan = 'pro';
  select id into v_tenant from tenants where slug = 'libredeuda';

  -- Organización (enlazada al tenant)
  insert into organizations (id, name, slug, plan, tenant_id)
  values (v_org, 'LibreDeuda Abogados', 'libredeuda', 'pro', v_tenant)
  on conflict (slug) do update set tenant_id = excluded.tenant_id, plan = 'pro';
  select id into v_org from organizations where slug = 'libredeuda';

  -- Limpia perfiles huérfanos con el mismo email pero ID distinto (de recrear el usuario)
  delete from users where email = v_email and id <> v_uid;

  -- Perfil admin enlazado al usuario de Auth ACTUAL
  insert into users (id, org_id, email, full_name, role, is_active)
  values (v_uid, v_org, v_email, 'Administrador', 'admin', true)
  on conflict (id) do update set org_id = excluded.org_id, role = 'admin', is_active = true, email = excluded.email;

  raise notice 'OK: admin % enlazado (uid %)', v_email, v_uid;
end $$;

-- Confirmación:
select u.email, u.role, o.name as organizacion, t.slug as tenant, u.id as user_id
from users u
join organizations o on o.id = u.org_id
join tenants t on t.id = o.tenant_id;
