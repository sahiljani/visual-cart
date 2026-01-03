import "@shopify/shopify-app-remix/adapters/node";
import {
    ApiVersion,
    AppDistribution,
    shopifyApp,
    BillingInterval,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";

const prisma = new PrismaClient();

// Billing configuration for $10/month plan
export const MONTHLY_PLAN = "VisualCart Pro";
export const billingConfig = {
    [MONTHLY_PLAN]: {
        amount: 10.0,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
    },
};

const shopify = shopifyApp({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
    apiVersion: ApiVersion.January24,
    scopes: process.env.SCOPES?.split(",") || [
        "read_metaobject_definitions",
        "write_metaobject_definitions",
        "read_metaobjects",
        "write_metaobjects",
        "read_metafields",
        "write_metafields"
    ],
    appUrl: process.env.SHOPIFY_APP_URL || "https://visualcart.janisahil.com",
    authPathPrefix: "/auth",
    sessionStorage: new PrismaSessionStorage(prisma),
    distribution: AppDistribution.AppStore,
    restResources,
    billing: billingConfig,
    future: {
        unstable_newEmbeddedAuthStrategy: true,
    },
    ...(process.env.SHOP_CUSTOM_DOMAIN
        ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
        : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
