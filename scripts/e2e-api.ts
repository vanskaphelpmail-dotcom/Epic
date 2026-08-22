import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, ".env.local"), override: true });

const API = process.env.API_URL || process.env.APP_URL || "http://localhost:3000";

async function req(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const bugs: string[] = [];
  const ok: string[] = [];

  const health = await req("/api/health");
  if (health.status === 200 && health.json.ok) ok.push("health");
  else bugs.push(`health failed: ${health.status} ${JSON.stringify(health.json)}`);

  const products = await req("/api/products");
  const count = products.json?.data?.items?.length ?? 0;
  if (products.status === 200 && count > 0) ok.push(`products list (${count})`);
  else bugs.push(`products list failed: ${products.status}`);

  const email = `e2e_${Date.now()}@test.bd`;
  const reg = await req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "TestPass123!",
      fullName: "E2E Tester",
      phone: "01810000001",
    }),
  });
  if (reg.status === 201 && reg.json?.data?.token) ok.push("register");
  else bugs.push(`register failed: ${reg.status} ${JSON.stringify(reg.json)}`);

  const loginUser = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "TestPass123!" }),
  });
  if (loginUser.status === 200 && loginUser.json?.data?.token) ok.push("login new user");
  else bugs.push(`login new user failed: ${loginUser.status}`);

  const adminLogin = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@jerseyaddicts.bd", password: "ChangeMeNow!" }),
  });
  const adminToken = adminLogin.json?.data?.token as string | undefined;
  if (adminToken) ok.push("admin login");
  else bugs.push(`admin login failed: ${adminLogin.status} ${JSON.stringify(adminLogin.json)}`);

  const custLogin = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "customer@jerseyaddicts.bd", password: "Customer123!" }),
  });
  const custToken = custLogin.json?.data?.token as string | undefined;
  if (custToken) ok.push("customer login");
  else bugs.push(`customer login failed: ${custLogin.status} ${JSON.stringify(custLogin.json)}`);

  let productId = products.json?.data?.items?.[0]?.id as string | undefined;

  if (adminToken) {
    const me = await req("/api/auth/me", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (me.status === 200) ok.push("auth/me");
    else bugs.push(`auth/me failed: ${me.status}`);

    const created = await req("/api/products", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: "E2E Audit Kit",
        slug: `e2e-audit-${Date.now()}`,
        sku: `E2E-${Date.now()}`,
        price: 150,
        description: "Created by e2e audit",
        image: "https://example.com/jersey.jpg",
        brand: "Adidas",
        season: "2026",
        year: 2026,
        condition: "Mint",
        conditionDetail: "Deadstock",
        color: "Red",
        sizes: ["S", "M", "L"],
        stock: 10,
        status: "Active",
      }),
    });
    if (created.status === 201 && created.json?.data?.id) {
      ok.push("create product");
      productId = created.json.data.id;
      const stockBefore = created.json.data.stock;

      const updated = await req(`/api/products/${productId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ stock: stockBefore, name: "E2E Audit Kit Updated" }),
      });
      if (updated.status === 200 && updated.json?.data?.name?.includes("Updated")) ok.push("update product");
      else bugs.push(`update product failed: ${updated.status} ${JSON.stringify(updated.json)}`);
    } else {
      bugs.push(`create product failed: ${created.status} ${JSON.stringify(created.json)}`);
    }
  }

  const tokenForOrder = custToken || loginUser.json?.data?.token;
  if (tokenForOrder && productId) {
    const order = await req("/api/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenForOrder}` },
      body: JSON.stringify({
        paymentMethod: "cod",
        deliveryRegion: "inside",
        deliveryCharge: 70,
        shipFullName: "E2E Buyer",
        shipPhone: "01810000002",
        shipEmail: email,
        shipAddressLine1: "Bailey Road 8",
        shipCity: "Dhaka",
        shipPostalCode: "1217",
        items: [{ productId, selectedSize: "M", quantity: 1 }],
      }),
    });
    if (order.status === 201 && order.json?.data?.orderNumber) {
      ok.push(`create order ${order.json.data.orderNumber}`);
      const after = await req(`/api/products/${productId}`);
      const stock = after.json?.data?.stock;
      if (typeof stock === "number") ok.push(`stock after order=${stock}`);
      else bugs.push("could not read stock after order");
    } else {
      bugs.push(`create order failed: ${order.status} ${JSON.stringify(order.json)}`);
    }

    const list = await req("/api/orders", {
      headers: { Authorization: `Bearer ${tokenForOrder}` },
    });
    if (list.status === 200 && (list.json?.data?.items?.length ?? 0) > 0) ok.push("list orders");
    else bugs.push(`list orders failed: ${list.status}`);
  }

  const dup = await req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "TestPass123!",
      fullName: "Dup",
      phone: "01810000001",
    }),
  });
  if (dup.status === 409) ok.push("duplicate email rejected");
  else bugs.push(`duplicate email expected 409 got ${dup.status}`);

  const cms = await req("/api/cms/homepage");
  if (cms.status === 200) ok.push("cms homepage");
  else bugs.push(`cms failed: ${cms.status}`);

  if (custToken) {
    const forgot = await req("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "customer@jerseyaddicts.bd" }),
    });
    const resetTok = forgot.json?.data?.devResetToken as string | undefined;
    if (forgot.status === 200) ok.push("forgot-password");
    else bugs.push(`forgot-password failed: ${forgot.status}`);

    if (resetTok) {
      const reset = await req("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetTok, password: "Customer123!" }),
      });
      if (reset.status === 200) ok.push("reset-password");
      else bugs.push(`reset-password failed: ${reset.status} ${JSON.stringify(reset.json)}`);
    }

    if (productId) {
      const cartSync = await req("/api/cart", {
        method: "PUT",
        headers: { Authorization: `Bearer ${custToken}` },
        body: JSON.stringify({
          items: [{ productId, selectedSize: "L", quantity: 2 }],
        }),
      });
      if (cartSync.status === 200) ok.push("cart sync");
      else bugs.push(`cart sync failed: ${cartSync.status} ${JSON.stringify(cartSync.json)}`);

      const cartGet = await req("/api/cart", {
        headers: { Authorization: `Bearer ${custToken}` },
      });
      if (cartGet.status === 200 && (cartGet.json?.data?.items?.length ?? 0) > 0) ok.push("cart get");
      else bugs.push(`cart get failed: ${cartGet.status}`);
    }
  }

  const userTok = (loginUser.json?.data?.token as string | undefined) || custToken;
  if (userTok && productId) {
    const wishAdd = await req("/api/wishlist", {
      method: "POST",
      headers: { Authorization: `Bearer ${userTok}` },
      body: JSON.stringify({ productId }),
    });
    if (wishAdd.status === 201) ok.push("wishlist add");
    else bugs.push(`wishlist add failed: ${wishAdd.status} ${JSON.stringify(wishAdd.json)}`);

    const wishGet = await req("/api/wishlist", {
      headers: { Authorization: `Bearer ${userTok}` },
    });
    if (wishGet.status === 200 && (wishGet.json?.data?.items?.length ?? 0) > 0) ok.push("wishlist get");
    else bugs.push(`wishlist get failed: ${wishGet.status}`);

    const wishDel = await req(`/api/wishlist/${productId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userTok}` },
    });
    if (wishDel.status === 200) ok.push("wishlist remove");
    else bugs.push(`wishlist remove failed: ${wishDel.status}`);

    const addr = await req("/api/addresses", {
      method: "POST",
      headers: { Authorization: `Bearer ${userTok}` },
      body: JSON.stringify({
        label: "Home",
        fullName: "E2E Buyer",
        phone: "01810000099",
        addressLine1: "Bailey Road Test",
        city: "Dhaka",
        postalCode: "1217",
        isDefault: true,
      }),
    });
    const addrId = addr.json?.data?.id as string | undefined;
    if (addr.status === 201 && addrId) ok.push("address create");
    else bugs.push(`address create failed: ${addr.status} ${JSON.stringify(addr.json)}`);

    if (addrId) {
      const addrUp = await req(`/api/addresses/${addrId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${userTok}` },
        body: JSON.stringify({ city: "Chittagong", postalCode: "4000" }),
      });
      if (addrUp.status === 200) ok.push("address update");
      else bugs.push(`address update failed: ${addrUp.status}`);

      const addrDel = await req(`/api/addresses/${addrId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userTok}` },
      });
      if (addrDel.status === 200) ok.push("address delete");
      else bugs.push(`address delete failed: ${addrDel.status}`);
    }

    const profile = await req("/api/auth/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userTok}` },
      body: JSON.stringify({ fullName: "E2E Tester Updated", phone: "01810000088" }),
    });
    if (profile.status === 200 && profile.json?.data?.fullName?.includes("Updated")) ok.push("profile update");
    else bugs.push(`profile update failed: ${profile.status} ${JSON.stringify(profile.json)}`);

    const review = await req("/api/reviews", {
      method: "POST",
      headers: { Authorization: `Bearer ${userTok}` },
      body: JSON.stringify({
        productId,
        rating: 5,
        comment: "E2E verified authentic jersey quality.",
      }),
    });
    if (review.status === 201) ok.push("review create");
    else bugs.push(`review create failed: ${review.status} ${JSON.stringify(review.json)}`);
  }

  if (adminToken) {
    const coupon = await req("/api/coupons", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: `E2E${Date.now().toString().slice(-6)}`,
        type: "PERCENT",
        discountValue: 10,
        usageLimit: 50,
      }),
    });
    if (coupon.status === 201 && coupon.json?.data?.id) {
      ok.push("coupon create");
      const couponId = coupon.json.data.id as string;
      const listC = await req("/api/coupons", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (listC.status === 200) ok.push("coupon list");
      else bugs.push(`coupon list failed: ${listC.status}`);
      await req(`/api/coupons/${couponId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    } else {
      bugs.push(`coupon create failed: ${coupon.status} ${JSON.stringify(coupon.json)}`);
    }

    const brand = await req("/api/catalog/brands", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `E2E Brand ${Date.now()}` }),
    });
    if (brand.status === 201) ok.push("brand create");
    else bugs.push(`brand create failed: ${brand.status} ${JSON.stringify(brand.json)}`);

    const league = await req("/api/catalog/leagues", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `E2E League ${Date.now()}` }),
    });
    if (league.status === 201) ok.push("league create");
    else bugs.push(`league create failed: ${league.status} ${JSON.stringify(league.json)}`);

    const category = await req("/api/catalog/categories", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `E2E Category ${Date.now()}` }),
    });
    if (category.status === 201) ok.push("category create");
    else bugs.push(`category create failed: ${category.status} ${JSON.stringify(category.json)}`);
  }

  if (adminToken && productId) {
    const del = await req(`/api/products/${productId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (del.status === 200) ok.push("delete product");
    else bugs.push(`delete product failed: ${del.status}`);
  }

  console.log(JSON.stringify({ ok, bugs }, null, 2));
  if (bugs.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
