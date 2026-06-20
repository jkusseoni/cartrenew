import { JwtPayload } from "@clerk/types";

declare global {
  interface CustomJwtSessionClaims extends JwtPayload {
    metadata: {
      role?: "merchant" | "admin" | "customer";
    };
  }
}