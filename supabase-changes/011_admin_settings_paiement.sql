-- 011_admin_settings_paiement.sql
-- Configuration du mode de paiement (acompte ou total).

-- mode_paiement : 'total' (paiement intégral) ou 'acompte' (pourcentage)
ALTER TABLE admin_settings ADD COLUMN mode_paiement text NOT NULL DEFAULT 'total';

-- Pourcentage de l'acompte (ex: 30 = 30%). Ignoré si mode_paiement = 'total'.
ALTER TABLE admin_settings ADD COLUMN acompte_pourcentage integer NOT NULL DEFAULT 30;
