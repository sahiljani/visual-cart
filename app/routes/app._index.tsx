import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { useState } from "react";
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
    TextField,
    Box,
} from "@shopify/polaris";
import { authenticate, MONTHLY_PLAN, MONTHLY_PLAN_50 } from "../shopify.server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Type for action data response
type ActionData = { success: boolean; error?: string; message?: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin, billing, session } = await authenticate.admin(request);
    const shop = session.shop;

    // Check if shop has active subscription
    const shopRecord = await prisma.shop.findUnique({
        where: { shopDomain: shop },
    });

    // Check billing status for both plans
    const { hasActivePayment } = await billing.check({
        plans: [MONTHLY_PLAN, MONTHLY_PLAN_50],
        isTest: true, // Set to false in production
    });

    // If subscription just activated and there's a pending promo code for 90% off,
    // we need to apply the credit
    if (hasActivePayment && shopRecord?.pendingPromoCode === "90FIRSTMONTH" && !shopRecord?.creditApplied) {
        // Apply $9 credit (90% of $10)
        try {
            await admin.graphql(
                `#graphql
                mutation AppCreditCreate($description: String!, $amount: MoneyInput!, $test: Boolean) {
                    appCreditCreate(description: $description, amount: $amount, test: $test) {
                        appCredit {
                            id
                            amount {
                                amount
                            }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }`,
                {
                    variables: {
                        description: "90FIRSTMONTH Promo: 90% off first month",
                        amount: {
                            amount: "9.00",
                            currencyCode: "USD",
                        },
                        test: true, // Set to false in production
                    },
                }
            );

            // Mark credit as applied
            await prisma.shop.update({
                where: { shopDomain: shop },
                data: { creditApplied: true, pendingPromoCode: null },
            });
        } catch (error) {
            console.error("Failed to apply credit:", error);
        }
    }

    // Get active promo codes for display
    const promoCodes = await prisma.promoCode.findMany({
        where: { isActive: true },
        select: { code: true, discountPercent: true, type: true },
    });

    return json({
        shop,
        subscriptionActive: hasActivePayment,
        plan: shopRecord?.plan || "free",
        appliedPromo: shopRecord?.pendingPromoCode || null,
        creditApplied: shopRecord?.creditApplied || false,
        availablePromoCodes: promoCodes,
    });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin, billing, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const action = formData.get("action");
    const promoCode = formData.get("promoCode")?.toString().toUpperCase().trim();

    if (action === "subscribe") {
        let planToUse = MONTHLY_PLAN;

        // Validate promo code if provided
        if (promoCode) {
            const promoRecord = await prisma.promoCode.findUnique({
                where: { code: promoCode },
            });

            if (!promoRecord) {
                return json({ success: false, error: "Invalid promo code" });
            }

            if (!promoRecord.isActive) {
                return json({ success: false, error: "This promo code is no longer active" });
            }

            // Handle different promo code types
            if (promoRecord.type === "RECURRING" && promoRecord.discountPercent === 50) {
                // Use the 50% off plan
                planToUse = MONTHLY_PLAN_50;
            } else if (promoRecord.type === "ONE_TIME" && promoRecord.discountPercent === 90) {
                // Store the promo code to apply credit after subscription
                await prisma.shop.upsert({
                    where: { shopDomain: session.shop },
                    update: { pendingPromoCode: promoCode, creditApplied: false },
                    create: {
                        shopDomain: session.shop,
                        accessToken: session.accessToken || "",
                        pendingPromoCode: promoCode,
                        creditApplied: false,
                    },
                });
                // Use standard plan, credit will be applied after
                planToUse = MONTHLY_PLAN;
            }
        }

        // Redirect to Shopify billing
        await billing.require({
            plans: [planToUse] as const,
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
    const { shop, subscriptionActive, plan, availablePromoCodes } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const submit = useSubmit();
    const [promoCode, setPromoCode] = useState("");

    const handleSubscribe = () => {
        submit({ action: "subscribe", promoCode }, { method: "post" });
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
                                <>
                                    <Banner tone="warning">
                                        <p>
                                            Upgrade to VisualCart Pro ($10/month) to unlock the
                                            Shoppable Video Carousel feature. Includes a 7-day free trial!
                                        </p>
                                    </Banner>

                                    {actionData?.error && (
                                        <Banner tone="critical">
                                            <p>{actionData.error}</p>
                                        </Banner>
                                    )}

                                    <Box paddingBlockStart="200">
                                        <TextField
                                            label="Promo Code (optional)"
                                            value={promoCode}
                                            onChange={setPromoCode}
                                            placeholder="Enter promo code"
                                            autoComplete="off"
                                            helpText="Have a promo code? Enter it here for a discount."
                                        />
                                    </Box>
                                </>
                            )}

                            <InlineStack gap="300">
                                {!subscriptionActive && (
                                    <Button variant="primary" onClick={handleSubscribe}>
                                        {promoCode ? "Subscribe with Promo" : "Subscribe - $10/month"}
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

                {!subscriptionActive && availablePromoCodes && availablePromoCodes.length > 0 && (
                    <Layout.Section>
                        <Card>
                            <BlockStack gap="300">
                                <Text as="h2" variant="headingMd">
                                    Available Promo Codes
                                </Text>
                                {availablePromoCodes.map((promo) => (
                                    <InlineStack key={promo.code} gap="200" align="start">
                                        <Badge tone="info">{promo.code}</Badge>
                                        <Text as="span">
                                            {promo.discountPercent}% off{" "}
                                            {promo.type === "RECURRING" ? "(every month)" : "(first month only)"}
                                        </Text>
                                    </InlineStack>
                                ))}
                            </BlockStack>
                        </Card>
                    </Layout.Section>
                )}
            </Layout>
        </Page>
    );
}
