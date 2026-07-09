-- Table admin_users : rôles et gestion des membres admin (Phase 6.7b)
-- Liée à auth.users via user_id

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('owner', 'membre')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_users_user_id ON admin_users (user_id);
CREATE INDEX idx_admin_users_email ON admin_users (email);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié (les admins) peut lire la liste
CREATE POLICY "admin_read_admin_users" ON admin_users
  FOR SELECT TO authenticated
  USING (true);

-- Écriture : uniquement via service_role (route handlers serveur)
-- Pas de policy INSERT/UPDATE/DELETE pour authenticated

-- Insérer le premier compte existant comme owner
-- (remplacer l'email si différent)
INSERT INTO admin_users (user_id, email, role, status)
SELECT id, email, 'owner', 'active'
FROM auth.users
WHERE email = 'admin@purespa.fr'
ON CONFLICT (user_id) DO NOTHING;
