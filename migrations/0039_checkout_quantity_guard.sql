PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS trg_order_item_quantity_insert
BEFORE INSERT ON academy_order_items
BEGIN
  SELECT CASE WHEN NEW.product_type IN ('course','event') AND NEW.quantity!=1
    THEN RAISE(ABORT,'course and event checkout quantity must be one') END;
  SELECT CASE WHEN NEW.product_type='plan' AND EXISTS (
    SELECT 1 FROM academy_plan_prices pp
    WHERE pp.id=NEW.price_ref AND pp.tenant_id=NEW.tenant_id AND pp.plan_id=NEW.product_id
      AND pp.price_unit='subscription'
  ) AND NEW.quantity!=1
    THEN RAISE(ABORT,'subscription plan checkout quantity must be one') END;
END;
