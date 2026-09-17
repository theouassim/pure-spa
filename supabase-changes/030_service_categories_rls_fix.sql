-- La policy d'écriture de la 022 n'avait pas de restriction de rôle :
-- n'importe qui avec la clé anon (publique) pouvait modifier/supprimer les catégories.
-- Les écritures passent par les routes /api/admin (service_role, qui bypass la RLS).
DROP POLICY IF EXISTS "service_categories_admin_write" ON service_categories;

CREATE POLICY "service_categories_service_role_write"
  ON service_categories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
