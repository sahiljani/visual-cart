import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Button,
    Text,
    Banner,
    BlockStack,
    InlineStack,
    Badge,
} from "@shopify/polaris";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin, billing, session } = await authenticate.admin(request);
    const shop = session.shop;

    // Check if shop has active subscription
    const shopRecord = await prisma.shop.findUnique({
        where: { shopDomain: shop },
    });

    // Check billing status
    const { hasActivePayment } = await billing.check({
        plans: [MONTHLY_PLAN],
        isTest: true, // Set to false in production
    });

    return json({
        shop,
        subscriptionActive: hasActivePayment,
        plan: shopRecord?.plan || "free",
    });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin, billing, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const action = formData.get("action");

    if (action === "subscribe") {
        // Redirect to Shopify billing
        await billing.require({
            plans: [MONTHLY_PLAN],
            isTest: true, // Set to false in production
            onFailure: async () => {
                return redirect("/app?billing=cancelled");
            },
        });
    }

    if (action === "activate") {
        // Set the metafield to activate the feature
        const response = await admin.graphql(
            `#graphql
      mutation SetSubscriptionMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            key
            namespace
            value
          }
          userErrors {
            field
            message
          }
        }
      }`,
            {
                variables: {
                    metafields: [
                        {
                            namespace: "popclips",
                            key: "subscription_active",
                            type: "single_line_text_field",
                            value: "true",
                            ownerId: `gid://shopify/Shop/${session.shop.replace(".myshopify.com", "")}`,
                        },
                    ],
                },
            }
        );

        // Update local database
        await prisma.shop.upsert({
            where: { shopDomain: session.shop },
            update: { subscriptionActive: true, plan: "pro" },
            create: {
                shopDomain: session.shop,
                accessToken: session.accessToken || "",
                subscriptionActive: true,
                plan: "pro",
            },
        });

        return json({ success: true, message: "Feature activated!" });
    }

    return json({ success: false });
};

export default function Index() {
    const { shop, subscriptionActive, plan } = useLoaderData<typeof loader>();
    const submit = useSubmit();

    const handleSubscribe = () => {
        submit({ action: "subscribe" }, { method: "post" });
    };

    const handleActivate = () => {
        submit({ action: "activate" }, { method: "post" });
    };

    return (
        <Page title="VisualCart Dashboard">
            <Layout>
                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack align="space-between">
                                <Text as="h2" variant="headingLg">
                                    Subscription Status
                                </Text>
                                <Badge tone={subscriptionActive ? "success" : "warning"}>
                                    {subscriptionActive ? "Active" : "Inactive"}
                                </Badge>
                            </InlineStack>

                            {subscriptionActive ? (
                                <Banner tone="success">
                                    <p>
                                        Your VisualCart Pro subscription is active! The Shoppable
                                        Video Carousel feature is now enabled on your store.
                                    </p>
                                </Banner>
                            ) : (
                                <Banner tone="warning">
                                    <p>
                                        Upgrade to VisualCart Pro ($10/month) to unlock the
                                        Shoppable Video Carousel feature.
                                    </p>
                                </Banner>
                            )}

                            <InlineStack gap="300">
                                {!subscriptionActive && (
                                    <Button variant="primary" onClick={handleSubscribe}>
                                        Subscribe - $10/month
                                    </Button>
                                )}
                                {subscriptionActive && (
                                    <Button onClick={handleActivate}>
                                        Activate Feature on Store
                                    </Button>
                                )}
                            </InlineStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section>
                    <Card>
                        <BlockStack gap="300">
                            <Text as="h2" variant="headingMd">
                                Shop Information
                            </Text>
                            <Text as="p">
                                <strong>Store:</strong> {shop}
                            </Text>
                            <Text as="p">
                                <strong>Plan:</strong> {plan}
                            </Text>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
