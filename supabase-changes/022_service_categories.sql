-- Table pour configurer l'affichage des catégories dans le tunnel client
CREATE TABLE IF NOT EXISTS service_categories (
  nom TEXT PRIMARY KEY,
  ouverte_par_defaut BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Lecture publique (le tunnel client a besoin de lire la config)
CREATE POLICY "service_categories_public_read"
  ON service_categories FOR SELECT
  USING (true);

-- Écriture réservée au service_role (admin)
CREATE POLICY "service_categories_admin_write"
  ON service_categories FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed initial basé sur les catégories existantes (première = ouverte)
INSERT INTO service_categories (nom, ouverte_par_defaut, position)
SELECT DISTINCT categorie, false, 0
FROM services
WHERE actif = true
ON CONFLICT (nom) DO NOTHING;
