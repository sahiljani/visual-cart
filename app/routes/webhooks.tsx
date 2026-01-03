import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, session, admin, payload } =
        await authenticate.webhook(request);

    if (!admin) {
        throw new Response();
    }

    switch (topic) {
        case "APP_UNINSTALLED":
            // Clean up shop data
            if (session) {
                await prisma.session.deleteMany({ where: { shop } });
                await prisma.shop.delete({ where: { shopDomain: shop } }).catch(() => { });
            }
            break;

        case "APP_SUBSCRIPTIONS_UPDATE":
            // Handle subscription changes
            const subscriptionPayload = payload as { app_subscription?: { status: string } };
            const isActive = subscriptionPayload.app_subscription?.status === "ACTIVE";

            await prisma.shop.upsert({
                where: { shopDomain: shop },
                update: {
                    subscriptionActive: isActive,
                    plan: isActive ? "pro" : "free"
                },
                create: {
                    shopDomain: shop,
                    accessToken: session?.accessToken || "",
                    subscriptionActive: isActive,
                    plan: isActive ? "pro" : "free",
                },
            });

            // Update the metafield
            if (admin) {
                await admin.graphql(
                    `#graphql
          mutation SetSubscriptionMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { key value }
              userErrors { message }
            }
          }`,
                    {
                        variables: {
                            metafields: [
                                {
                                    namespace: "popclips",
                                    key: "subscription_active",
                                    type: "single_line_text_field",
                                    value: isActive ? "true" : "false",
                                    ownerId: `gid://shopify/Shop`,
                                },
                            ],
                        },
                    }
                );
            }
            break;

        case "CUSTOMERS_DATA_REQUEST":
        case "CUSTOMERS_REDACT":
        case "SHOP_REDACT":
            // GDPR compliance - these are required webhooks
            break;

        default:
            throw new Response("Unhandled webhook topic", { status: 404 });
    }

    throw new Response();
};
