import { Router } from "express";
import type { Request, Response } from "express";

export const couponsRouter = Router();

/** Coupons are permanently disabled for storefront orders. */
function couponsDisabled(_req: Request, res: Response) {
  return res.status(403).json({
    success: false,
    error: { message: "Coupons are disabled. Promo codes cannot be applied to orders." },
  });
}

couponsRouter.get("/", couponsDisabled);
couponsRouter.post("/validate", couponsDisabled);
couponsRouter.post("/", couponsDisabled);
couponsRouter.patch("/:id", couponsDisabled);
couponsRouter.delete("/:id", couponsDisabled);
